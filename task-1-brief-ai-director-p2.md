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
