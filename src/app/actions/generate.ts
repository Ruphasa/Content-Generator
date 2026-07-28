'use server';

/**
 * End-to-end video generation orchestrator.
 *
 * One pass, five stages, all server-side:
 *
 *   1. Cloudflare Workers AI  -> the opening still frame (T2I stays on Cloudflare)
 *   2. ComfyUI / VoxCPM2      -> narration audio
 *   3. ComfyUI / Whisper      -> .srt for the narration
 *   4. ComfyUI / ACE-Step     -> background music
 *   5. ComfyUI / SVD          -> the moving picture, from the still in step 1
 *   6. FFmpeg (dynamic_editor)-> Ken Burns + sidechain ducking + burned-in subs
 *
 * ── VRAM (8GB) ───────────────────────────────────────────────────────────────
 * Every ComfyUI graph is queued and AWAITED one at a time — never Promise.all.
 * Each builder in `@/lib/comfyui/workflows` loads exactly one checkpoint, so
 * awaiting between them lets ComfyUI swap models RAM -> VRAM in turn instead of
 * holding SVD + ACE-Step + VoxCPM resident together (which will OOM 8GB).
 *
 * The order is deliberate: the two custom-node graphs (VoxCPM2, Whisper) run
 * first because they are the unverified ones and they fail in seconds, before
 * we commit minutes of GPU time to ACE-Step and SVD.
 *
 * ── Files ────────────────────────────────────────────────────────────────────
 * ComfyUI writes into its OWN output directory, which is not assumed to be
 * reachable from this process. Every artefact is pulled over HTTP with the
 * client's /view helper into a per-run temp directory, and FFmpeg reads from
 * there. The finished mp4 lands in public/generations/final, matching
 * src/app/api/generate/stitch/route.ts.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import type { DNAData, VisualGuideData } from '@/components/ClientLayout';
import { generateImageFromCloudflare } from '@/lib/cloudflare/image';
import { ComfyUIClient, type ComfyFileRef, type ComfyHistoryEntry } from '@/lib/comfyui/client';
import {
  IMAGE_TO_VIDEO_OUTPUT_NODE,
  MUSIC_OUTPUT_NODE,
  NARRATION_OUTPUT_NODE,
  TRANSCRIPTION_SRT_PATH_NODE,
  TRANSCRIPTION_SRT_SUBFOLDER,
  buildImageToVideoWorkflow,
  buildMusicWorkflow,
  buildNarrationWorkflow,
  buildTranscriptionWorkflow,
} from '@/lib/comfyui/workflows';
import { renderDynamicVideo } from '@/lib/ffmpeg/dynamic_editor';

/** Everything the pipeline needs. `dna` / `visualGuide` are the app's real state shapes. */
export interface GenerateContentInput {
  dna: DNAData;
  visualGuide: VisualGuideData;
  /** Narration script. Composed from the visual guide when omitted. */
  narrationScript?: string;
  /** English T2I prompt for the opening frame. Composed from DNA + guide when omitted. */
  imagePrompt?: string;
  /** ACE-Step style tags, e.g. "cinematic, uplifting, piano". Derived when omitted. */
  bgmTags?: string;
}

export interface GenerateContentResult {
  success: boolean;
  /** User-facing, Bahasa Indonesia. */
  message: string;
  /** Public URL of the finished video, e.g. /generations/final/final_123.mp4 */
  videoUrl?: string;
  /** The narration actually spoken (may be shorter than the input script — see below). */
  narration?: string;
  /** Length of the finished video in seconds. */
  durationSeconds?: number;
  /** Non-fatal problems (e.g. subtitles unavailable). Never silently dropped. */
  warnings: string[];
}

// ─── Duration budget ──────────────────────────────────────────────────────────
//
// SVD's frame budget, not the script, decides how long the video can be:
// `svd.safetensors` produces 14 frames and `svd_xt` 25, and the same `fps` feeds
// both the motion conditioning and the container, so the clip is always
// frames/fps seconds — a couple of seconds, not thirty.
//
// dynamic_editor truncates its output to min(video, narration) and warns, and it
// is this action's job to stop that from happening. So the video length is
// computed first and everything else is fitted to it: the narration script is
// budgeted down to a matching word count and the BGM is generated at exactly
// that length instead of ACE-Step's 30s default.
//
// Longer videos need several SVD clips concatenated, which is a bigger change
// than this action — see the task report.

/** Frames SVD will produce. Must match the checkpoint: 14 = svd, 25 = svd_xt. */
const SVD_VIDEO_FRAMES = Number(process.env.COMFYUI_SVD_VIDEO_FRAMES ?? 14) || 14;
/** Playback + conditioning frame rate for SVD. */
const SVD_FPS = 6;
/** Vertical 9:16 so the SVD frame matches the 1080x1920 render without a hard crop. */
const SVD_WIDTH = 576;
const SVD_HEIGHT = 1024;

/** Speaking rate the AI Director already assumes for Bahasa Indonesia narration. */
const WORDS_PER_SECOND = 2.5;

const SRT_BASE_NAME = 'venturo_subtitles';

function videoDurationSeconds(): number {
  return SVD_VIDEO_FRAMES / SVD_FPS;
}

/** Cuts the script down to what fits `seconds` of speech. Reports what it removed. */
function budgetNarration(script: string, seconds: number): { text: string; droppedWords: number } {
  const words = script.trim().split(/\s+/).filter(Boolean);
  const maxWords = Math.max(1, Math.round(seconds * WORDS_PER_SECOND));
  if (words.length <= maxWords) return { text: words.join(' '), droppedWords: 0 };
  return { text: words.slice(0, maxWords).join(' '), droppedWords: words.length - maxWords };
}

// ─── Prompt composition ───────────────────────────────────────────────────────

function joinParts(...parts: (string | undefined)[]): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function composeNarration(input: GenerateContentInput): string {
  if (input.narrationScript?.trim()) return input.narrationScript.trim();
  const { visualGuide } = input;
  const script = [visualGuide.hook, visualGuide.validasi, visualGuide.insight, visualGuide.actionCta]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return script || (visualGuide.konten ?? '').trim();
}

function composeImagePrompt(input: GenerateContentInput): string {
  if (input.imagePrompt?.trim()) return input.imagePrompt.trim();
  const { dna, visualGuide } = input;
  const subject = joinParts(
    visualGuide.visualFocus,
    visualGuide.hook,
    visualGuide.videoStyle,
    dna.visualStyle,
    dna.brandName ? `brand ${dna.brandName}` : undefined,
  );
  return joinParts(subject || 'cinematic brand storytelling scene', 'vertical 9:16 composition', 'cinematic lighting', 'highly detailed', 'photorealistic');
}

function composeBgmTags(input: GenerateContentInput): string {
  const { dna, visualGuide } = input;
  const mood = joinParts(visualGuide.sound, dna.tone) || 'cinematic, uplifting';
  return joinParts(mood, 'instrumental', 'no vocals');
}

function composeVoiceDescription(dna: DNAData): string {
  const tone = (dna.tone ?? '').trim();
  return tone
    ? `A warm, natural Indonesian narrator. Tone: ${tone}.`
    : 'A warm, natural Indonesian narrator.';
}

// ─── ComfyUI output helpers ───────────────────────────────────────────────────

/**
 * The one file a given terminal node produced. Addressed by node id, never by
 * position in a flattened list — graphs gain nodes and key order is not a contract.
 */
function requireOutputFile(
  comfy: ComfyUIClient,
  entry: ComfyHistoryEntry,
  nodeId: string,
  label: string,
): ComfyFileRef {
  const files = comfy.collectOutputFiles(entry, nodeId);
  if (files.length === 0) {
    throw new Error(
      `ComfyUI selesai tetapi tidak mengembalikan file ${label} dari node "${nodeId}". ` +
        `Periksa apakah node output pada workflow ${label} masih sesuai.`,
    );
  }
  return files[0];
}

/** Pull an output file out of ComfyUI and onto local disk for FFmpeg. */
async function downloadTo(
  comfy: ComfyUIClient,
  file: ComfyFileRef,
  dir: string,
  baseName: string,
): Promise<string> {
  const buffer = await comfy.downloadFile(file);
  const destination = path.join(dir, `${baseName}${path.extname(file.filename)}`);
  fs.writeFileSync(destination, buffer);
  return destination;
}

/**
 * Builds the ComfyFileRef for the .srt.
 *
 * `Save SRT` is not an OUTPUT node, so /history carries no file ref for it — only
 * a path string echoed through PreviewAny. The reference is therefore assembled
 * by hand from that string's basename (which keeps any counter suffix ComfyUI
 * added), falling back to the name we asked for.
 */
function resolveSrtRef(reportedPath: string | undefined): ComfyFileRef {
  const basename = (reportedPath ?? '').trim().split(/[\\/]/).pop() ?? '';
  const filename = basename.toLowerCase().endsWith('.srt') ? basename : `${SRT_BASE_NAME}.srt`;
  return { filename, subfolder: TRANSCRIPTION_SRT_SUBFOLDER, type: 'output' };
}

// ─── The pipeline ─────────────────────────────────────────────────────────────

export async function generateContentAction(
  input: GenerateContentInput,
): Promise<GenerateContentResult> {
  const warnings: string[] = [];
  const timestamp = Date.now();
  const workDir = path.join(os.tmpdir(), `venturo-gen-${timestamp}`);

  try {
    const script = composeNarration(input);
    if (!script) {
      return {
        success: false,
        message: 'Naskah narasi kosong. Isi Hook/Insight/CTA pada Visual Guide terlebih dahulu.',
        warnings,
      };
    }

    const comfy = new ComfyUIClient();
    if (!(await comfy.isReachable())) {
      return {
        success: false,
        message:
          'ComfyUI tidak dapat dihubungi. Jalankan ComfyUI di 127.0.0.1:8188 ' +
          '(atau set COMFYUI_BASE_URL) lalu coba lagi.',
        warnings,
      };
    }

    const duration = videoDurationSeconds();
    const { text: narration, droppedWords } = budgetNarration(script, duration);
    if (droppedWords > 0) {
      warnings.push(
        `Naskah dipangkas ${droppedWords} kata agar muat dalam video ${duration.toFixed(1)} detik ` +
          `(${SVD_VIDEO_FRAMES} frame @ ${SVD_FPS}fps). Perpendek naskah atau pakai checkpoint SVD ` +
          `dengan frame lebih banyak.`,
      );
    }

    fs.mkdirSync(workDir, { recursive: true });

    // ── Stage 1: T2I on Cloudflare (unchanged provider), then hand the still to ComfyUI.
    const framePath = path.join(workDir, 'frame.png');
    const imageOk = await generateImageFromCloudflare(composeImagePrompt(input), framePath);
    if (!imageOk || !fs.existsSync(framePath)) {
      return {
        success: false,
        message:
          'Gagal membuat gambar awal via Cloudflare. Periksa CLOUDFLARE_IMAGE_API_URL dan CLOUDFLARE_IMAGE_API_KEY.',
        warnings,
      };
    }
    const frameUpload = await comfy.uploadFile(
      fs.readFileSync(framePath),
      `venturo_frame_${timestamp}.png`,
    );
    const frameName = frameUpload.subfolder
      ? `${frameUpload.subfolder}/${frameUpload.name}`
      : frameUpload.name;

    // ── Stage 2: narration (VoxCPM2). Awaited before anything else is queued.
    const narrationEntry = await comfy.runWorkflow(
      buildNarrationWorkflow({
        text: narration,
        voiceDescription: composeVoiceDescription(input.dna),
      }),
    );
    const narrationFile = requireOutputFile(comfy, narrationEntry, NARRATION_OUTPUT_NODE, 'narasi');
    const voicePath = await downloadTo(comfy, narrationFile, workDir, 'narration');

    // ── Stage 3: subtitles (Whisper). Needs the narration back inside ComfyUI's
    // input directory. Best-effort: dynamic_editor renders fine without an .srt,
    // and the Whisper node pack is the least verified part of the stack — a
    // failure here is reported as a warning rather than losing the whole run.
    let srtPath: string | undefined;
    try {
      const audioUpload = await comfy.uploadFile(
        fs.readFileSync(voicePath),
        `venturo_narration_${timestamp}${path.extname(voicePath)}`,
      );
      const audioName = audioUpload.subfolder
        ? `${audioUpload.subfolder}/${audioUpload.name}`
        : audioUpload.name;

      const transcriptionEntry = await comfy.runWorkflow(
        buildTranscriptionWorkflow({ audioName, srtName: SRT_BASE_NAME }),
      );
      const [reportedSrtPath] = comfy.collectOutputText(
        transcriptionEntry,
        TRANSCRIPTION_SRT_PATH_NODE,
      );
      srtPath = await downloadTo(comfy, resolveSrtRef(reportedSrtPath), workDir, 'subtitles');
    } catch (error) {
      warnings.push(
        `Subtitle dilewati: ${(error as Error).message}`,
      );
      srtPath = undefined;
    }

    // ── Stage 4: background music (ACE-Step), generated at the video's length.
    const musicEntry = await comfy.runWorkflow(
      buildMusicWorkflow({
        tags: input.bgmTags?.trim() || composeBgmTags(input),
        seconds: Math.max(1, Math.ceil(duration)),
      }),
    );
    const musicFile = requireOutputFile(comfy, musicEntry, MUSIC_OUTPUT_NODE, 'BGM');
    const bgmPath = await downloadTo(comfy, musicFile, workDir, 'bgm');

    // ── Stage 5: the picture (SVD). Heaviest model, queued last and alone.
    const videoEntry = await comfy.runWorkflow(
      buildImageToVideoWorkflow({
        imageName: frameName,
        width: SVD_WIDTH,
        height: SVD_HEIGHT,
        videoFrames: SVD_VIDEO_FRAMES,
        fps: SVD_FPS,
      }),
    );
    const videoFile = requireOutputFile(comfy, videoEntry, IMAGE_TO_VIDEO_OUTPUT_NODE, 'video');
    const videoPath = await downloadTo(comfy, videoFile, workDir, 'scene');

    // ── Stage 6: the edit — Ken Burns, ducked BGM, burned-in subtitles.
    const finalDir = path.join(process.cwd(), 'public', 'generations', 'final');
    const outputPath = path.join(finalDir, `final_${timestamp}.mp4`);
    await renderDynamicVideo({
      videoPath,
      voicePath,
      bgmPath,
      srtPath,
      outputPath,
      durationSeconds: duration,
    });

    return {
      success: true,
      message: 'Video berhasil dibuat!',
      videoUrl: `/generations/final/final_${timestamp}.mp4`,
      narration,
      durationSeconds: duration,
      warnings,
    };
  } catch (error: unknown) {
    console.error('[GenerateContent] Pipeline gagal:', error);
    return {
      success: false,
      message: (error as Error).message || 'Gagal membuat video.',
      warnings,
    };
  } finally {
    // Intermediates only; the finished mp4 lives under public/.
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[GenerateContent] Gagal membersihkan direktori sementara:', cleanupError);
    }
  }
}
