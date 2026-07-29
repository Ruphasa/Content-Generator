# Smart Director Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Gemini 2.5 Flash as a "Smart Director" to orchestrate multi-clip B-Roll video editing, generate premium ASS subtitles, and resolve technical debt (rewiring frontend UI, fixing next.config, and killing legacy duplicate audio pipelines).

**Architecture:** 
- `next.config.ts` handles FFmpeg as a server external package, killing the brittle `\ROOT\` paths.
- `ClientLayout.tsx` (Frontend UI) is rewired to call the unified `generateContentAction` and handles structured warnings/errors via toast notifications.
- The `bgm` mock route and legacy `edge-tts` routes are completely deleted in favor of the ComfyUI pipeline (VoxCPM2 + ACE-Step).
- `src/lib/ffmpeg/probe.ts`: Scans local assets using `ffprobe` to determine durations.
- `src/lib/google/director.ts`: Calls Gemini 2.5 Flash (free tier) to output a precise JSON blueprint (TTS script + editing timeline).
- `src/lib/ffmpeg/subtitles.ts`: Converts Whisper Turbo's word-level timestamps into an Advanced SubStation Alpha (.ass) file with pop/bounce karaoke tags.
- `src/lib/ffmpeg/dynamic_editor.ts`: Executes a complex `fluent-ffmpeg` command to trim, concatenate, loop, and burn subtitles based on the JSON blueprint.

**Tech Stack:** Next.js Server Actions, Gemini 2.5 Flash (`@google/genai`), fluent-ffmpeg, ComfyUI API (for VoxCPM2, ACE-Step, Whisper).

## Global Constraints

- Target Gemini 2.5 Flash for the Director.
- Premium ASS animated subtitles must apply to all outputs.
- No plain concatenation; FFmpeg must strictly follow the `start` and `duration` rules from the Director's JSON timeline.
- Legacy audio pipelines must be fully removed.

---

### Task 1: Kill Legacy Audio Pipelines

**Files:**
- Delete: `src/app/api/generate/bgm/route.ts` (or similar mock route)
- Delete: `src/app/api/generate/tts/route.ts` (or similar edge-tts route)
- Modify: `package.json`

**Interfaces:**
- Consumes: N/A
- Produces: Clean codebase without competing audio generation logic.

- [ ] **Step 1: Delete legacy mock and Edge TTS routes**

```bash
# Locate and remove the legacy endpoints
rm -f src/app/api/generate/bgm/route.ts
rm -f src/app/api/generate/tts/route.ts
```

- [ ] **Step 2: Remove edge-tts from package.json**

```json
// In package.json, remove:
// "edge-tts-universal": "^1.4.0",
// "google-tts-api": "^2.0.2"
```

- [ ] **Step 3: Commit removal of legacy routes**

```bash
bun install
git add package.json src/app/api/generate
git commit -m "refactor: remove legacy edge-tts and mock bgm pipelines"
```

---

### Task 2: Fix `next.config.ts` and Remove Workarounds

**Files:**
- Modify: `next.config.ts`
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`
- Modify: `src/app/api/generate/stitch/route.ts` (if retained)

**Interfaces:**
- Consumes: N/A
- Produces: Native `fluent-ffmpeg` resolution in Next.js Server Actions.

- [ ] **Step 1: Update next.config.ts**

```typescript
// Add serverExternalPackages to next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static'],
  async headers() {
    // ... existing headers
  }
};
```

- [ ] **Step 2: Remove \ROOT\ path workarounds**
In `src/lib/ffmpeg/dynamic_editor.ts` and any other ffmpeg files, find and delete lines like:
```typescript
if (ffmpegPath.includes('\\ROOT\\')) {
  ffmpegPath = ffmpegPath.replace('\\ROOT\\', process.cwd() + '\\');
}
```

- [ ] **Step 3: Commit config fixes**

```bash
git add next.config.ts src/lib/ffmpeg/dynamic_editor.ts src/app/api/generate/stitch/route.ts
git commit -m "fix: set serverExternalPackages and remove ROOT ffmpeg workaround"
```

---

### Task 3: Rewire Frontend UI & Error Handling

**Files:**
- Modify: `src/components/ClientLayout.tsx` (or the equivalent component holding the Generate button)

**Interfaces:**
- Consumes: `generateContentAction` from `src/app/actions/generate.ts`.
- Produces: Dispatches action on click, catches and displays structured warnings via toast/alert UI.

- [ ] **Step 1: Wire up the Server Action**

```tsx
// Inside src/components/ClientLayout.tsx (or equivalent)
import { generateContentAction } from '@/app/actions/generate';
// Assume a toast function exists or use native alert for MVP

const handleGenerate = async () => {
  try {
    setIsGenerating(true);
    const result = await generateContentAction(dnaState);
    if (result.warnings && result.warnings.length > 0) {
      alert("Warnings: " + result.warnings.join('\n')); // Replace with toast
    }
    setVideoUrl(result.url);
  } catch (error) {
    alert("Generation failed: " + error.message); // Replace with toast
  } finally {
    setIsGenerating(false);
  }
};
```

- [ ] **Step 2: Commit Frontend Rewiring**

```bash
git add src/components/ClientLayout.tsx
git commit -m "feat: rewire frontend to unified generate action with error handling"
```

---

### Task 4: Asset Scanning & Smart Director (Gemini 2.5 Flash)

**Files:**
- Create: `src/lib/ffmpeg/probe.ts`
- Create: `src/lib/google/director.ts`

**Interfaces:**
- Consumes: `ffprobe` metadata, DNA context.
- Produces: `DirectorBlueprint` containing TTS script and precise video editing timeline.

- [ ] **Step 1: Write Asset Scanner**

```typescript
// src/lib/ffmpeg/probe.ts
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface AssetMetadata {
  file: string;
  duration: number;
}

export async function scanAssets(dir: string): Promise<AssetMetadata[]> {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
  
  const results: AssetMetadata[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const duration = await new Promise<number>((resolve) => {
      ffmpeg.ffprobe(fullPath, (err, metadata) => {
        if (err || !metadata?.format?.duration) resolve(5);
        else resolve(metadata.format.duration);
      });
    });
    results.push({ file: fullPath, duration });
  }
  return results;
}
```

- [ ] **Step 2: Create Director Service**

```typescript
// src/lib/google/director.ts
import { GoogleGenAI } from '@google/genai';
import { AssetMetadata } from '../ffmpeg/probe';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DirectorBlueprint {
  tts_script: string;
  bgm_prompt: string;
  timeline: { file: string; duration: number; start?: number }[];
}

export async function createEditingBlueprint(context: string, assets: AssetMetadata[]): Promise<DirectorBlueprint> {
  const assetInfo = assets.map(a => `${path.basename(a.file)} (Duration: ${a.duration}s)`).join('\n');
  
  const prompt = `You are an expert Video Director. We have these B-Roll clips:\n${assetInfo}\n
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
  
  return JSON.parse(response.text || "{}");
}
```

- [ ] **Step 3: Commit Asset Scanner & Director**

```bash
git add src/lib/ffmpeg/probe.ts src/lib/google/director.ts
git commit -m "feat: add asset scanner and gemini 2.5 flash smart director"
```

---

### Task 5: Premium ASS Subtitles & Dynamic FFmpeg Stitching

**Files:**
- Create: `src/lib/ffmpeg/subtitles.ts`
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: Word-level timestamps from Whisper Turbo, `DirectorBlueprint`.
- Produces: High-quality animated ASS subtitles burned onto a dynamically trimmed/concatenated timeline.

- [ ] **Step 1: Create Premium ASS Generator**

```typescript
// src/lib/ffmpeg/subtitles.ts
import fs from 'fs';

export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;
}

export function generateAssFile(words: WordTimestamp[], outputPath: string) {
  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Alignment, MarginL, MarginR, MarginV
Style: Premium,Inter,80,&H00FFFFFF,&H00000000,&H80000000,-1,0,2,10,10,150

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const formatTime = (s: number) => {
    const d = new Date(s * 1000);
    return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(Math.floor(d.getUTCMilliseconds()/10)).padStart(2, '0')}`;
  };

  words.forEach(w => {
    const start = formatTime(w.start);
    const end = formatTime(w.end);
    // Advanced Karaoke Bounce Animation
    const anim = `{\\t(0,100,\\fscx120\\fscy120)\\t(100,200,\\fscx100\\fscy100)}`;
    assContent += `Dialogue: 0,${start},${end},Premium,,0,0,0,,${anim}${w.word}\n`;
  });

  fs.writeFileSync(outputPath, assContent);
}
```

- [ ] **Step 2: Implement Blueprint Stitching**

```typescript
// Add to src/lib/ffmpeg/dynamic_editor.ts
import { DirectorBlueprint } from '../google/director';
import ffmpeg from 'fluent-ffmpeg';

export async function stitchBlueprint(
  blueprint: DirectorBlueprint, 
  voicePath: string, 
  bgmPath: string, 
  assPath: string, 
  outputPath: string
) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    let filterGraph: string[] = [];
    
    // Add inputs and trim filters based on timeline
    blueprint.timeline.forEach((clip, i) => {
      command = command.input(clip.file);
      const start = clip.start || 0;
      filterGraph.push(`[${i}:v]trim=start=${start}:duration=${clip.duration},setpts=PTS-STARTPTS[v${i}];`);
    });

    const concatInputs = blueprint.timeline.map((_, i) => `[v${i}]`).join('');
    filterGraph.push(`${concatInputs}concat=n=${blueprint.timeline.length}:v=1:a=0[vconcat];`);
    
    command = command.input(voicePath).input(bgmPath);
    const vIdx = blueprint.timeline.length;
    const bIdx = blueprint.timeline.length + 1;

    // Audio ducking + Ass Subtitles
    filterGraph.push(`[${vIdx}:a][${bIdx}:a]amix=inputs=2:duration=first:dropout_transition=2[aout];`);
    filterGraph.push(`[vconcat]ass=${assPath}[vout]`);

    command
      .complexFilter(filterGraph.join(''))
      .map('[vout]')
      .map('[aout]')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

- [ ] **Step 3: Commit Subtitles and Editor update**

```bash
git add src/lib/ffmpeg/subtitles.ts src/lib/ffmpeg/dynamic_editor.ts
git commit -m "feat: add premium ASS subtitles and dynamic FFmpeg timeline stitching"
```
