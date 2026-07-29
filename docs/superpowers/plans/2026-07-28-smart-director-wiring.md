# Smart Director Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the completed "Smart Director" base modules (`probe.ts`, `director.ts`, `subtitles.ts`) into the main Next.js orchestrator (`generate.ts`) and FFmpeg renderer (`dynamic_editor.ts`).

**Architecture:** 
- `src/app/actions/generate.ts`: Scans the user's `assets/` directory at the start of the action. If assets exist, it bypasses Cloudflare T2I and ComfyUI I2V. It calls Gemini 2.5 Flash to generate a timeline blueprint, executes ComfyUI for TTS/STT/BGM, and routes everything to the new FFmpeg `stitchBlueprint` function.
- `src/lib/ffmpeg/dynamic_editor.ts`: Implements `stitchBlueprint` which translates the Gemini JSON timeline into a complex FFmpeg filtergraph (trim, setpts, concat, ass subtitle burn-in, audio ducking).

---

### Task 1: Add Dynamic FFmpeg Stitching (The Renderer)

**Files:**
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: `DirectorBlueprint` (JSON), TTS Audio, BGM Audio, ASS Subtitles.
- Produces: `export async function stitchBlueprint(...)`

- [ ] **Step 1: Implement `stitchBlueprint`**
  - Add a new function exported as `stitchBlueprint`.
  - Read the `timeline` array from the `DirectorBlueprint`.
  - Dynamically chain `.input()` for every clip mentioned in the timeline.
  - Generate the `[N:v]trim=start=X:duration=Y,setpts=PTS-STARTPTS[vN];` filter for every clip.
  - Generate the `concat` filter to stitch them together `[v0][v1]concat=n=2:v=1:a=0[vconcat];`.
  - Apply `ass=` filter for the subtitles on the concatenated stream.
  - Apply `amix` for audio ducking between BGM and TTS.
  - Execute and resolve the output path.

- [ ] **Step 2: Commit Dynamic Editor**
  ```bash
  git add src/lib/ffmpeg/dynamic_editor.ts
  git commit -m "feat: implement stitchBlueprint for timeline-based editing and ASS subtitles"
  ```

---

### Task 2: Rewire the Next.js Orchestrator (The Orchestrator)

**Files:**
- Modify: `src/app/actions/generate.ts`

**Interfaces:**
- Consumes: `scanAssets`, `createEditingBlueprint`, `generateAssFile`, `stitchBlueprint`.
- Produces: The fully orchestrated pipeline that supports Scenario 2 and 3 (Asset Overrides).

- [ ] **Step 1: Inject Asset Scanning & Blueprint Logic**
  - Import the new modules: `scanAssets`, `createEditingBlueprint`, `generateAssFile`, `stitchBlueprint`.
  - At the beginning of `generateContentAction`, scan the `public/assets/` directory (or wherever the assets are temporarily stored for the campaign).
  - If `assets.length > 0`, call `createEditingBlueprint` to get the timeline and script.
  - Skip the Cloudflare (T2I) and SVD (I2V) rendering blocks.
  
- [ ] **Step 2: Wire STT to Premium ASS Generation**
  - After ComfyUI finishes the Whisper Turbo STT node, take the word-level output.
  - Call `generateAssFile` to create the animated `.ass` file.

- [ ] **Step 3: Route to the Correct FFmpeg Renderer**
  - If `assets.length > 0` (Scenario 2/3), call `stitchBlueprint(...)`.
  - Else (Scenario 1), call the standard `renderDynamicVideo(...)`.

- [ ] **Step 4: Commit Orchestrator Rewiring**
  ```bash
  git add src/app/actions/generate.ts
  git commit -m "feat: wire Smart Director blueprint and multi-clip stitching into main pipeline"
  ```
