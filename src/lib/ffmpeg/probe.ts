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
    // A file ffprobe cannot read is not a usable clip. Skip it instead of
    // inventing a duration: a fabricated length lets a corrupt download (e.g. a
    // Google Drive sign-in page saved as .mp4) enter the timeline and only fail
    // much later, after the GPU stages have already run.
    const duration = await new Promise<number | null>((resolve) => {
      ffmpeg.ffprobe(fullPath, (err, metadata) => {
        const probed = Number(metadata?.format?.duration);
        if (err || !Number.isFinite(probed) || probed <= 0) resolve(null);
        else resolve(probed);
      });
    });
    if (duration === null) {
      console.warn(`[scanAssets] Melewati "${file}": ffprobe gagal membaca durasi (file rusak atau bukan video).`);
      continue;
    }
    results.push({ file: fullPath, duration });
  }
  return results;
}

export async function probeDuration(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const probed = Number(metadata?.format?.duration);
      if (err || !Number.isFinite(probed) || probed <= 0) {
        reject(new Error('Gagal membaca durasi file audio.'));
      } else {
        resolve(probed);
      }
    });
  });
}

