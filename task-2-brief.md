### Task 2: Orchestrator Fix & Cleanup

**Files:**
- Modify: `src/app/actions/generate.ts`
- Delete: `src/app/actions/generate_broll.ts`

**Interfaces:**
- Consumes: N/A
- Produces: A unified orchestrator without dead code, correctly passing the `assPath`.

- [ ] **Step 1: Update Orchestrator Call**
  In `src/app/actions/generate.ts`, inside the `else` block for SVD generation, change the parameter passed to `renderDynamicVideo`:
  `	ypescript
  await renderDynamicVideo({
    videoPath,
    voicePath,
    bgmPath,
    assPath, // Replaced srtPath with assPath
    outputPath,
    durationSeconds: duration,
  });
  `

- [ ] **Step 2: Delete Dead Code**
  Delete the unused `generate_broll.ts` file.
  rm src/app/actions/generate_broll.ts

- [ ] **Step 3: Commit Orchestrator Fixes**
  git add src/app/actions/generate.ts src/app/actions/generate_broll.ts
  git commit -m "refactor: enforce ASS subtitles in Scenario 1 and delete dead generate_broll file"
