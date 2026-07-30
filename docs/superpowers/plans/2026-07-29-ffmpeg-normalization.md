# FFmpeg Concat Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix FFmpeg `concat` filter crashes by normalizing all input video resolutions and framerates. Resolusi di-hardcode ke 9:16 (1080x1920) untuk saat ini, dan kita akan membuat *baseline commit* sebelum memulai.

**Architecture:** Karena `aspectRatio` belum didefinisikan secara resmi di `DNAData`, kita akan menggunakan *hardcode* resolusi vertikal (1080x1920) dan 30 FPS di `stitchBlueprint` dan `renderDynamicVideo`. Setiap klip video akan melewati filter `scale` dan `pad` agar seragam sebelum masuk ke `concat` filter. Signature fungsi yang sudah ada tidak akan diubah secara radikal, menyesuaikan dengan kode saat ini.

**Tech Stack:** TypeScript, Next.js, fluent-ffmpeg

## Global Constraints

- Resolusi target: 1080x1920 (9:16)
- Framerate target: 30 FPS
- Dilarang mengubah signature parameter `renderDynamicVideo` yang sudah ada (menghindari *breaking changes* di call-site lainnya).

---

### Task 0: Create Baseline Commit

**Files:**
- Modify: `All uncommitted changes`

- [ ] **Step 1: Commit existing changes**

```bash
git add .
git commit -m "chore: save uncommitted changes before ffmpeg normalization"
```

---

### Task 1: Update stitchBlueprint with normalization filters

**Files:**
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: Existing `stitchBlueprint` parameters.
- Produces: A unified `filterGraph` that FFmpeg `concat` will accept without throwing EINVAL.

- [ ] **Step 1: Implement scaling and padding in stitchBlueprint**

```typescript
export async function stitchBlueprint(
  blueprint: DirectorBlueprint,
  voicePath: string,
  bgmPath?: string,
  assPath?: string,
  outputPath?: string
): Promise<string> {
  const targetOutput = outputPath || path.join(process.cwd(), 'public', 'generations', 'final', `output_${Date.now()}.mp4`);
  return new Promise((resolve, reject) => {
    // ... setup code ...
    
    // Gunakan hardcode 9:16 sesuai kesepakatan
    const targetWidth = 1080;
    const targetHeight = 1920;
    const targetFps = 30;

    let command = ffmpeg();
    let filterGraph: string[] = [];

    // Add inputs and trim filters based on timeline with SCALING
    blueprint.timeline.forEach((clip, i) => {
      command = command.input(clip.file);
      const start = clip.start || 0;
      // Scale and pad to normalize resolution, set fixed fps and sar
      const scaleFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps}`;
      filterGraph.push(`[${i}:v]${scaleFilter},trim=start=${start}:duration=${clip.duration},setpts=PTS-STARTPTS[v${i}];`);
    });
    
    // ... sisa kode tidak berubah (concat, audio mix, ass, dll)
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ffmpeg/dynamic_editor.ts
git commit -m "fix(stitch): apply 9:16 normalization filters to prevent concat crash"
```

---

### Task 2: Update renderDynamicVideo internal dimensions

**Files:**
- Modify: `src/lib/ffmpeg/dynamic_editor.ts`

**Interfaces:**
- Consumes: Existing `renderDynamicVideo` signature (tidak diubah).
- Produces: `v_out` video dengan resolusi standar.

- [ ] **Step 1: Update internal hardcoded dimensions**

```typescript
export async function renderDynamicVideo({
  videoPath,
  voicePath,
  bgmPath,
  assPath,
  outputPath,
  durationSeconds,
}: {
  // ... (Signature tetap utuh)
}) {
  // Ubah dari 576x1024 menjadi 1080x1920 (9:16)
  const width = 1080;
  const height = 1920;
  const fps = 30; // Sesuaikan jika perlu
  // ...
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ffmpeg/dynamic_editor.ts
git commit -m "fix(render): update hardcoded svd processing dims to 1080x1920"
```
