import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

export const maxDuration = 120; // Allow up to 2 mins for multimodal analysis

// Schema for Action 1: prompt_only
const promptOnlySchema = {
  type: Type.OBJECT,
  properties: {
    prompt1: { type: Type.STRING, description: "Detailed English prompt for the FIRST frame/scene (e.g. establishing shot, object alone)." },
    prompt2: { type: Type.STRING, description: "Detailed English prompt for the LAST frame/scene. Must be a logical progression or dramatic transition from prompt1 (e.g. zoom out revealing a new environment, or the object transforming)." },
    style: { type: Type.STRING, description: "Visual style description." }
  },
  required: ["prompt1", "prompt2", "style"]
};

// Schema for Action 2: script_only
const scriptOnlySchema = {
  type: Type.OBJECT,
  properties: {
    narration: { type: Type.STRING, description: "Spoken narration script in Bahasa Indonesia." },
    caption: { type: Type.STRING, description: "Social media caption text." },
    hashtags: { type: Type.STRING, description: "Space separated hashtags." },
    bgmPrompt: { type: Type.STRING, description: "English style tags for background music (ACE-Step), e.g. 'cinematic, uplifting, piano'." }
  },
  required: ["narration", "caption", "hashtags", "bgmPrompt"]
};

// Schema for Action 3: scene_planning
const scenePlanningSchema = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      description: "List of scenes forming the video to match exact target duration.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "'footage' if using asset URL, or 'generated' for AI filler." },
          sourceUrl: { type: Type.STRING, description: "Asset URL if type is footage, otherwise empty." },
          startTime: { type: Type.NUMBER, description: "Start time in seconds to trim." },
          endTime: { type: Type.NUMBER, description: "End time in seconds to trim." },
          textOverlay: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              position: { type: Type.STRING },
              style: { type: Type.STRING }
            },
            required: ["text", "position", "style"]
          }
        },
        required: ["type", "sourceUrl", "startTime", "endTime", "textOverlay"]
      }
    }
  },
  required: ["scenes"]
};

// Legacy full plan schema
const fullPlanSchema = {
  type: Type.OBJECT,
  properties: {
    scenes: scenePlanningSchema.properties.scenes,
    narration: scriptOnlySchema.properties.narration,
    caption: scriptOnlySchema.properties.caption,
    hashtags: scriptOnlySchema.properties.hashtags,
    totalDuration: { type: Type.NUMBER },
    bgmPrompt: scriptOnlySchema.properties.bgmPrompt
  },
  required: ["scenes", "narration", "caption", "hashtags", "totalDuration", "bgmPrompt"]
};

export async function POST(req: Request) {
  try {
    const { action, dna, visualGuide, assetUrls, targetDuration } = await req.json();

    if (!dna || !visualGuide) {
      return NextResponse.json({ error: "DNA and Visual Guide are required." }, { status: 400 });
    }

    // 1. MODE: prompt_only (Flow A Phase 1)
    if (action === 'prompt_only') {
      const systemInstruction = `
Kamu adalah AI Video Director. Buatlah prompt deskripsi visual (dalam Bahasa Inggris) untuk generator gambar Cloudflare Workers AI, yang hasilnya dianimasikan oleh Stable Video Diffusion di ComfyUI lokal. Rasio 9:16 vertical short.

Konteks Brand DNA:
- Nama Brand: ${dna.brandName}
- Deskripsi/Overview: ${dna.brandOverview || dna.tagline || ''}
- Visi & Misi: ${dna.visi || ''} ${dna.misi || ''}
- Target Audience: ${dna.targetAudience || ''}
- Tone of Voice: ${dna.tone || ''}
- Keyword/Vocabulary: ${dna.keyVocabulary || ''}

Arahan Visual Khusus (Panduan Utama):
- Hook Visual: ${visualGuide.hook}
- Visual Focus: ${visualGuide.visualFocus}
- Video Style: ${visualGuide.videoStyle}
- Insight/Goals: ${visualGuide.insight || visualGuide.goal || ''}

Tugas: Buatlah prompt T2V (Text-to-Video) yang sangat kaya visual, cinematic, dan 100% selaras dengan identitas Brand DNA di atas. Jangan menyimpang dari ranah bisnis brand tersebut (misal: jika brand IT, tampilkan elemen teknologi).
`;
      // MOCK MODE: Bypass Gemini API to save quota
      const mockPromptData = {
        prompt1: "Cinematic shot of a developer working late at night, highly detailed, 4k.",
        prompt2: "The developer looking happy as the code finally works, bright lighting.",
        style: "Cinematic, realistic, moody lighting"
      };
      return NextResponse.json({ success: true, ...mockPromptData });
    }

    // 2. MODE: script_only (Flow A Phase 2 & Flow B Phase 1)
    if (action === 'script_only') {
      const durationConstraint = targetDuration 
        ? `Naskah narasi WAJIB diucapkan dalam durasi TEPAT sekitar ${targetDuration.toFixed(1)} detik (sekitar ${Math.round(targetDuration * 2.5)} kata Bahasa Indonesia). Tidak boleh terlalu panjang agar tidak terpotong.` 
        : `Naskah narasi dibuat pendek dan padat (maksimal 60 detik).`;

      const systemInstruction = `
Kamu adalah Copywriter & AI Video Director untuk "${dna.brandName}".
Tugasmu: Tulis naskah suara (narasi), caption media sosial, hashtag, dan prompt BGM.

DNA BRAND:
- Tone: ${dna.tone}
- Audience: ${dna.targetAudience}

VISUAL GUIDE (Naskah Konten):
- Hook: ${visualGuide.hook}
- Validasi: ${visualGuide.validasi}
- Insight: ${visualGuide.insight}
- CTA: ${visualGuide.actionCta}

BATASAN WAKTU:
${durationConstraint}
`;
      // MOCK MODE: Bypass Gemini API to save quota
      const mockScriptData = {
        narration: "Ini adalah teks narasi suara buatan sistem untuk keperluan testing video. Kualitas suara TTS akan membacakan ini.",
        caption: "Mari kita buat video hebat hari ini! #AI #Video",
        hashtags: "#AI #Video #Testing",
        bgmPrompt: "Upbeat, energetic, corporate lo-fi, instrumental, no vocals"
      };
      return NextResponse.json({ success: true, ...mockScriptData });
    }

    // 3. MODE: scene_planning (Flow B Phase 2 - Multimodal Scene Alignment)
    if (action === 'scene_planning') {
      const totalSec = targetDuration || 15.0;
      
      const systemInstruction = `
Kamu adalah AI Video Editor.
Tugasmu: Susun adegan-adegan (scenes) video sedemikian rupa sehingga TOTAL DURASI (penjumlahan dari endTime - startTime tiap scene) TEPAT SAMA DENGAN ${totalSec.toFixed(1)} detik.

ASET FOOTAGE TERSEDIA:
${assetUrls && assetUrls.length > 0 ? assetUrls.map((u: string, i: number) => `[Footage ${i+1}] ${u}`).join('\n') : "TIDAK ADA ASET FOOTAGE. Gunakan type: 'generated'."}

ATURAN:
1. Jika ada footage, pilih dari daftar URL aset dan tentukan startTime & endTime (misal 0 sampai 5).
2. Jika total durasi footage belum mencapai ${totalSec.toFixed(1)} detik, tambahkan scene dengan type: 'generated' dan sourceUrl: '' sebagai filler.
3. Pastikan total durasi seluruh scene persis ${totalSec.toFixed(1)} detik.
`;

      // MOCK MODE: Bypass Gemini API to save quota
      const mockSceneData = {
        scenes: [
          {
            type: "generated",
            sourceUrl: "",
            startTime: 0,
            endTime: totalSec,
            textOverlay: { text: "Adegan Testing", position: "center", style: "bold" }
          }
        ]
      };
      return NextResponse.json({ success: true, ...mockSceneData });
    }

    // 4. LEGACY / DEFAULT MODE (Full Plan in one pass)
    const systemInstruction = `
Kamu adalah AI Video Director untuk brand "${dna.brandName || "Klien"}".
Tugasmu: buat editing plan untuk video short (vertical 9:16, max 60 detik).

1. DNA BRAND:
- Nama Brand: ${dna.brandName}
- Tagline: ${dna.tagline}
- Overview: ${dna.brandOverview}
- Target Audience: ${dna.targetAudience}

2. VISUAL GUIDE:
- Hook: ${visualGuide.hook}
- Validasi: ${visualGuide.validasi}
- Insight: ${visualGuide.insight}
- CTA: ${visualGuide.actionCta}

3. FOOTAGE TERSEDIA:
${assetUrls && assetUrls.length > 0 ? assetUrls.map((url: string, i: number) => `[${i+1}] ${url}`).join('\n') : "TIDAK ADA FOOTAGE."}
`;

    // MOCK MODE: Bypass Gemini API to save quota
    const plan = {
      scenes: [{ type: "generated", sourceUrl: "", startTime: 0, endTime: 5, textOverlay: { text: "MOCK", position: "center", style: "bold" } }],
      narration: "Ini narasi testing.",
      caption: "Caption testing",
      hashtags: "#test",
      totalDuration: 5,
      bgmPrompt: "Calm piano"
    };
    
    // Save plan
    const timestamp = Date.now();
    const planDir = path.join(process.cwd(), 'public', 'generations', 'plans');
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, `plan_${timestamp}.json`), JSON.stringify(plan, null, 2));

    return NextResponse.json({ success: true, plan, savedPath: `/generations/plans/plan_${timestamp}.json` });

  } catch (error: any) {
    console.error("AI Director Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
