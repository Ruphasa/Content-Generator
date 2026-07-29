import { GoogleGenAI } from '@google/genai';
import { AssetMetadata } from '../ffmpeg/probe';
import path from 'path';

export interface DirectorBlueprint {
  tts_script: string;
  bgm_prompt: string;
  timeline: { file: string; duration: number; start?: number }[];
}

/** How much of an unusable model response is quoted back in an error message. */
const MAX_ERROR_SNIPPET_CHARS = 200;

/**
 * Validates and normalises raw model output into a `DirectorBlueprint`.
 *
 * Model output is untrusted input: `start` / `duration` are interpolated
 * straight into the FFmpeg filtergraph downstream, so a value like
 * `"4 seconds"` would malform the graph at the very last stage. Rejecting here
 * turns a cryptic late failure into an early, explicit one.
 *
 * @throws Error (pesan berbahasa Indonesia) when the blueprint is unusable.
 */
function validateBlueprint(parsed: unknown): DirectorBlueprint {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI Director mengembalikan blueprint yang bukan objek JSON.');
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

  const ttsScript = typeof raw.tts_script === 'string' ? raw.tts_script.trim() : '';
  if (!ttsScript) {
    throw new Error('AI Director tidak mengembalikan "tts_script" yang valid untuk voiceover.');
  }

  const bgmPrompt = typeof raw.bgm_prompt === 'string' && raw.bgm_prompt.trim()
    ? raw.bgm_prompt.trim()
    : 'cinematic, instrumental, no vocals';

  return { tts_script: ttsScript, bgm_prompt: bgmPrompt, timeline };
}

/**
 * Asks Gemini 2.5 Flash to plan a B-Roll edit: a voiceover script, a BGM prompt,
 * and an exact cut timeline over the supplied clips.
 *
 * @param context  JSON-stringified brand DNA + visual guide context.
 * @param assets   Probed B-Roll clips available to the editor.
 * @returns A validated blueprint with numeric `start` / `duration` on every clip.
 * @throws Error (pesan berbahasa Indonesia) when the model response is unusable.
 */
export async function createEditingBlueprint(context: string, assets: AssetMetadata[]): Promise<DirectorBlueprint> {
  console.log('[AI Director] Meracik blueprint editing B-Roll & narasi via Gemini 2.5 Flash...');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY });
  const assetInfo = assets.map(a => `${path.basename(a.file)} (Duration: ${a.duration}s)`).join('\n');
  
  const prompt = `You are an expert Video Director. We have these B-Roll clips:
${assetInfo}

Context: ${context}
Create a voiceover script (~15-20s) and an exact video editing timeline. 
You can trim or reuse clips to match the voiceover length exactly. Do not exceed the original clip's duration in a single cut.
Return ONLY valid JSON format:
{
  "tts_script": "text",
  "bgm_prompt": "upbeat lo-fi",
  "timeline": [ { "file": "path/to/clip1.mp4", "start": 0, "duration": 4 } ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const cleanedText = response.text?.replace(/^```(?:json)?\s*|\s*```$/g, '').trim() || '';
  if (!cleanedText) {
    throw new Error(
      'AI Director tidak mengembalikan jawaban (respons Gemini kosong atau diblokir). Coba lagi atau periksa GEMINI_API_KEY.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      `AI Director mengembalikan JSON tidak valid. Cuplikan respons: ${cleanedText.slice(0, MAX_ERROR_SNIPPET_CHARS)}`,
    );
  }

  return validateBlueprint(parsed);
}

