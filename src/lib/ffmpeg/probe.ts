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
    const duration = await new Promise<number>((resolve) => {
      ffmpeg.ffprobe(fullPath, (err, metadata) => {
        if (err || !metadata?.format?.duration) resolve(5);
        else resolve(metadata.format.duration);
      });
    });
    results.push({ file: fullPath, duration });
  }
  return results;
}
