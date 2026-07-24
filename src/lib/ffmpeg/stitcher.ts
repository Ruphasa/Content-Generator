import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export async function initFFmpeg() {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  // Note: For Next.js in production, you might need to host the core files locally
  // or use the CDN. We'll use the default unpkg CDN which fetchFile resolves to.
  // In a real Vercel deployment with COOP/COEP headers, this should work.
  await ffmpeg.load();
  
  return ffmpeg;
}

export interface StitcherInput {
  videoBase64?: string | null; 
  videoUrl?: string | null;
  bgmBase64?: string | null;
  ttsBase64?: string | null;
  duration?: number;
}

function base64ToUint8Array(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function stitchVideo(input: StitcherInput, onProgress?: (progress: number) => void): Promise<string> {
  const ffmpeg = await initFFmpeg();
  
  ffmpeg.on('progress', ({ progress, time }) => {
    if (onProgress) onProgress(progress);
  });

  const inputs = [];

  // Write files to virtual FS
  if (input.videoBase64) {
    await ffmpeg.writeFile('video.mp4', base64ToUint8Array(input.videoBase64));
    inputs.push({ name: 'video.mp4', type: 'video' });
  } else if (input.videoUrl) {
    try {
      await ffmpeg.writeFile('video.mp4', await fetchFile(input.videoUrl));
      inputs.push({ name: 'video.mp4', type: 'video' });
    } catch (e) {
      console.error("Failed to fetch videoUrl for ffmpeg", e);
    }
  }

  if (input.bgmBase64) {
    await ffmpeg.writeFile('bgm.mp3', base64ToUint8Array(input.bgmBase64));
    inputs.push({ name: 'bgm.mp3', type: 'audio' });
  }
  if (input.ttsBase64) {
    await ffmpeg.writeFile('tts.mp3', base64ToUint8Array(input.ttsBase64));
    inputs.push({ name: 'tts.mp3', type: 'audio' });
  }

  if (inputs.length === 0) {
    throw new Error("No media available to stitch.");
  }

  // Construct FFmpeg command dynamically
  const args = [];
  
  inputs.forEach(i => {
    args.push('-i', i.name);
  });

  // If we have video, bgm, and tts
  if (inputs.find(i => i.name === 'video.mp4') && inputs.find(i => i.name === 'bgm.mp3') && inputs.find(i => i.name === 'tts.mp3')) {
    args.push('-filter_complex', '[1:a]volume=0.3[bgm];[2:a]volume=1.0[tts];[bgm][tts]amix=inputs=2:duration=longest[aout]');
    args.push('-map', '0:v');
    args.push('-map', '[aout]');
    args.push('-c:v', 'copy');
    args.push('-c:a', 'aac');
    args.push('-shortest');
  } 
  // If we only have video and tts
  else if (inputs.find(i => i.name === 'video.mp4') && inputs.find(i => i.name === 'tts.mp3')) {
    args.push('-map', '0:v');
    args.push('-map', '1:a');
    args.push('-c:v', 'copy');
    args.push('-c:a', 'aac');
    args.push('-shortest');
  }
  // Fallback: just copy whatever is there
  else {
    args.push('-c', 'copy');
  }

  args.push('output.mp4');

  await ffmpeg.exec(args);

  let data;
  try {
    data = await ffmpeg.readFile('output.mp4');
  } catch (e) {
    throw new Error("FFmpeg failed to create output.mp4. Check if inputs were valid.");
  }
  
  // Clean up safely
  for (const i of inputs) {
    try { await ffmpeg.deleteFile(i.name); } catch(e){}
  }
  try { await ffmpeg.deleteFile('output.mp4'); } catch(e){}

  // Convert Uint8Array to Blob URL
  const blob = new Blob([data as any], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  
  return url;
}
