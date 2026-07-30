### Task 1: Universal ASS Subtitle Support (FFmpeg)

**Files:**
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: The existing `RenderParams` interface.
- Produces: An updated `renderDynamicVideo` function that burns `.ass` instead of `.srt`.

- [ ] **Step 1: Update `RenderParams` interface**
  In `src/lib/ffmpeg/dynamic_editor.ts`, locate `RenderParams` and change `srtPath` to `assPath`:
  `	ypescript
  export interface RenderParams {
    videoPath: string;
    voicePath: string;
    bgmPath?: string;
    assPath?: string; // Changed from srtPath
    outputPath: string;
    // ...
  }
  `

- [ ] **Step 2: Update the filtergraph in `renderDynamicVideo`**
  Locate the subtitle burning logic inside `buildSubtitleChain` (or directly inside `renderDynamicVideo` depending on implementation).
  Change the FFmpeg filter from `subtitles=` to `ass=`:
  `	ypescript
  if (params.assPath) {
    const escapedAss = escapeFilterPath(params.assPath);
    // Old: filterGraph.push([v_in]subtitles=[v_out]);
    // New:
    filterGraph.push([v_in]ass=[v_out]);
  }
  `

- [ ] **Step 3: Commit FFmpeg Updates**
  git add src/lib/ffmpeg/dynamic_editor.ts
  git commit -m "fix: upgrade renderDynamicVideo to support premium ASS subtitles globally"
