import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import type { DNAData, VisualGuideData } from '@/components/ClientLayout';

export interface DirectorPlanResult {
  imagePrompt: string;
  narrationScript: string;
  bgmTags: string;
}

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

Output WAJIB berupa JSON dengan format:
{
  "imagePrompt": "...",
  "narrationScript": "...",
  "bgmTags": "..."
}
`;

  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: systemInstruction,
    });

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      imagePrompt: parsed.imagePrompt || `${visualGuide.visualFocus || 'Modern software development scene'}, brand ${dna.brandName || ''}, 9:16 vertical composition, cinematic lighting`,
      narrationScript: parsed.narrationScript || visualGuide.hook || '',
      bgmTags: parsed.bgmTags || `${visualGuide.sound || 'upbeat tech'}, instrumental`,
    };
  } catch (err) {
    console.error('AI Director generation failed, using fallback:', err);
    return {
      imagePrompt: `${visualGuide.visualFocus || 'Modern tech scene'}, brand ${dna.brandName || ''}, 9:16 vertical composition, cinematic lighting`,
      narrationScript: [visualGuide.hook, visualGuide.validasi, visualGuide.insight, visualGuide.actionCta].filter(Boolean).join(' '),
      bgmTags: `${visualGuide.sound || 'cinematic'}, instrumental`,
    };
  }
}
