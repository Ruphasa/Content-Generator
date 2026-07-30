### Task 2: Split AI Director into Two Phases

**Files:**
- Modify: `src/lib/ai/director.ts` (Note: The plan says `src/lib/google/director.ts` but the file is likely `src/lib/ai/director.ts` based on previous tasks. Verify the file path).

**Interfaces:**
- Consumes: `DNAData`, `VisualGuideData`, `AssetMetadata[]`, `targetDuration`
- Produces: 
  - `export async function generateScriptAndBgm(context: string): Promise<{tts_script: string, bgm_prompt: string}>`
  - `export async function generateTimeline(targetDuration: number, assets: AssetMetadata[]): Promise<{timeline: {file: string, duration: number, start: number}[]}>`

- [ ] **Step 1: Hapus `createEditingBlueprint`**
  - Hapus atau *comment out* `createEditingBlueprint` secara penuh.
- [ ] **Step 2: Buat `generateScriptAndBgm`**
  - Minta Gemini memproduksi JSON berisi `"tts_script"` dan `"bgm_prompt"`.
  - Konfigurasi *prompt* mirip dengan Fase 1 lama, tapi hilangkan kebutuhan aset B-Roll.
- [ ] **Step 3: Buat `generateTimeline`**
  - Parameter: `targetDuration: number` dan `assets: AssetMetadata[]`.
  - Minta Gemini memproduksi JSON berisi `"timeline": [ { "file": "...", "start": ..., "duration": ... } ]`.
  - *Prompt* HARUS menginstruksikan secara keras: *"Total sum of all clip durations MUST equal EXACTLY X seconds"*.
- [ ] **Step 4: Update `validateBlueprint` jika diperlukan**
  - Hapus validasi `tts_script` dan `bgm_prompt` dari `validateBlueprint` karena sekarang ia hanya memvalidasi array *timeline*. Atau, pisahkan validasi untuk Fase 1 dan Fase 2.
