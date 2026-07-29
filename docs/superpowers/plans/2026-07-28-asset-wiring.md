# Smart Director UI Asset Wiring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the UI's Asset Folder selection (`selectedFolderId`) directly to the backend Server Action, allowing the Smart Director to dynamically download and scan user-selected B-Roll clips from remote URLs (Google Drive / Sheets), replacing the hardcoded `public/b-roll` fallback.

**Architecture:** 
- `src/components/ClientLayout.tsx`: Passes the selected `AssetFolder` object (which contains the synced `remoteUrls`) into the `generateContentAction`.
- `src/app/actions/generate.ts`: Modifies `GenerateContentInput` to accept `assetFolder`. When provided, it fetches the remote URLs, saves them temporarily to disk, and points `scanAssets` to this new dynamic folder instead of the hardcoded one.

---

### Task 1: Update Frontend Orchestrator (`ClientLayout.tsx`)

**Files:**
- Modify: `src/components/ClientLayout.tsx`

**Interfaces:**
- Before calling `generateContentAction`, resolve `selectedFolderId` to the actual folder object.

- [ ] **Step 1: Pass the selected folder**
  Locate `handleConfirmGenerate`. Before calling the action, find the selected folder:
  ```typescript
  const selectedFolder = assetFolders.find(f => f.id === selectedFolderId);
  
  const result = await generateContentAction({
    dna: dnaData,
    visualGuide: visualGuide,
    assetFolder: selectedFolder // Pass it to backend
  });
  ```

---

### Task 2: Backend Dynamic Download (`generate.ts`)

**Files:**
- Modify: `src/app/actions/generate.ts`

**Interfaces:**
- `GenerateContentInput`: Add `assetFolder?: any;` (or the proper `AssetFolder` type if imported).
- Download logic: Fetch URLs as `ArrayBuffer` and write to a temp directory using `fs.writeFileSync`.

- [ ] **Step 1: Update `GenerateContentInput`**
  ```typescript
  export interface GenerateContentInput {
    dna: DNAData;
    visualGuide: VisualGuideData;
    assetFolder?: { id: string; name: string; remoteUrls?: { url: string; filename?: string }[] };
    narrationScript?: string;
    imagePrompt?: string;
    bgmTags?: string;
  }
  ```

- [ ] **Step 2: Dynamic B-Roll Directory & Download**
  Locate `// 1. Scan b-roll`. Replace the hardcoded `const bRollDir = ...` logic with:
  ```typescript
  // 1. Scan b-roll
  let bRollDir = path.join(process.cwd(), 'public', 'b-roll'); // Fallback
  let assets: any[] = [];
  
  // If user selected a folder with remote URLs, download them to a temp folder
  if (input.assetFolder?.remoteUrls && input.assetFolder.remoteUrls.length > 0) {
    bRollDir = path.join(workDir, 'b-roll');
    fs.mkdirSync(bRollDir, { recursive: true });
    
    for (let i = 0; i < input.assetFolder.remoteUrls.length; i++) {
      const task = input.assetFolder.remoteUrls[i];
      if (!task.url.trim()) continue;
      
      try {
        const response = await fetch(task.url);
        if (!response.ok) continue;
        
        const arrayBuffer = await response.arrayBuffer();
        let filename = task.filename || `clip_${i}.mp4`;
        if (!filename.includes('.')) filename += '.mp4';
        
        fs.writeFileSync(path.join(bRollDir, filename), Buffer.from(arrayBuffer));
      } catch (e) {
        console.error('Failed to download asset:', task.url, e);
      }
    }
  }

  if (fs.existsSync(bRollDir)) {
    assets = await scanAssets(bRollDir);
  }
  ```

- [ ] **Step 3: Commit Asset Wiring**
  ```bash
  git add src/components/ClientLayout.tsx src/app/actions/generate.ts
  git commit -m "feat: wire UI asset folder selection to generate action and support dynamic remote downloading"
  ```
