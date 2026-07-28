'use server';

import fs from 'fs';
import os from 'os';
import path from 'path';

import type { DNAData, VisualGuideData } from '@/components/ClientLayout';
import {
  ComfyUIClient,
  ComfyUIError,
  type ComfyFileRef,
  type ComfyHistoryEntry,
} from '@/lib/comfyui/client';
import {
  MUSIC_OUTPUT_NODE,
  NARRATION_OUTPUT_NODE,
  TRANSCRIPTION_SRT_PATH_NODE,
  TRANSCRIPTION_SRT_SUBFOLDER,
  buildMusicWorkflow,
  buildNarrationWorkflow,
  buildTranscriptionWorkflow,
} from '@/lib/comfyui/workflows';
import { scanAssets } from '@/lib/ffmpeg/probe';
import { createEditingBlueprint } from '@/lib/google/director';
import { stitchBlueprint } from '@/lib/ffmpeg/dynamic_editor';
import { generateAssFile, type WordTimestamp } from '@/lib/ffmpeg/subtitles';

export interface GenerateContentInput {
  dna: DNAData;
  visualGuide: VisualGuideData;
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
        message: 'ComfyUI tidak dapat dihubungi.',
        warnings,
      };
    }

    fs.mkdirSync(workDir, { recursive: true });

    // 1. Scan b-roll
    const bRollDir = path.join(process.cwd(), 'public', 'b-roll');
    if (!fs.existsSync(bRollDir)) {
       return { success: false, message: 'b-roll directory not found', warnings };
    }
    const assets = await scanAssets(bRollDir);
    if (assets.length === 0) {
      return { success: false, message: 'No B-Roll assets found in ' + bRollDir, warnings };
    }

    // 2. Blueprint
    const contextStr = JSON.stringify({ dna: input.dna, guide: input.visualGuide });
    const blueprint = await createEditingBlueprint(contextStr, assets);
    
    // Fix blueprint timeline paths
    let duration = 0;
    blueprint.timeline.forEach(clip => {
      clip.file = path.join(bRollDir, path.basename(clip.file));
      duration += clip.duration;
    });

    // 3. Narration
    const narrationEntry = await comfy.runWorkflow(
      buildNarrationWorkflow({
        text: blueprint.tts_script,
        voiceDescription: composeVoiceDescription(input.dna),
      }),
    );
    const narrationFile = requireOutputFile(comfy, narrationEntry, NARRATION_OUTPUT_NODE, 'narasi');
    const voicePath = await downloadTo(comfy, narrationFile, workDir, 'narration');

    // 4. Subtitles
    let srtPath: string | undefined;
    let assPath = path.join(workDir, 'subtitles.ass');
    
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
    } catch (error) {
      warnings.push(`Subtitle gagal: ${describeError(error)}`);
      if (!fs.existsSync(assPath)) {
        generateAssFile([], assPath);
      }
    }

    if (!fs.existsSync(assPath)) {
       generateAssFile([], assPath);
    }

    // 5. BGM
    const musicEntry = await comfy.runWorkflow(
      buildMusicWorkflow({
        tags: blueprint.bgm_prompt,
        seconds: Math.max(1, Math.ceil(duration)),
      }),
    );
    const musicFile = requireOutputFile(comfy, musicEntry, MUSIC_OUTPUT_NODE, 'BGM');
    const bgmPath = await downloadTo(comfy, musicFile, workDir, 'bgm');

    // 6. Stitch
    const finalDir = path.join(process.cwd(), 'public', 'generations', 'final');
    const outputPath = path.join(finalDir, `final_${timestamp}.mp4`);
    await stitchBlueprint(blueprint, voicePath, bgmPath, assPath, outputPath);

    return {
      success: true,
      message: 'Video berhasil dibuat!',
      videoUrl: `/generations/final/final_${timestamp}.mp4`,
      narration: blueprint.tts_script,
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
