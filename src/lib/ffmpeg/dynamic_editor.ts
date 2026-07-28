import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

/**
 * Dynamic post-processing stage for the ComfyUI pipeline.
 *
 * Takes the raw parts produced by ComfyUI (silent SVD video, VoxCPM2 narration,
 * ACE-Step BGM, Whisper subtitles) and assembles them into one finished video
 * with real editing polish:
 *
 *   1. Ken Burns  - a smooth, centred zoom push over the whole clip.
 *   2. Ducking    - the BGM genuinely drops while the narration speaks
 *                   (sidechain compression, not a static amix blend).
 *   3. Subtitles  - styled and burned into the picture via libass.
 *
 * This module deliberately knows nothing about ComfyUI; it only takes file paths.
 */

// Resolve the ffmpeg binary the same way the rest of the app does
// (src/app/api/generate/stitch/route.ts). ffmpeg-static reports a path even when
// its postinstall never downloaded the binary, so existence is checked before use
// and we otherwise fall back to whatever ffmpeg is on PATH.
if (ffmpegStatic) {
  let ffmpegPath: string = ffmpegStatic;
  // Fix Next.js Turbopack path rewriting issue
  if (ffmpegPath.includes('\\ROOT\\')) {
    ffmpegPath = ffmpegPath.replace('\\ROOT\\', process.cwd() + '\\');
  }
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } else {
    console.warn(
      `[DynamicEditor] ffmpeg-static tidak ditemukan di ${ffmpegPath}, memakai ffmpeg dari PATH`
    );
  }
}

export interface RenderParams {
  /** Silent video produced by SVD. */
  videoPath: string;
  /** Narration track produced by VoxCPM2. */
  voicePath: string;
  /** Background music produced by ACE-Step. Omit to render without music. */
  bgmPath?: string;
  /** Whisper subtitles (.srt). Omit to render without burned-in captions. */
  srtPath?: string;
  /** Destination .mp4 path. */
  outputPath: string;
  /**
   * Clip length in seconds. The Ken Burns push is spread across exactly this
   * long, so passing the real duration gives a push that lasts the whole video.
   * Defaults to 10s, after which the zoom holds at its maximum.
   */
  durationSeconds?: number;
  /** Output canvas. Defaults to 1080x1920 (vertical social format). */
  width?: number;
  height?: number;
  /** Output frame rate. Defaults to 30. */
  fps?: number;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 10;

/** Total Ken Burns magnification across the clip (0.12 = a 12% push). */
const KEN_BURNS_ZOOM = 0.12;

/** Characters that are significant to the filtergraph or filter-argument parsers. */
const FILTER_SPECIAL_CHARS = /[\\':,[\];= ]/g;

/**
 * Escapes a filesystem path for use inside an FFmpeg filtergraph.
 *
 * A Windows path such as `C:\Users\ASUS\my subs.srt` breaks a filtergraph twice
 * over: the drive-letter colon reads as a filter-option separator and the
 * backslashes read as escape characters. Separators are therefore converted to
 * forward slashes, which FFmpeg accepts on Windows.
 *
 * The remaining specials are then escaped *twice*, because the value passes
 * through two parsers: the filtergraph parser splits the graph on `,` `;` `[`
 * `]`, and the filter-argument parser then splits on `:` and `=`. One round of
 * escaping only satisfies the outer pass. Quoting instead of escaping is the
 * more common advice, but a quoted section cannot contain a literal apostrophe
 * (it silently vanishes - a path like `C:\John's Videos\a.srt` resolves to
 * `Johns Videos` and the render dies), so uniform double escaping is used and
 * the value is left unquoted.
 *
 * Verified against ffmpeg over 21 path shapes covering drive letters, spaces,
 * apostrophes, commas, semicolons and brackets.
 */
function escapeFilterPath(filePath: string): string {
  const forwardSlashed = path.resolve(filePath).replace(/\\/g, '/');
  const escapedOnce = forwardSlashed.replace(FILTER_SPECIAL_CHARS, (c) => '\\' + c);
  return escapedOnce.replace(FILTER_SPECIAL_CHARS, (c) => '\\' + c);
}

/**
 * Builds the Ken Burns chain.
 *
 * `zoompan` is the obvious tool but is the wrong one here: it works per *input*
 * frame with `d` output frames each, which on a video stream (rather than a
 * still) yields a timing mess, and its crop window is positioned on integer
 * pixels, which visibly jitters. Instead the frame is progressively enlarged
 * with `scale` using per-frame expression evaluation and then cropped back to a
 * fixed canvas - the scale-up-then-crop approach. Measured on a frozen yuv420p
 * source this was ~1.6x smoother than a 2x-upscaled `zoompan` and ~4x smoother
 * than rounding the intermediate size to even pixels.
 *
 * The crop offsets are derived from `t` rather than the usual
 * `(in_w-out_w)/2`. `crop` re-evaluates its expressions per frame, but `in_w` /
 * `in_h` keep the values captured when the filter was configured, so while the
 * scale really does grow the frame, `(in_w-out_w)/2` stays 0 and the push
 * silently anchors to the top-left corner. Computing the offset from the known
 * canvas size and elapsed time keeps the push centred. (Confirmed by hashing
 * frames: `(in_w-out_w)/2` produced output byte-identical to `x=0:y=0`.)
 */
function buildKenBurnsChain(width: number, height: number, fps: number, duration: number): string[] {
  // Zoom progress, 0 -> 1 across the clip, then held.
  const p = `min(t/${duration},1)`;
  // Grow the frame; expressions are single-quoted so their commas are not read
  // as filtergraph separators.
  const zoomW = `'${width}*(1+${KEN_BURNS_ZOOM}*${p})'`;
  const zoomH = `'${height}*(1+${KEN_BURNS_ZOOM}*${p})'`;
  // Horizontally centred; vertically drifts slightly upward as it pushes in so
  // the move reads as a Ken Burns rather than a plain zoom.
  const cropX = `'${width}*${KEN_BURNS_ZOOM}*${p}*0.5'`;
  const cropY = `'${height}*${KEN_BURNS_ZOOM}*${p}*(0.5-0.3*${p})'`;

  return [
    // Normalise whatever SVD handed us onto the output canvas and frame rate.
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},setsar=1,fps=${fps}[v_base]`,
    `[v_base]scale=w=${zoomW}:h=${zoomH}:eval=frame:flags=bicubic,` +
      `crop=w=${width}:h=${height}:x=${cropX}:y=${cropY}[v_kb]`,
  ];
}

/**
 * Builds the audio chain.
 *
 * With BGM this is real ducking, not a blend. The narration is `asplit` in two
 * because a filter input can only be consumed once: one copy drives
 * `sidechaincompress` as the sidechain key, the other is mixed back in at full
 * level. `sidechaincompress` takes the signal to be compressed first and the key
 * second, so the music is the main input and the voice is the trigger - the
 * music ducks whenever the voice is present and recovers when it stops.
 * Measured attenuation: about -11 dB under speech.
 */
function buildAudioChain(hasBgm: boolean): string[] {
  const fmt = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

  if (!hasBgm) {
    // Nothing to duck against; just conform the narration.
    return [`[1:a]${fmt}[a_out]`];
  }

  return [
    `[1:a]${fmt},asplit=2[voice_main][voice_key]`,
    `[2:a]${fmt},volume=0.35[bgm_level]`,
    `[bgm_level][voice_key]sidechaincompress=` +
      `threshold=0.02:ratio=12:attack=15:release=350:makeup=1:level_sc=1[bgm_ducked]`,
    `[voice_main][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,` +
      `alimiter=limit=0.95[a_out]`,
  ];
}

/**
 * Burned-in, styled captions. The plan calls for "dynamic subtitles", so this
 * uses the libass `subtitles` filter with a real `force_style` and renders the
 * text into the picture, rather than muxing a passive soft-subtitle track.
 */
function buildSubtitleChain(srtPath: string): string[] {
  const style = [
    'FontName=Arial',
    'FontSize=42',
    'Bold=1',
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    'BorderStyle=1',
    'Outline=3',
    'Shadow=1',
    'Alignment=2',
    'MarginV=140',
  ].join(',');

  // The filename is escaped rather than quoted (see escapeFilterPath); the style
  // string has no such constraint and stays quoted so its commas survive.
  return [`[v_kb]subtitles=${escapeFilterPath(srtPath)}:force_style='${style}'[v_out]`];
}

/**
 * Renders the finished video and resolves with `outputPath`.
 */
export async function renderDynamicVideo(params: RenderParams): Promise<string> {
  const {
    videoPath,
    voicePath,
    bgmPath,
    srtPath,
    outputPath,
    durationSeconds = DEFAULT_DURATION,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    fps = DEFAULT_FPS,
  } = params;

  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video sumber tidak ditemukan: ${videoPath}`);
  }
  if (!voicePath || !fs.existsSync(voicePath)) {
    throw new Error(`Audio narasi tidak ditemukan: ${voicePath}`);
  }

  // Optional inputs are dropped rather than trusted, so a stale path from an
  // upstream step cannot take the whole render down.
  const bgmFile = bgmPath && fs.existsSync(bgmPath) ? bgmPath : undefined;
  const srtFile = srtPath && fs.existsSync(srtPath) ? srtPath : undefined;
  if (bgmPath && !bgmFile) {
    console.warn(`[DynamicEditor] BGM diabaikan, file tidak ditemukan: ${bgmPath}`);
  }
  if (srtPath && !srtFile) {
    console.warn(`[DynamicEditor] Subtitle diabaikan, file tidak ditemukan: ${srtPath}`);
  }

  const outputDir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const duration = durationSeconds > 0 ? durationSeconds : DEFAULT_DURATION;

  const filters = [
    ...buildKenBurnsChain(width, height, fps, duration),
    ...(srtFile ? buildSubtitleChain(srtFile) : []),
    ...buildAudioChain(Boolean(bgmFile)),
  ];
  // Without subtitles the Ken Burns output is already the final video node.
  const videoOut = srtFile ? 'v_out' : 'v_kb';
  const filterGraph = filters.join(';');

  return new Promise<string>((resolve, reject) => {
    const stderrLines: string[] = [];

    const command = ffmpeg()
      .input(videoPath)
      .input(voicePath);

    if (bgmFile) {
      command.input(bgmFile);
    }

    command
      // fluent-ffmpeg's second argument is the output mapping; there is no
      // `.map()` method on the command.
      .complexFilter(filters, [videoOut, 'a_out'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset veryfast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-b:a 192k',
        '-movflags +faststart',
        // Stop at the end of the shortest mapped stream so the picture and the
        // narration cannot drift apart.
        '-shortest',
      ])
      .on('stderr', (line: string) => {
        stderrLines.push(line);
        // Keep memory bounded on long renders; the tail is what matters.
        if (stderrLines.length > 200) stderrLines.shift();
      })
      .on('error', (err: Error) => {
        // fluent-ffmpeg's Error carries no stderr, which is exactly where the
        // reason lives, so both that and the graph are attached here.
        reject(
          new Error(
            `Gagal merender video dinamis: ${err.message}\n` +
              `--- filter_complex ---\n${filterGraph}\n` +
              `--- ffmpeg stderr ---\n${stderrLines.join('\n')}`
          )
        );
      })
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}
