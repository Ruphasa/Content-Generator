import { NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes to allow for multi-video downloading and FFmpeg processing

if (ffmpegStatic) {
  const ffmpegPath = ffmpegStatic;
  
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } else {
    console.warn(`[FFmpeg] ffmpeg-static not found at ${ffmpegPath}, falling back to system ffmpeg in PATH`);
  }
}

export async function POST(req: Request) {
  const tmpFiles: string[] = [];
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();

  try {
    const { ttsBase64, bgmBase64, srtContent, scenes, generatedVideoUrl } = await req.json();

    if (!ttsBase64) {
      return NextResponse.json({ success: false, error: 'TTS audio is required' }, { status: 400 });
    }

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ success: false, error: 'No scenes provided to stitch' }, { status: 400 });
    }

    // 1. Download/Prepare all video inputs
    console.log(`Starting FFmpeg Stitching preparation in ${tmpDir}`);
    const localScenes: any[] = [];
    let sceneIndex = 0;

    for (const scene of scenes) {
      let videoUrlToFetch = scene.sourceUrl;
      // If the scene is AI generated, or sourceUrl is missing, fallback to generatedVideoUrl
      if (scene.type === 'generated' || !videoUrlToFetch) {
        videoUrlToFetch = generatedVideoUrl;
      }

      if (!videoUrlToFetch) {
        console.warn(`Scene ${sceneIndex} missing video URL, skipping...`);
        continue;
      }

      let finalScenePath = '';
      if (videoUrlToFetch.startsWith('/')) {
        finalScenePath = path.join(process.cwd(), 'public', videoUrlToFetch);
        console.log(`Using local video for scene ${sceneIndex}: ${finalScenePath}`);
      } else {
        finalScenePath = path.join(tmpDir, `scene_${timestamp}_${sceneIndex}.mp4`);
        console.log(`Downloading video for scene ${sceneIndex} from ${videoUrlToFetch}...`);
        const vRes = await fetch(videoUrlToFetch);
        if (!vRes.ok) {
          console.warn(`Failed to download video from ${videoUrlToFetch}, skipping scene...`);
          continue;
        }
        fs.writeFileSync(finalScenePath, Buffer.from(await vRes.arrayBuffer()));
        tmpFiles.push(finalScenePath);
      }

      localScenes.push({
        ...scene,
        localPath: finalScenePath,
        inputIndex: sceneIndex
      });
      sceneIndex++;
    }

    if (localScenes.length === 0) {
      throw new Error("Gagal mengunduh semua video yang dibutuhkan untuk scene.");
    }

    // 2. Prepare Audio & Subtitles
    const ttsPath = path.join(tmpDir, `tts_${timestamp}.mp3`);
    fs.writeFileSync(ttsPath, Buffer.from(ttsBase64, 'base64'));
    tmpFiles.push(ttsPath);

    let bgmPath = '';
    if (bgmBase64) {
      bgmPath = path.join(tmpDir, `bgm_${timestamp}.mp3`);
      fs.writeFileSync(bgmPath, Buffer.from(bgmBase64, 'base64'));
      tmpFiles.push(bgmPath);
    }

    let srtPath = '';
    if (srtContent) {
      srtPath = path.join(tmpDir, `subs_${timestamp}.srt`);
      fs.writeFileSync(srtPath, srtContent, 'utf-8');
      tmpFiles.push(srtPath);
    }

    // Output path to public folder instead of tmpDir
    const finalDir = path.join(process.cwd(), 'public', 'generations', 'final');
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    const outputPath = path.join(finalDir, `final_${timestamp}.mp4`);
    // don't push to tmpFiles because we want to keep it

    // 3. Build FFmpeg Command for Multi-Asset Stitching
    await new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Add video inputs
      for (const scene of localScenes) {
        const inputOpts = [];
        if (scene.startTime !== undefined && scene.startTime !== null) {
          inputOpts.push(`-ss ${scene.startTime}`);
        }
        if (scene.endTime !== undefined && scene.endTime !== null) {
          inputOpts.push(`-to ${scene.endTime}`);
        }
        command = command.input(scene.localPath).inputOptions(inputOpts);
      }

      // Add audio inputs
      command = command.input(ttsPath);
      const ttsInputIndex = localScenes.length;
      let bgmInputIndex = -1;

      if (bgmPath) {
        command = command.input(bgmPath);
        bgmInputIndex = localScenes.length + 1;
      }

      let filterComplex = '';
      let concatInputs = '';

      // Standardize resolution (1080x1920) and FPS (30) for all video inputs
      for (let i = 0; i < localScenes.length; i++) {
        filterComplex += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}];`;
        concatInputs += `[v${i}]`;
      }

      // Concat all standardized videos
      filterComplex += `${concatInputs}concat=n=${localScenes.length}:v=1:a=0[concat_v];`;

      // Subtitles
      let videoOutputNode = '[concat_v]';
      if (srtPath) {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        filterComplex += `[concat_v]subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&H00FFFF&,Alignment=2,MarginV=20'[v_sub];`;
        videoOutputNode = '[v_sub]';
      }

      // Audio mix
      if (bgmPath) {
        filterComplex += `[${ttsInputIndex}:a]volume=1.0[tts];[${bgmInputIndex}:a]volume=0.2[bgm];[tts][bgm]amix=inputs=2:duration=first:dropout_transition=2[final_a]`;
      } else {
        filterComplex += `[${ttsInputIndex}:a]volume=1.0[final_a]`;
      }

      command = command
        .complexFilter(filterComplex, [videoOutputNode.replace(/[\[\]]/g, ''), 'final_a'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-shortest', // Ensure video stops when the shortest stream (usually audio/tts) ends
        ])
        .save(outputPath)
        .on('end', () => resolve(true))
        .on('error', (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        });
    });

    // 4. Cleanup temp files
    for (const file of tmpFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }

    return NextResponse.json({ 
      success: true, 
      videoUrl: `/generations/final/final_${timestamp}.mp4`
    });

  } catch (error: any) {
    console.error("Stitching Error:", error);
    for (const file of tmpFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
