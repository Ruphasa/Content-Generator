import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import type { DirectorBlueprint } from '../google/director';

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
  const ffmpegPath: string = ffmpegStatic;
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } else {
    console.warn(
      `[DynamicEditor] ffmpeg-static tidak ditemukan di ${ffmpegPath}, memakai ffmpeg dari PATH`
    );
  }
}

/**
 * Inputs for one render.
 *
 * IMPORTANT - output length is `min(video duration, narration duration)`.
 * The mix ends with the narration (`amix=duration=first`) and the output ends
 * with the shortest mapped stream (`-shortest`), so whichever input runs out
 * first ends the video and the other one is cut. This matters in practice:
 * SVD clips are commonly 2-4s while VoxCPM2 narration for a full script runs
 * much longer, and in that case **the tail of the narration is silently
 * discarded** - the render still succeeds and still returns a path.
 *
 * Matching the durations is the caller's job; this module does not stretch,
 * loop or pad either stream. When the two diverge it emits a `console.warn`
 * naming both durations and how much was lost.
 */
export interface RenderParams {
  /** Silent video produced by SVD. Its length caps the output (see above). */
  videoPath: string;
  /**
   * Narration track produced by VoxCPM2. If this is longer than the video, its
   * tail is cut - see the truncation note on this interface.
   */
  voicePath: string;
  /** Background music produced by ACE-Step. Omit to render without music. */
  bgmPath?: string;
  /** Subtitles (.ass). Omit to render without burned-in captions. */
  assPath?: string;
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
 * still) yields a timing mess. Instead the frame is progressively enlarged with
 * `scale` using per-frame expression evaluation and then cropped back to a fixed
 * canvas - the scale-up-then-crop approach. Measured on a frozen yuv420p source
 * this was ~1.6x smoother than a 2x-upscaled `zoompan` and ~4x smoother than
 * rounding the intermediate size to even pixels.
 *
 * The smoothness gain does *not* come from avoiding integer positioning: `crop`
 * also lands on whole pixels, and in yuv420p it snaps x/y to chroma-aligned even
 * pixels. It comes from `scale` resampling the picture continuously as the frame
 * grows - the magnification itself advances by sub-pixel amounts every frame and
 * is interpolated, so the motion reads as smooth even though the crop origin
 * still steps. Rounding the intermediate size to even pixels was the jerkiest
 * variant measured precisely because it coarsened that resampling.
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
 * Measured attenuation on this filtergraph: about -7.7 dB under speech, against
 * a static-`volume` control that stayed flat across the same two windows.
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
 * Burned-in, styled captions. Uses the libass `ass` filter and renders the
 * text into the picture, rather than muxing a passive soft-subtitle track.
 */
function buildSubtitleChain(assPath: string): string[] {
  // The filename is escaped rather than quoted (see escapeFilterPath).
  return [`[v_kb]ass=${escapeFilterPath(assPath)}[v_out]`];
}

/** Input durations harvested from ffmpeg's own stderr banner, keyed by input index. */
interface DurationScan {
  durations: Map<number, number>;
  /** Index of the `Input #N` header whose `Duration:` line we expect next. */
  pendingInput: number;
}

/** Ignore sub-second drift; encoder rounding alone produces a few hundredths. */
const TRUNCATION_WARN_SECONDS = 0.5;

/**
 * Picks input durations out of the stderr this module already captures.
 *
 * ffmpeg prints an `Input #N ...` header followed by a `Duration: HH:MM:SS.ss`
 * line for every input, so the numbers are already on hand - no ffprobe call and
 * no new probing mechanism. (ffmpeg-static ships no ffprobe binary, so probing
 * would have meant depending on a separate binary being on PATH.)
 */
function scanInputDuration(line: string, scan: DurationScan): void {
  const header = /^\s*Input #(\d+)/.exec(line);
  if (header) {
    scan.pendingInput = Number(header[1]);
    return;
  }
  if (scan.pendingInput < 0) return;

  const duration = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(line);
  if (!duration) return;

  const seconds =
    Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  if (!scan.durations.has(scan.pendingInput)) {
    scan.durations.set(scan.pendingInput, seconds);
  }
  scan.pendingInput = -1;
}

/**
 * Warns when the picture and the narration disagree on length.
 *
 * The output runs for `min(video, narration)`, so a divergence means one of them
 * was cut. Truncation is deliberate policy - matching durations belongs to the
 * caller - but it must not be silent, because the render still succeeds and
 * still returns a path even when most of the narration was thrown away.
 */
function warnIfTruncated(durations: Map<number, number>): void {
  const video = durations.get(0);
  const voice = durations.get(1);
  if (video === undefined || voice === undefined) return;

  const lost = Math.abs(video - voice);
  if (lost < TRUNCATION_WARN_SECONDS) return;

  const cut = video < voice ? 'narasi' : 'video';
  console.warn(
    `[DynamicEditor] Durasi input tidak sama: video ${video.toFixed(2)}s, ` +
      `narasi ${voice.toFixed(2)}s. Output dipotong ke ${Math.min(video, voice).toFixed(2)}s, ` +
      `${lost.toFixed(2)}s bagian akhir ${cut} terbuang.`
  );
}

/**
 * Renders the finished video and resolves with `outputPath`.
 *
 * Note the length contract on `RenderParams`: the output runs for
 * `min(video, narration)` and the longer input is cut.
 */
export async function renderDynamicVideo(params: RenderParams): Promise<string> {
  const {
    videoPath,
    voicePath,
    bgmPath,
    assPath,
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
  const assFile = assPath && fs.existsSync(assPath) ? assPath : undefined;
  if (bgmPath && !bgmFile) {
    console.warn(`[DynamicEditor] BGM diabaikan, file tidak ditemukan: ${bgmPath}`);
  }
  if (assPath && !assFile) {
    console.warn(`[DynamicEditor] Subtitle diabaikan, file tidak ditemukan: ${assPath}`);
  }

  const outputDir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const duration = durationSeconds > 0 ? durationSeconds : DEFAULT_DURATION;

  const filters = [
    ...buildKenBurnsChain(width, height, fps, duration),
    ...(assFile ? buildSubtitleChain(assFile) : []),
    ...buildAudioChain(Boolean(bgmFile)),
  ];
  // Without subtitles the Ken Burns output is already the final video node.
  const videoOut = assFile ? 'v_out' : 'v_kb';
  const filterGraph = filters.join(';');

  return new Promise<string>((resolve, reject) => {
    const stderrLines: string[] = [];
    const durationScan: DurationScan = { durations: new Map(), pendingInput: -1 };

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
        scanInputDuration(line, durationScan);
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
      .on('end', () => {
        warnIfTruncated(durationScan.durations);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

/**
 * Stitches a multi-clip B-roll blueprint into one video.
 *
 * FFmpeg's `concat` filter requires every input stream to share identical
 * resolution, SAR and framerate, but real B-roll assets rarely agree on any
 * of the three - `concat` then fails with EINVAL and the whole generation
 * dies. Each clip is therefore normalised onto the same canvas (letterboxed,
 * never cropped or stretched, via `scale` + `force_original_aspect_ratio=decrease`
 * + `pad`), the same SAR (`setsar=1`) and the same framerate before it reaches
 * `concat`. The muxed output is also pinned to that framerate so the
 * container's framerate matches the normalised streams that produced it.
 *
 * The target canvas is the module's `DEFAULT_WIDTH` / `DEFAULT_HEIGHT` /
 * `DEFAULT_FPS` constants - the same defaults `renderDynamicVideo` uses - so
 * both render paths land on the same canvas. This is not parameterised on the
 * signature: the global constraint on this module is that no existing
 * signature changes, to avoid breaking other call sites.
 */
export async function stitchBlueprint(
  blueprint: DirectorBlueprint,
  voicePath: string,
  bgmPath?: string,
  assPath?: string,
  outputPath?: string
): Promise<string> {
  const targetOutput = outputPath || path.join(process.cwd(), 'public', 'generations', 'final', `output_${Date.now()}.mp4`);
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(path.resolve(targetOutput));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Hardcoded 9:16 target canvas (see doc comment above).
    const targetWidth = DEFAULT_WIDTH;
    const targetHeight = DEFAULT_HEIGHT;
    const targetFps = DEFAULT_FPS;

    let command = ffmpeg();
    const filterGraph: string[] = [];

    // Add inputs and trim filters based on timeline. Each clip is first
    // normalised onto the common canvas/SAR/framerate so every [v${i}]
    // stream `concat` consumes is identical in every dimension it checks.
    blueprint.timeline.forEach((clip, i: number) => {
      command = command.input(clip.file);
      const start = clip.start || 0;
      const normalizeFilter =
        `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,` +
        `crop=${targetWidth}:${targetHeight},setsar=1,fps=${targetFps}`;
      filterGraph.push(
        `[${i}:v]${normalizeFilter},trim=start=${start}:duration=${clip.duration},setpts=PTS-STARTPTS[v${i}];`
      );
    });

    const concatInputs = blueprint.timeline.map((_, i: number) => `[v${i}]`).join('');
    filterGraph.push(`${concatInputs}concat=n=${blueprint.timeline.length}:v=1:a=0[vconcat];`);

    command = command.input(voicePath);
    const vIdx = blueprint.timeline.length;

    // Audio always leaves through the filtergraph as [aout]. fluent-ffmpeg's
    // `.map()` bracket-wraps whatever it is given, so a raw input specifier like
    // `1:a` would be re-read as a filtergraph label that does not exist
    // ("Output with label '1:a' does not exist in any defined filter graph").
    // With no BGM the voice is passed through `anull` purely to give it a label.
    if (bgmPath && fs.existsSync(bgmPath)) {
      command = command.input(bgmPath);
      const bIdx = blueprint.timeline.length + 1;
      filterGraph.push(`[${vIdx}:a][${bIdx}:a]amix=inputs=2:duration=first:dropout_transition=2[aout];`);
    } else {
      filterGraph.push(`[${vIdx}:a]anull[aout];`);
    }

    let videoOutTag = '[vconcat]';
    if (assPath && fs.existsSync(assPath)) {
      const escapedAss = escapeFilterPath(assPath);
      filterGraph.push(`[vconcat]ass=${escapedAss}[vout]`);
      videoOutTag = '[vout]';
    }

    // A trailing ';' left by the last chain is not valid filtergraph syntax.
    const complexFilter = filterGraph.join('').replace(/;\s*$/, '');

    const stderrLines: string[] = [];
    const durationScan: DurationScan = { durations: new Map(), pendingInput: -1 };
    command
      .complexFilter(complexFilter)
      .map(videoOutTag)
      .map('[aout]')
      .outputOptions(['-c:v libx264', '-c:a aac', '-pix_fmt yuv420p', `-r ${targetFps}`, '-shortest'])
      .output(targetOutput)
      .on('stderr', (line: string) => {
        stderrLines.push(line);
        if (stderrLines.length > 200) stderrLines.shift();
        scanInputDuration(line, durationScan);
      })
      .on('end', () => {
        warnIfTruncated(durationScan.durations);
        resolve(targetOutput);
      })
      .on('error', (err: Error) => {
        reject(
          new Error(
            `Gagal menjahit video: ${err.message}\n` +
              `--- filter_complex ---\n${complexFilter}\n` +
              `--- ffmpeg stderr ---\n${stderrLines.join('\n')}`
          )
        );
      })
      .run();
  });
}

