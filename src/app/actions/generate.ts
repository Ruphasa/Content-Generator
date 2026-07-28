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
import {
  ComfyUIClient,
  ComfyUIError,
  type ComfyFileRef,
  type ComfyHistoryEntry,
} from '@/lib/comfyui/client';
import {
  DEFAULT_SVD_CHECKPOINT,
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

/**
 * Frames the configured SVD checkpoint is built for. Every extra frame is bought
 * duration, so take the 25 when the checkpoint supports it.
 *
 * The pairing is the contract `workflows.ts` documents from the checkpoints
 * themselves — 14 for `svd.safetensors`, 25 for `svd_xt.safetensors` — so it is
 * derived from the checkpoint name rather than assumed. `video_frames` is a plain
 * INT widget, so ComfyUI will not reject 25 on the 14-frame checkpoint; it simply
 * produces a worse clip, which is why this is not defaulted to 25 blindly.
 * `COMFYUI_SVD_VIDEO_FRAMES` overrides for checkpoints named something else.
 */
function resolveVideoFrames(): number {
  const override = Math.trunc(Number(process.env.COMFYUI_SVD_VIDEO_FRAMES));
  if (Number.isFinite(override) && override > 0) return override;

  const checkpoint = (process.env.COMFYUI_SVD_CHECKPOINT ?? DEFAULT_SVD_CHECKPOINT).trim();
  const stem = checkpoint.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
  // Matches svd_xt, svd_xt_1_1, svd-xt … without matching e.g. svd_next.
  return /(^|[_\-.])xt([_\-.]|$)/i.test(stem) ? 25 : 14;
}

/** Frames SVD will produce. Must match the checkpoint: 14 = svd, 25 = svd_xt. */
const SVD_VIDEO_FRAMES = resolveVideoFrames();
/**
 * Playback + conditioning frame rate for SVD. The builder feeds this to both
 * `SVD_img2vid_Conditioning` and `CreateVideo`, so it also divides the clip
 * length — 6 is the low end of SVD's conditioning range and therefore the
 * longest clip the frame budget can buy.
 */
const SVD_FPS = 6;
/**
 * Portrait 9:16, so the SVD frame matches the 1080x1920 render target.
 *
 * This is a tradeoff, not a free win: SVD is trained at 1024x576 landscape, so
 * 576x1024 is off-distribution and typically gives weaker, less coherent motion.
 * It is still the right call here because the alternative is generating landscape
 * and letting `dynamic_editor` crop ~44% of the frame width away — that discards
 * the subject as often as not, and the Ken Burns push then works on what little
 * survives. Weaker motion over the right subject beats good motion over a
 * mis-framed one. Revisit if a portrait-tuned SVD checkpoint is installed.
 */
const SVD_WIDTH = 576;
const SVD_HEIGHT = 1024;

/**
 * ASSUMPTION, NOT A MEASUREMENT. Bahasa Indonesia speaking rate used to predict
 * how long a script will take VoxCPM2 to read. 2.5 is the rate the existing AI
 * Director route already assumes (`Math.round(targetDuration * 2.5)` in
 * src/app/api/generate/director/route.ts); nobody has measured VoxCPM2's actual
 * pace, and there is no ffprobe in this project to measure the rendered audio.
 *
 * It is the only thing standing between a full narration and `dynamic_editor`'s
 * `-shortest`, so every run reports it as an assumption in `warnings` — an
 * operator should learn the estimate is shakier than it looks here, not from a
 * truncation warning buried in the render log.
 */
const WORDS_PER_SECOND = 2.5;

const SRT_BASE_NAME = 'venturo_subtitles';

function videoDurationSeconds(): number {
  return SVD_VIDEO_FRAMES / SVD_FPS;
}

/** Sentences, keeping their terminator; a trailing fragment counts as one. */
function splitSentences(script: string): string[] {
  return (script.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Cuts the script down to what fits `seconds` of speech, preferring the last
 * complete sentence that fits. A mid-sentence guillotine reads as a broken clip;
 * a short but finished sentence at least reads as deliberate. Falls back to a
 * hard word slice only when even the first sentence overruns the budget.
 */
function budgetNarration(script: string, seconds: number): { text: string; droppedWords: number } {
  const trimmed = script.trim();
  const totalWords = countWords(trimmed);
  const maxWords = Math.max(1, Math.round(seconds * WORDS_PER_SECOND));
  if (totalWords <= maxWords) {
    return { text: trimmed.split(/\s+/).filter(Boolean).join(' '), droppedWords: 0 };
  }

  const kept: string[] = [];
  let keptWords = 0;
  for (const sentence of splitSentences(trimmed)) {
    const words = countWords(sentence);
    if (keptWords + words > maxWords) break;
    kept.push(sentence);
    keptWords += words;
  }
  if (kept.length > 0) {
    return { text: kept.join(' '), droppedWords: totalWords - keptWords };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  return { text: words.slice(0, maxWords).join(' '), droppedWords: totalWords - maxWords };
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
 * A message an operator can act on.
 *
 * Two things matter here. A thrown non-Error would otherwise stringify to the
 * literal "undefined" via `.message`, and `ComfyUIError.details` carries
 * ComfyUI's `node_errors` — which, for the two node packs `workflows.ts` marks
 * UNVERIFIED-PENDING-INSTALL, is exactly the payload that names the missing class
 * or the wrong input key. Dropping it turns a five-second fix into a hunt.
 */
function describeError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)) || 'Kesalahan tidak diketahui.';
  if (!(error instanceof ComfyUIError) || error.details === undefined) return message;
  let details: string;
  try {
    details = JSON.stringify(error.details);
  } catch {
    details = String(error.details);
  }
  return `${message} — detail ComfyUI: ${details}`;
}

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
    // Reported on every run, not only when the script was cut: the fit is a
    // prediction, and if VoxCPM2 speaks slower than assumed the render will drop
    // the tail of even an "already fitting" script.
    warnings.push(
      `Panjang narasi diperkirakan dari asumsi ${WORDS_PER_SECOND} kata/detik dan belum pernah ` +
        `diukur dari VoxCPM2. Jika TTS bicara lebih lambat, ekor narasi akan terpotong saat render.`,
    );

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
    // input directory, because LoadAudio reads from there and not from our disk.
    //
    // Exactly one thing here is soft: ComfyUI REJECTING the graph. Validation
    // happens at POST /prompt, so an uninstalled `Apply Whisper` / `Save SRT` — the
    // two classes workflows.ts marks UNVERIFIED-PENDING-INSTALL — fails there, in a
    // second, with node_errors naming the culprit. That case degrades to a warning
    // and a render without captions, which dynamic_editor supports.
    //
    // Everything else stays fatal by design. Local file I/O, the upload, the /view
    // download and above all `waitForPrompt` are outside the catch: a hung Whisper
    // graph must surface as its real 10-minute timeout, not as a shrug.
    let srtPath: string | undefined;
    const audioUpload = await comfy.uploadFile(
      fs.readFileSync(voicePath),
      `venturo_narration_${timestamp}${path.extname(voicePath)}`,
    );
    const audioName = audioUpload.subfolder
      ? `${audioUpload.subfolder}/${audioUpload.name}`
      : audioUpload.name;

    let transcriptionPromptId: string | undefined;
    try {
      transcriptionPromptId = await comfy.queuePrompt(
        buildTranscriptionWorkflow({ audioName, srtName: SRT_BASE_NAME }),
      );
    } catch (error) {
      warnings.push(
        `Subtitle dilewati, ComfyUI menolak workflow transkripsi ` +
          `(kemungkinan node Whisper belum terpasang): ${describeError(error)}`,
      );
    }

    if (transcriptionPromptId) {
      const transcriptionEntry = await comfy.waitForPrompt(transcriptionPromptId);
      const [reportedSrtPath] = comfy.collectOutputText(
        transcriptionEntry,
        TRANSCRIPTION_SRT_PATH_NODE,
      );
      srtPath = await downloadTo(comfy, resolveSrtRef(reportedSrtPath), workDir, 'subtitles');
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
      // describeError, not `.message`: it survives non-Error throws and carries
      // ComfyUI's node_errors through to the operator.
      message: `Gagal membuat video. ${describeError(error)}`,
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
