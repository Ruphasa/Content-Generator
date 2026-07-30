# AI Director Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace naive string concatenations in `src/app/actions/generate.ts` with real AI Director (Groq LLM) calls to generate context-rich visual prompts, smooth voiceover scripts, and accurate BGM tags based on Brand DNA and Visual Guide.

**Architecture:** Create a dedicated helper `generateDirectorPlan` in `src/lib/ai/director.ts` using `@ai-sdk/groq` to call Groq LLM (`llama-3.3-70b-versatile`) with full Brand DNA + Visual Guide context. Wire this function directly into `src/app/actions/generate.ts` Skenario 1.

**Tech Stack:** Next.js App Router (Server Actions), `@ai-sdk/groq`, `ai` SDK, TypeScript.

## Global Constraints

- Never break existing signature of `generateContentAction(input)`.
- Use `@ai-sdk/groq` for LLM calls (`llama-3.3-70b-versatile`).
- Keep SVD resolution at `576x1024` with 9:16 vertical aspect ratio.
- Strictly adhere to TypeScript strict mode.

---

### Task 1: Create AI Director Helper Module

**Files:**
- Create: `src/lib/ai/director.ts`

**Interfaces:**
- Consumes: `DNAData`, `VisualGuideData` from `@/components/ClientLayout`
- Produces: `generateDirectorPlan(input)` returning `{ imagePrompt: string; narrationScript: string; bgmTags: string }`

- [ ] **Step 1: Write implementation for `src/lib/ai/director.ts`**

```typescript
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
```

- [ ] **Step 2: Commit changes**

```bash
git add src/lib/ai/director.ts
git commit -m "feat: add AI Director helper for prompt, script, and BGM generation"
```

---

### Task 2: Integrate AI Director into Skenario 1 (`src/app/actions/generate.ts`)

**Files:**
- Modify: `src/app/actions/generate.ts:360-460`

**Interfaces:**
- Consumes: `generateDirectorPlan` from `@/lib/ai/director`
- Produces: Enhanced `generateContentAction` using LLM AI Director guidance when inputs are missing or in fallback mode.

- [ ] **Step 1: Update `src/app/actions/generate.ts` to call AI Director**

Replace naive string concatenation with AI Director invocation:

```typescript
import { generateDirectorPlan } from '@/lib/ai/director';

// Inside generateContentAction, under Skenario 1 (fallback / single image mode):
const directorPlan = await generateDirectorPlan({ dna: input.dna, visualGuide: input.visualGuide });

const script = input.narrationScript?.trim() || directorPlan.narrationScript;
const finalImagePrompt = input.imagePrompt?.trim() || directorPlan.imagePrompt;
const finalBgmTags = input.bgmTags?.trim() || directorPlan.bgmTags;

// Use finalImagePrompt for Cloudflare T2I call
const imageOk = await generateImageFromCloudflare(finalImagePrompt, framePath);
```

- [ ] **Step 2: Run build test to verify compilation**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/app/actions/generate.ts
git commit -m "fix: connect AI Director to Skenario 1 image and script generation"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-29-ai-director-integration.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task with review checkpoints.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`.
