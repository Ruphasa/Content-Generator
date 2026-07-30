import { GoogleGenAI } from '@google/genai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import type { DNAData, VisualGuideData } from '@/components/ClientLayout';

export interface DirectorPlanResult {
  imagePrompt: string;
  narrationScript: string;
  bgmTags: string;
  /**
   * True when no LLM produced a usable plan and the hand-assembled template was
   * returned instead. Call sites should surface this to the user — a silent
   * downgrade (e.g. a typo'd API-key env var) otherwise degrades every
   * generation forever with no signal at all.
   */
  usedFallback: boolean;
  /** Indonesian explanation of why the fallback ran; only set when `usedFallback`. */
  fallbackReason?: string;
}

/**
 * Asks an LLM (Gemini 2.5 Flash, falling back to Groq) to plan the image prompt,
 * narration script and BGM tags for a Skenario 1 single-image generation.
 *
 * Never throws: on any failure it returns a hand-assembled plan built from the
 * Visual Guide fields with `usedFallback: true` and a `fallbackReason`.
 */
export async function generateDirectorPlan(input: {
  dna: DNAData;
  visualGuide: VisualGuideData;
}): Promise<DirectorPlanResult> {
  const { dna, visualGuide } = input;

  const systemInstruction = `
Kamu adalah AI Video Director profesional & Copywriter untuk brand "${dna.brandName || 'Venturo'}".
Tugasmu adalah meracik 3 komponen penting untuk produksi video pendek 9:16:

1. IMAGE_PROMPT: Deskripsi visual berbahasa Inggris yang sangat detail untuk generator gambar (Cloudflare T2I / SDXL). Gambar ini akan dianimasikan oleh Stable Video Diffusion.
   - Harus mencerminkan identitas Brand DNA: ${dna.brandName}, overview: ${dna.brandOverview || ''}, visual style: ${dna.visualStyle || ''}, tone: ${dna.tone || ''}.
   - Visual Focus: ${visualGuide.visualFocus || ''}.
   - Gunakan format 9:16 vertical composition, 8k resolution, cinematic lighting.

2. NARRATION_SCRIPT: Naskah Voice Over berbahasa Indonesia yang mengalir, alami, dan menarik.
   - Gabungkan poin Hook (${visualGuide.hook || ''}), Validasi (${visualGuide.validasi || ''}), Insight (${visualGuide.insight || ''}), dan CTA (${visualGuide.actionCta || ''}) menjadi narasi yang smooth.

3. BGM_TAGS: Tag deskripsi musik instrumental singkat berbahasa Inggris untuk ACE-Step.
   - Mood: ${visualGuide.sound || ''}, Tone: ${dna.tone || ''}.

Output WAJIB berupa JSON valid saja tanpa markdown/penjelasan tambahan, format:
{
  "imagePrompt": "...",
  "narrationScript": "...",
  "bgmTags": "..."
}
`;

  let responseText = '';
  let fallbackReason = '';

  // 1. Try Gemini 2.5 Flash via @google/genai first
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemInstruction,
      });
      if (response.text) {
        responseText = response.text;
      }
    } catch (geminiError) {
      console.warn('Gemini 2.5 Flash Director call failed, trying Groq fallback:', geminiError);
      fallbackReason = `Panggilan Gemini gagal: ${(geminiError as Error)?.message ?? geminiError}`;
    }
  }

  // 2. Try Groq fallback if Gemini did not return text
  const groqKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
  if (!responseText) {
    if (groqKey) {
      try {
        const groq = createGroq({ apiKey: groqKey });
        const { text } = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          prompt: systemInstruction,
        });
        responseText = text;
      } catch (groqError) {
        console.error('Groq AI Director call also failed:', groqError);
        fallbackReason = `Panggilan Groq gagal: ${(groqError as Error)?.message ?? groqError}`;
      }
    }
  }

  // No key at all means the AI Director never ran. This is a configuration
  // problem, not a transient one, and it must not pass silently.
  if (!geminiKey && !groqKey) {
    fallbackReason =
      'Tidak ada API key LLM yang dikonfigurasi (GEMINI_API_KEY / GOOGLE_GENAI_API_KEY atau GROQ_API_KEY / LLM_API_KEY).';
  }

  // 3. Parse JSON response or fallback object
  if (responseText) {
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      const jsonString = match ? match[0] : responseText;
      const parsed = JSON.parse(jsonString);
      const imagePrompt = typeof parsed?.imagePrompt === 'string' ? parsed.imagePrompt : '';
      const narrationScript = typeof parsed?.narrationScript === 'string' ? parsed.narrationScript : '';
      const bgmTags = typeof parsed?.bgmTags === 'string' ? parsed.bgmTags : '';

      return {
        imagePrompt: imagePrompt || `${visualGuide.visualFocus || 'Modern software development scene'}, brand ${dna.brandName || ''}, 9:16 vertical composition, cinematic lighting`,
        narrationScript: narrationScript || visualGuide.hook || '',
        bgmTags: bgmTags || `${visualGuide.sound || 'upbeat tech'}, instrumental`,
        usedFallback: false,
      };
    } catch (parseError) {
      console.error('Failed to parse AI Director JSON output:', parseError);
      fallbackReason = `Respons LLM bukan JSON valid: ${(parseError as Error)?.message ?? parseError}`;
    }
  }

  // 4. Pure fallback if both LLMs failed
  const reason = fallbackReason || 'LLM tidak mengembalikan jawaban yang dapat dipakai.';
  console.warn(`[AI Director] Memakai rencana cadangan (tanpa LLM). Alasan: ${reason}`);
  return {
    imagePrompt: `${visualGuide.visualFocus || 'Modern tech scene'}, brand ${dna.brandName || ''}, 9:16 vertical composition, cinematic lighting`,
    narrationScript: [visualGuide.hook, visualGuide.validasi, visualGuide.insight, visualGuide.actionCta].filter(Boolean).join(' '),
    bgmTags: `${visualGuide.sound || 'cinematic'}, instrumental`,
    usedFallback: true,
    fallbackReason: reason,
  };
}
