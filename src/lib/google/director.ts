import { GoogleGenAI } from '@google/genai';
import { AssetMetadata } from '../ffmpeg/probe';
import path from 'path';

/** How much of an unusable model response is quoted back in an error message. */
const MAX_ERROR_SNIPPET_CHARS = 200;

export interface ScriptAndBgmBlueprint {
  tts_script: string;
  bgm_prompt: string;
}

export interface TimelineBlueprint {
  timeline: { file: string; duration: number; start: number }[];
}

export interface DirectorBlueprint {
  tts_script: string;
  bgm_prompt: string;
  timeline: { file: string; duration: number; start?: number }[];
}

function validateScriptAndBgm(parsed: unknown): ScriptAndBgmBlueprint {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI Director mengembalikan output yang bukan objek JSON.');
  }
  const raw = parsed as Record<string, unknown>;

  const ttsScript = typeof raw.tts_script === 'string' ? raw.tts_script.trim() : '';
  if (!ttsScript) {
    throw new Error('AI Director tidak mengembalikan "tts_script" yang valid untuk voiceover.');
  }

  const bgmPrompt = typeof raw.bgm_prompt === 'string' && raw.bgm_prompt.trim()
    ? raw.bgm_prompt.trim()
    : 'cinematic, instrumental, no vocals';

  return { tts_script: ttsScript, bgm_prompt: bgmPrompt };
}

function validateTimeline(parsed: unknown): TimelineBlueprint {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI Director mengembalikan output yang bukan objek JSON.');
  }
  const raw = parsed as Record<string, unknown>;

  if (!Array.isArray(raw.timeline) || raw.timeline.length === 0) {
    throw new Error(
      'AI Director tidak mengembalikan "timeline" yang valid (harus berupa array dan tidak boleh kosong). ' +
        `Cuplikan respons: ${JSON.stringify(raw).slice(0, MAX_ERROR_SNIPPET_CHARS)}`,
    );
  }

  const timeline = raw.timeline.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`AI Director mengembalikan klip timeline #${index + 1} yang bukan objek.`);
    }
    const clip = entry as Record<string, unknown>;

    const file = typeof clip.file === 'string' ? clip.file.trim() : '';
    if (!file) {
      throw new Error(`AI Director tidak menyebutkan "file" pada klip timeline #${index + 1}.`);
    }

    const duration = Number(clip.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(
        `AI Director mengembalikan "duration" tidak valid (${JSON.stringify(clip.duration)}) pada klip timeline #${index + 1}.`,
      );
    }

    const start = clip.start === undefined || clip.start === null ? 0 : Number(clip.start);
    if (!Number.isFinite(start) || start < 0) {
      throw new Error(
        `AI Director mengembalikan "start" tidak valid (${JSON.stringify(clip.start)}) pada klip timeline #${index + 1}.`,
      );
    }

    return { file, duration, start };
  });

  return { timeline };
}

export async function generateScriptAndBgm(context: string): Promise<ScriptAndBgmBlueprint> {
  console.log('[AI Director Phase 1] Meracik naskah & BGM prompt via Gemini 2.5 Flash...');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY });
  
  const prompt = `You are an expert Video Director. We need to create a voiceover script and background music style for a short video.

Context: ${context}
Create a voiceover script (~15-20s) and a BGM prompt.
Return ONLY valid JSON format:
{
  "tts_script": "text",
  "bgm_prompt": "upbeat lo-fi"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const cleanedText = response.text?.replace(/^```(?:json)?\s*|\s*|\s*```$/g, '').trim() || '';
  if (!cleanedText) {
    throw new Error(
      'AI Director Phase 1 tidak mengembalikan jawaban (respons kosong atau diblokir). Coba lagi atau periksa GEMINI_API_KEY.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      `AI Director Phase 1 mengembalikan JSON tidak valid. Cuplikan respons: ${cleanedText.slice(0, MAX_ERROR_SNIPPET_CHARS)}`,
    );
  }

  return validateScriptAndBgm(parsed);
}

export async function generateTimeline(targetDuration: number, assets: AssetMetadata[]): Promise<TimelineBlueprint> {
  console.log('[AI Director Phase 2] Meracik timeline editing video via Gemini 2.5 Flash...');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY });
  const assetInfo = assets.map(a => `${path.basename(a.file)} (Duration: ${a.duration}s)`).join('\n');
  
  const prompt = `You are an expert Video Editor. We have these B-Roll clips:
${assetInfo}

We need to create an exact video editing timeline.
Total sum of all clip durations MUST equal EXACTLY ${targetDuration} seconds.
You can trim or reuse clips. Do not exceed the original clip's duration in a single cut.
Return ONLY valid JSON format:
{
  "timeline": [ { "file": "path/to/clip1.mp4", "start": 0, "duration": 4 } ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const cleanedText = response.text?.replace(/^```(?:json)?\s*|\s*|\s*```$/g, '').trim() || '';
  if (!cleanedText) {
    throw new Error(
      'AI Director Phase 2 tidak mengembalikan jawaban (respons kosong atau diblokir). Coba lagi atau periksa GEMINI_API_KEY.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      `AI Director Phase 2 mengembalikan JSON tidak valid. Cuplikan respons: ${cleanedText.slice(0, MAX_ERROR_SNIPPET_CHARS)}`,
    );
  }

  return validateTimeline(parsed);
}
