'use server';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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
import { scanAssets } from '@/lib/ffmpeg/probe';
import { createEditingBlueprint } from '@/lib/google/director';
import { renderDynamicVideo, stitchBlueprint } from '@/lib/ffmpeg/dynamic_editor';
import { generateAssFile, type WordTimestamp } from '@/lib/ffmpeg/subtitles';

export interface GenerateContentInput {
  dna: DNAData;
  visualGuide: VisualGuideData;
  assetFolder?: { id: string; name: string; remoteUrls?: { url: string; filename?: string }[] };
  narrationScript?: string;
  imagePrompt?: string;
  bgmTags?: string;
}

export interface GenerateContentResult {
  success: boolean;
  message: string;
  videoUrl?: string;
  narration?: string;
  durationSeconds?: number;
  warnings: string[];
}

function resolveVideoFrames(): number {
  const override = Math.trunc(Number(process.env.COMFYUI_SVD_VIDEO_FRAMES));
  if (Number.isFinite(override) && override > 0) return override;

  const checkpoint = (process.env.COMFYUI_SVD_CHECKPOINT ?? DEFAULT_SVD_CHECKPOINT).trim();
  const stem = checkpoint.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
  return /(^|[_\-.])xt([_\-.]|$)/i.test(stem) ? 25 : 14;
}

const SVD_VIDEO_FRAMES = resolveVideoFrames();
const SVD_FPS = 6;
const SVD_WIDTH = 576;
const SVD_HEIGHT = 1024;
const WORDS_PER_SECOND = 2.5;
const MAX_ASSET_BYTES = 500 * 1024 * 1024; // 500MB per remote B-Roll clip
const ASSET_FETCH_TIMEOUT_MS = 120_000;

function videoDurationSeconds(): number {
  return SVD_VIDEO_FRAMES / SVD_FPS;
}

function splitSentences(script: string): string[] {
  return (script.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

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

function requireOutputFile(
  comfy: ComfyUIClient,
  entry: ComfyHistoryEntry,
  nodeId: string,
  label: string,
): ComfyFileRef {
  const files = comfy.collectOutputFiles(entry, nodeId);
  if (files.length === 0) {
    throw new Error(`ComfyUI selesai tetapi tidak mengembalikan file ${label} dari node "${nodeId}".`);
  }
  return files[0];
}

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

function resolveSrtRef(reportedPath: string | undefined, fallbackName: string): ComfyFileRef {
  const basename = (reportedPath ?? '').trim().split(/[\\/]/).pop() ?? '';
  const filename = basename.toLowerCase().endsWith('.srt') ? basename : `${fallbackName}.srt`;
  return { filename, subfolder: TRANSCRIPTION_SRT_SUBFOLDER, type: 'output' };
}

function parseSrt(srtContent: string): WordTimestamp[] {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  const words: WordTimestamp[] = [];
  
  const timeToSec = (timeStr: string) => {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) + (Number(ms) || 0) / 1000;
  };
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    const timeLine = lines[1];
    const match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!match) continue;
    
    const startSec = timeToSec(match[1]);
    const endSec = timeToSec(match[2]);
    const text = lines.slice(2).join(' ').trim();
    
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const secPerWord = (endSec - startSec) / tokens.length;
    
    for (let i = 0; i < tokens.length; i++) {
      words.push({
        word: tokens[i],
        start: startSec + i * secPerWord,
        end: startSec + (i + 1) * secPerWord
      });
    }
  }
  return words;
}

export async function generateContentAction(
  input: GenerateContentInput,
): Promise<GenerateContentResult> {
  const warnings: string[] = [];
  const timestamp = Date.now();
  const workDir = path.join(os.tmpdir(), `venturo-gen-${timestamp}`);

  try {
    const comfy = new ComfyUIClient();
    if (!(await comfy.isReachable())) {
      return {
        success: false,
        message: 'ComfyUI tidak dapat dihubungi. Jalankan ComfyUI di 127.0.0.1:8188 (atau set COMFYUI_BASE_URL) lalu coba lagi.',
        warnings,
      };
    }

    fs.mkdirSync(workDir, { recursive: true });

    // 1. Scan b-roll
    let bRollDir = path.join(process.cwd(), 'public', 'b-roll'); // Fallback
    let assets: any[] = [];

    // If user selected a folder with remote URLs, download them to a temp folder
    const remoteUrls = input.assetFolder?.remoteUrls ?? [];
    if (input.assetFolder) {
      if (remoteUrls.length === 0) {
        warnings.push(
          `Folder "${input.assetFolder.name}" tidak memiliki aset tersinkronisasi. Sinkronkan dari Spreadsheet terlebih dahulu.`,
        );
      } else {
        bRollDir = path.join(workDir, 'b-roll');
        fs.mkdirSync(bRollDir, { recursive: true });

        let attempted = 0;
        let downloaded = 0;

        // Sequential on purpose: keeps this run's resource usage predictable
        // alongside the strictly-serial ComfyUI queueing later in this action.
        for (let i = 0; i < remoteUrls.length; i++) {
          const task = remoteUrls[i];
          if (!task.url.trim()) continue;
          attempted++;

          let destination: string | undefined;
          try {
            const response = await fetch(task.url, {
              signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
            });
            if (!response.ok) {
              console.error('Failed to download asset:', task.url, `HTTP ${response.status}`);
              continue;
            }

            const contentType = response.headers.get('content-type') ?? '';
            if (!/^(video\/|application\/octet-stream)/i.test(contentType)) {
              warnings.push(
                `Aset "${task.filename || task.url}" dilewati: server mengembalikan ${contentType || 'tipe tidak dikenal'}. Pastikan URL Google Drive adalah tautan unduhan langsung.`,
              );
              continue;
            }

            const contentLength = Number(response.headers.get('content-length'));
            if (Number.isFinite(contentLength) && contentLength > MAX_ASSET_BYTES) {
              warnings.push(
                `Aset "${task.filename || task.url}" dilewati: ukuran ${(contentLength / (1024 * 1024)).toFixed(0)}MB melebihi batas ${(MAX_ASSET_BYTES / (1024 * 1024)).toFixed(0)}MB.`,
              );
              continue;
            }

            if (!response.body) {
              console.error('Failed to download asset:', task.url, 'respons tidak memiliki body');
              continue;
            }

            let filename = task.filename || `clip_${i}.mp4`;
            if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(filename)) filename += '.mp4';

            const safeName = `${i}_${path.basename(filename)}`;
            destination = path.join(bRollDir, safeName);

            await pipeline(
              Readable.fromWeb(response.body as any),
              fs.createWriteStream(destination),
            );
            downloaded++;
          } catch (e) {
            console.error('Failed to download asset:', task.url, e);
            if (destination) fs.rmSync(destination, { force: true });
          }
        }

        if (attempted > 0 && downloaded < attempted) {
          warnings.push(
            `${attempted - downloaded} dari ${attempted} aset di folder "${input.assetFolder.name}" gagal diunduh dan dilewati.`,
          );
        }
      }
    }

    if (fs.existsSync(bRollDir)) {
      assets = await scanAssets(bRollDir);
    }

    const useBRollPath = assets.length > 0;

    if (input.assetFolder && remoteUrls.length > 0 && assets.length === 0) {
      warnings.push(
        `Tidak ada aset valid ditemukan dari folder "${input.assetFolder.name}" setelah diunduh. Pipeline beralih ke mode gambar tunggal (SVD).`,
      );
    }

    let duration = 0;
    let narrationText = '';
    let blueprint: any = null;
    let frameName = '';

    if (useBRollPath) {
      // ── Stage B-Roll 1: Blueprint
      const contextStr = JSON.stringify({ dna: input.dna, guide: input.visualGuide });
      blueprint = await createEditingBlueprint(contextStr, assets);
      
      // Fix blueprint timeline paths
      blueprint.timeline.forEach((clip: any) => {
        clip.file = path.join(bRollDir, path.basename(clip.file));
        duration += clip.duration;
      });
      narrationText = blueprint.tts_script;
      
    } else {
      // ── Stage SVD 1: Narration script setup and Cloudflare T2I
      const script = composeNarration(input);
      if (!script) {
        return {
          success: false,
          message: 'Naskah narasi kosong. Isi Hook/Insight/CTA pada Visual Guide terlebih dahulu.',
          warnings,
        };
      }
      duration = videoDurationSeconds();
      const { text: budgetedNarration, droppedWords } = budgetNarration(script, duration);
      narrationText = budgetedNarration;
      if (droppedWords > 0) {
        warnings.push(
          `Naskah dipangkas ${droppedWords} kata agar muat dalam video ${duration.toFixed(1)} detik ` +
            `(${SVD_VIDEO_FRAMES} frame @ ${SVD_FPS}fps). Perpendek naskah atau pakai checkpoint SVD ` +
            `dengan frame lebih banyak.`,
        );
      }
      warnings.push(
        `Panjang narasi diperkirakan dari asumsi ${WORDS_PER_SECOND} kata/detik dan belum pernah ` +
          `diukur dari VoxCPM2. Jika TTS bicara lebih lambat, ekor narasi akan terpotong saat render.`,
      );

      const framePath = path.join(workDir, 'frame.png');
      const imageOk = await generateImageFromCloudflare(composeImagePrompt(input), framePath);
      if (!imageOk || !fs.existsSync(framePath)) {
        return {
          success: false,
          message: 'Gagal membuat gambar awal via Cloudflare. Periksa CLOUDFLARE_IMAGE_API_URL dan CLOUDFLARE_IMAGE_API_KEY.',
          warnings,
        };
      }
      const frameUpload = await comfy.uploadFile(
        fs.readFileSync(framePath),
        `venturo_frame_${timestamp}.png`,
      );
      frameName = frameUpload.subfolder
        ? `${frameUpload.subfolder}/${frameUpload.name}`
        : frameUpload.name;
    }

    // ── Stage 2: Narration (VoxCPM2)
    const narrationEntry = await comfy.runWorkflow(
      buildNarrationWorkflow({
        text: narrationText,
        voiceDescription: composeVoiceDescription(input.dna),
      }),
    );
    const narrationFile = requireOutputFile(comfy, narrationEntry, NARRATION_OUTPUT_NODE, 'narasi');
    const voicePath = await downloadTo(comfy, narrationFile, workDir, 'narration');

    // ── Stage 3: Subtitles (Whisper & ASS generation)
    let srtPath: string | undefined;
    const assPath = path.join(workDir, 'subtitles.ass');
    const srtName = `venturo_subtitles_${timestamp}`;
    const audioUpload = await comfy.uploadFile(
      fs.readFileSync(voicePath),
      `venturo_narration_${timestamp}${path.extname(voicePath)}`,
    );
    const audioName = audioUpload.subfolder
      ? `${audioUpload.subfolder}/${audioUpload.name}`
      : audioUpload.name;

    try {
      const transcriptionPromptId = await comfy.queuePrompt(
        buildTranscriptionWorkflow({ audioName, srtName }),
      );
      if (transcriptionPromptId) {
        const transcriptionEntry = await comfy.waitForPrompt(transcriptionPromptId);
        const [reportedSrtPath] = comfy.collectOutputText(
          transcriptionEntry,
          TRANSCRIPTION_SRT_PATH_NODE,
        );
        srtPath = await downloadTo(
          comfy,
          resolveSrtRef(reportedSrtPath, srtName),
          workDir,
          'subtitles',
        );
        const srtContent = fs.readFileSync(srtPath, 'utf8');
        const words = parseSrt(srtContent);
        generateAssFile(words, assPath);
      }
    } catch (error) {
      warnings.push(`Subtitle dilewati atau gagal: ${describeError(error)}`);
    }

    if (!fs.existsSync(assPath)) {
      generateAssFile([], assPath);
    }

    // ── Stage 4: Background music (ACE-Step)
    const bgmPromptStr = useBRollPath && blueprint ? blueprint.bgm_prompt : (input.bgmTags?.trim() || composeBgmTags(input));
    const musicEntry = await comfy.runWorkflow(
      buildMusicWorkflow({
        tags: bgmPromptStr,
        seconds: Math.max(1, Math.ceil(duration)),
      }),
    );
    const musicFile = requireOutputFile(comfy, musicEntry, MUSIC_OUTPUT_NODE, 'BGM');
    const bgmPath = await downloadTo(comfy, musicFile, workDir, 'bgm');

    // ── Stage 5: Render
    const finalDir = path.join(process.cwd(), 'public', 'generations', 'final');
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    const outputPath = path.join(finalDir, `final_${timestamp}.mp4`);

    if (useBRollPath) {
      await stitchBlueprint(blueprint, voicePath, bgmPath, assPath, outputPath);
    } else {
      // ── Stage SVD 5: The picture (SVD)
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

      await renderDynamicVideo({
        videoPath,
        voicePath,
        bgmPath,
        assPath,
        outputPath,
        durationSeconds: duration,
      });
    }

    return {
      success: true,
      message: 'Video berhasil dibuat!',
      videoUrl: `/generations/final/final_${timestamp}.mp4`,
      narration: narrationText,
      durationSeconds: duration,
      warnings,
    };
  } catch (error: unknown) {
    console.error('[GenerateContent] Pipeline gagal:', error);
    return {
      success: false,
      message: `Gagal membuat video. ${describeError(error)}`,
      warnings,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[GenerateContent] Gagal membersihkan direktori sementara:', cleanupError);
    }
  }
}
