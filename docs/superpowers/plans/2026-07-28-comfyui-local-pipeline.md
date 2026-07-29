# Local Generation Pipeline (ComfyUI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the AI Video Generation pipeline from browser automation to a local ComfyUI API, handling VRAM-efficient generation for Video, BGM, TTS, and STT.

**Architecture:** The Next.js backend orchestrates the workflow. Cloudflare handles T2I. The Next.js app sends JSON workflows to the local ComfyUI instance, which sequentially loads SVD, VoxCPM2, ACE-Step Turbo, and Whisper Turbo to manage the 8GB VRAM limit. Finally, FFmpeg stitches and applies dynamic effects.

**Tech Stack:** Next.js Server Actions, ComfyUI REST API, Cloudflare Workers AI, fluent-ffmpeg.

## Global Constraints

- Must retain Cloudflare for T2I.
- Must use ComfyUI for local VRAM management (models are kept in RAM, swapped to 8GB VRAM sequentially).
- Post-processing must not be plain concatenation; must include Ken Burns, Audio Ducking, and dynamic subtitles.

---

### Task 1: Clean Up Legacy Puppeteer Scripts

**Files:**
- Modify: `src/lib/dreamina/index.ts` (or delete directory)
- Modify: `src/lib/suno/index.ts` (or delete directory)
- Modify: `package.json`

**Interfaces:**
- Consumes: N/A
- Produces: A cleaner repository without browser automation dependencies.

- [ ] **Step 1: Remove legacy directories**

```bash
rm -rf src/lib/dreamina src/lib/suno
```

- [ ] **Step 2: Update package.json to remove dependencies**

```json
// In package.json, remove these lines if they exist:
// "puppeteer": "^...",
// "puppeteer-extra": "^...",
// "puppeteer-extra-plugin-stealth": "^...",
// "playwright": "^..."
```

- [ ] **Step 3: Run bun install to update lockfile**

```bash
bun install
```

---

### Task 2: Build ComfyUI API Client

**Files:**
- Create: `src/lib/comfyui/client.ts`

**Interfaces:**
- Consumes: JSON payloads representing workflow graphs.
- Produces: `ComfyUIClient` class with methods to queue prompts and fetch history.

- [ ] **Step 1: Write the ComfyUI Client class**

```typescript
// src/lib/comfyui/client.ts
export class ComfyUIClient {
  private baseUrl = 'http://127.0.0.1:8188';

  async queuePrompt(prompt: any, clientId: string = 'nextjs-client') {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, client_id: clientId })
    });
    if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);
    return res.json();
  }
  
  async getHistory(promptId: string) {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);
    return res.json();
  }
}
```

- [ ] **Step 2: Define Workflow Templates (Model Locations)**

```typescript
// src/lib/comfyui/workflows.ts
export const buildGenerationWorkflow = (promptText: string, imagePath: string) => {
  return {
    // SVD Node Example
    "1": {
      "inputs": {
        "ckpt_name": "W:/models/checkpoints/svd.safetensors", // or C:/ huggingface cache
        "init_image": imagePath,
      },
      "class_type": "SVD_Image2Video"
    },
    // ACE-Step Turbo Node
    "2": {
      "inputs": {
        "model_path": "C:/Users/ASUS/.cache/huggingface/hub/models--ACE-Step-Turbo",
        "prompt": promptText
      },
      "class_type": "ACE_Step_MusicGen"
    },
    // VoxCPM2 Node
    "3": {
      "inputs": {
        "model_path": "W:/models/voxcpm2",
        "text": promptText
      },
      "class_type": "VoxCPM2_TTS"
    }
  };
};
```

- [ ] **Step 3: Commit the ComfyUI client and workflows**

```bash
git add src/lib/comfyui/client.ts src/lib/comfyui/workflows.ts
git commit -m "feat: add ComfyUI API client and model workflow configurations"
```

---

### Task 3: FFmpeg Dynamic Post-Processing

**Files:**
- Create: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: Paths to raw video (SVD), audio (VoxCPM2), bgm (ACE-Step), and subtitles (Whisper).
- Produces: `export async function renderDynamicVideo(params: RenderParams): Promise<string>`

- [ ] **Step 1: Implement FFmpeg complex filter logic**

```typescript
// src/lib/ffmpeg/dynamic_editor.ts
import ffmpeg from 'fluent-ffmpeg';

export interface RenderParams {
  videoPath: string;
  voicePath: string;
  bgmPath: string;
  srtPath: string;
  outputPath: string;
}

export async function renderDynamicVideo({ videoPath, voicePath, bgmPath, srtPath, outputPath }: RenderParams): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(voicePath)
      .input(bgmPath)
      // Example complex filter: 
      // 1. Zoom/Pan on video (Ken Burns)
      // 2. Audio Ducking (BGM drops when voice plays)
      // 3. Overlay SRT
      .complexFilter([
        '[0:v]zoompan=z=\'zoom+0.001\':d=125[v_zoom]',
        '[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[a_mix]',
        '[v_zoom]subtitles=' + srtPath + '[v_out]'
      ])
      .map('[v_out]')
      .map('[a_mix]')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}
```

- [ ] **Step 2: Commit the FFmpeg editor**

```bash
git add src/lib/ffmpeg/dynamic_editor.ts
git commit -m "feat: add dynamic ffmpeg editor with ducking and ken burns"
```

---

### Task 4: Orchestrator Integration

**Files:**
- Modify: `src/app/actions/generate.ts`

**Interfaces:**
- Consumes: `ComfyUIClient`, `renderDynamicVideo`, and Cloudflare T2I module.
- Produces: Server action that ties the whole generation process together.

- [ ] **Step 1: Write the orchestrator server action**

```typescript
// src/app/actions/generate.ts
import { ComfyUIClient } from '@/lib/comfyui/client';
import { renderDynamicVideo } from '@/lib/ffmpeg/dynamic_editor';
// import { generateImage } from '@/lib/cloudflare'; // existing

export async function generateContentAction(dnaState: any) {
   const comfy = new ComfyUIClient();
   
   // 1. T2I using Cloudflare (Existing)
   // const imageUrl = await generateImage(dnaState.prompt);
   
   // 2. Queue ComfyUI workflow (Placeholder for actual workflow JSON)
   const workflow = {}; // Load appropriate workflow mapping T2I, Voice, BGM
   const queueRes = await comfy.queuePrompt(workflow);
   
   // 3. Polling logic to wait for ComfyUI to finish
   // (Implement basic delay/polling here)
   
   // 4. Run FFmpeg
   const finalVideo = await renderDynamicVideo({
     videoPath: 'path/to/svd_output.mp4',
     voicePath: 'path/to/voxcpm2_output.wav',
     bgmPath: 'path/to/ace_output.wav',
     srtPath: 'path/to/whisper_output.srt',
     outputPath: '/tmp/final_output.mp4'
   });
   
   return finalVideo;
}
```

- [ ] **Step 2: Commit the orchestrator action**

```bash
git add src/app/actions/generate.ts
git commit -m "feat: integrate comfyui and ffmpeg in generate action"
```
