import { GoogleGenAI } from '@google/genai';
import { AssetMetadata } from '../ffmpeg/probe';
import path from 'path';

export interface DirectorBlueprint {
  tts_script: string;
  bgm_prompt: string;
  timeline: { file: string; duration: number; start?: number }[];
}

export async function createEditingBlueprint(context: string, assets: AssetMetadata[]): Promise<DirectorBlueprint> {
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
  
  const cleanedText = response.text?.replace(/^```(?:json)?\s*|\s*```$/g, '').trim() || '{}';
  return JSON.parse(cleanedText);
}

