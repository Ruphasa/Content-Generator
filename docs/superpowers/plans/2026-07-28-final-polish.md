# Smart Director Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the Smart Director pipeline by enforcing premium ASS animated subtitles universally across all generation scenarios (including Scenario 1 SVD), and cleaning up dead code.

**Architecture:** 
- `src/lib/ffmpeg/dynamic_editor.ts`: The `renderDynamicVideo` function's signature and filtergraph are updated to natively consume `.ass` files instead of plain `.srt`, bringing parity with `stitchBlueprint`.
- `src/app/actions/generate.ts`: The fallback branch (Scenario 1) is corrected to pass the generated `assPath` to `renderDynamicVideo`.
- `src/app/actions/generate_broll.ts`: This file is deleted as its logic was successfully merged into the main `generate.ts` orchestrator.

---

### Task 1: Universal ASS Subtitle Support (FFmpeg)

**Files:**
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: The existing `RenderParams` interface.
- Produces: An updated `renderDynamicVideo` function that burns `.ass` instead of `.srt`.

- [ ] **Step 1: Update `RenderParams` interface**
  In `src/lib/ffmpeg/dynamic_editor.ts`, locate `RenderParams` and change `srtPath` to `assPath`:
  ```typescript
  export interface RenderParams {
    videoPath: string;
    voicePath: string;
    bgmPath?: string;
    assPath?: string; // Changed from srtPath
    outputPath: string;
    // ...
  }
  ```

- [ ] **Step 2: Update the filtergraph in `renderDynamicVideo`**
  Locate the subtitle burning logic inside `buildSubtitleChain` (or directly inside `renderDynamicVideo` depending on implementation).
  Change the FFmpeg filter from `subtitles=` to `ass=`:
  ```typescript
  if (params.assPath) {
    const escapedAss = escapeFilterPath(params.assPath);
    // Old: filterGraph.push(`[v_in]subtitles=${escapedSrt}[v_out]`);
    // New:
    filterGraph.push(`[v_in]ass=${escapedAss}[v_out]`);
  }
  ```

- [ ] **Step 3: Commit FFmpeg Updates**
  ```bash
  git add src/lib/ffmpeg/dynamic_editor.ts
  git commit -m "fix: upgrade renderDynamicVideo to support premium ASS subtitles globally"
  ```

---

### Task 2: Orchestrator Fix & Cleanup

**Files:**
- Modify: `src/app/actions/generate.ts`
- Delete: `src/app/actions/generate_broll.ts`

**Interfaces:**
- Consumes: N/A
- Produces: A unified orchestrator without dead code, correctly passing the `assPath`.

- [ ] **Step 1: Update Orchestrator Call**
  In `src/app/actions/generate.ts`, around line 397 (inside the `else` block for SVD generation), change the parameter passed to `renderDynamicVideo`:
  ```typescript
  await renderDynamicVideo({
    videoPath,
    voicePath,
    bgmPath,
    assPath, // Replaced srtPath with assPath
    outputPath,
    durationSeconds: duration,
  });
  ```

- [ ] **Step 2: Delete Dead Code**
  Delete the unused `generate_broll.ts` file since `generate.ts` now securely handles both multi-clip and single-generation scenarios via `useBRollPath`.
  ```bash
  rm src/app/actions/generate_broll.ts
  ```

- [ ] **Step 3: Commit Orchestrator Fixes**
  ```bash
  git add src/app/actions/generate.ts src/app/actions/generate_broll.ts
  git commit -m "refactor: enforce ASS subtitles in Scenario 1 and delete dead generate_broll file"
  ```
