# AI Director Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memisahkan AI Director menjadi 2 fase agar Naskah (Fase 1) dan Pemotongan B-Roll (Fase 2) selaras sempurna dengan durasi audio nyata (VoxCPM2) hingga ke level milidetik.

**Architecture:** Memecah `createEditingBlueprint` di `director.ts` menjadi dua pemanggilan LLM. Fase pertama untuk skrip dan prompt BGM. Fase kedua berjalan *setelah* audio ter-generate, dengan menginjeksi durasi pasti hasil `ffprobe` ke dalam prompt Gemini, memaksa Gemini merangkai *timeline* yang durasi totalnya sama persis dengan audio.

**Tech Stack:** Next.js (Server Actions), `@google/genai`, `fluent-ffmpeg` (`ffprobe`), TypeScript.

## Global Constraints

- Jangan mengubah signature pemanggilan atau behavior Skenario 1 (SVD Single Image).
- Panggilan FFmpeg `ffprobe` sudah tersedia lewat PATH, jangan gunakan dependensi baru.
- Harus menjaga log `console.log` di tiap tahapan (`generate.ts`) agar proses tetap *observable*.
- Selalu gunakan `validateBlueprint` pada *timeline* yang dihasilkan Gemini.

---

### Task 0: Create Baseline Commit

**Files:**
- Modify: `.` (Git Worktree)

**Interfaces:**
- Consumes: N/A
- Produces: N/A

- [ ] **Step 1: Save uncommitted changes**
```bash
git add .
git commit -m "chore: save uncommitted changes before AI Director Part 2 architecture"
```

---

### Task 1: Add Audio Duration Probing to FFmpeg Utils

**Files:**
- Modify: `src/lib/ffmpeg/probe.ts`

**Interfaces:**
- Consumes: Audio file path
- Produces: `export async function probeDuration(filePath: string): Promise<number>`

- [ ] **Step 1: Tambahkan fungsi `probeDuration`**
  - Buat fungsi `probeDuration(filePath: string)` yang me-return `Promise<number>`.
  - Gunakan `ffmpeg.ffprobe` (seperti di dalam `scanAssets`) untuk membaca `metadata?.format?.duration`.
  - Jika gagal atau angka tidak valid, throw `Error('Gagal membaca durasi file audio.')`.

---

### Task 2: Split AI Director into Two Phases

**Files:**
- Modify: `src/lib/google/director.ts`

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

---

### Task 3: Rewire the Pipeline in generate.ts

**Files:**
- Modify: `src/app/actions/generate.ts`

**Interfaces:**
- Consumes: `generateScriptAndBgm`, `generateTimeline`, `probeDuration`
- Produces: A perfectly synchronized video generation pipeline for Skenario 2.

- [ ] **Step 1: Update Fase B-Roll Pertama (Pre-Audio)**
  - Ganti panggilan `createEditingBlueprint` menjadi `generateScriptAndBgm`.
  - Log script yang dihasilkan.
- [ ] **Step 2: Generate Audio (VoxCPM2)**
  - Tulis logika `buildNarrationWorkflow` (Sudah ada di kode saat ini, biarkan saja).
- [ ] **Step 3: Probe Durasi dan Generate Timeline**
  - Panggil `const exactDuration = await probeDuration(voicePath)`.
  - Panggil `const timeline = await generateTimeline(exactDuration, assets)`.
  - Validasi dan pasang format *file path* aset seperti logika sebelumnya.
- [ ] **Step 4: Update durasi total pipeline**
  - Timpa variabel `duration` dengan `exactDuration` agar *render* akhir FFmpeg memotong presisi sesuai panjang audio.
- [ ] **Step 5: Verifikasi *Fallbacks***
  - Pastikan Skenario 1 (SVD) tidak terpengaruh oleh perombakan *interface* B-Roll ini.
