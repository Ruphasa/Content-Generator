/**
 * ComfyUI API-format workflow builders.
 *
 * One builder == one model == one queued prompt. This is deliberate: the target
 * machine has 8GB of VRAM, so we never ask ComfyUI to hold SVD + ACE-Step +
 * VoxCPM resident at the same time. Task 4 queues these sequentially and lets
 * ComfyUI's model manager swap each checkpoint from RAM into VRAM in turn.
 *
 * Every graph below terminates in a real OUTPUT node — ComfyUI rejects a prompt
 * that has none ("Prompt has no outputs").
 *
 * Model inputs take a name RELATIVE to the matching ComfyUI models directory
 * (e.g. "svd.safetensors" resolves to ComfyUI/models/checkpoints/svd.safetensors,
 * an UNETLoader name resolves under ComfyUI/models/diffusion_models, a CLIPLoader
 * name under models/text_encoders, a VAELoader name under models/vae).
 * Never pass an absolute filesystem path here.
 *
 * SVD is loaded from a single checkpoint (ImageOnlyCheckpointLoader). ACE-Step is
 * NOT: the working local install keeps its three parts as separate files, so
 * `buildMusicWorkflow` uses UNETLoader + CLIPLoader + VAELoader instead of
 * CheckpointLoaderSimple. Their filenames default to the local build artifacts
 * and are overridable via COMFYUI_ACE_STEP_UNET / _CLIP / _VAE.
 *
 * ── Node contract verification ────────────────────────────────────────────────
 * VERIFIED against ComfyUI core source (comfy_extras/nodes_video_model.py,
 * nodes_ace.py, nodes_audio.py, nodes_video.py, nodes_preview_any.py, nodes.py):
 *   ImageOnlyCheckpointLoader, SVD_img2vid_Conditioning, VideoLinearCFGGuidance,
 *   LoadImage, LoadAudio, KSampler, VAEDecode, VAEDecodeAudio, CreateVideo,
 *   SaveVideo, UNETLoader, CLIPLoader, VAELoader, TextEncodeAceStepAudio,
 *   EmptyAceStepLatentAudio, ConditioningZeroOut, ModelSamplingSD3,
 *   SaveAudioMP3, PreviewAny.
 *
 * BEST-EFFORT / UNVERIFIED-PENDING-INSTALL — these are custom nodes, so the
 * class names depend on which pack is actually installed on the machine. The
 * defaults below were read from the upstream repositories, but nobody has run
 * them here yet. Override via env if your install differs:
 *   VoxCPM2_TTS   (Saganaki22/ComfyUI-VoxCPM2)   -> COMFYUI_VOXCPM_TTS_CLASS
 *   Apply Whisper (yuvraj108c/ComfyUI-Whisper)   -> COMFYUI_WHISPER_CLASS
 *   Save SRT      (yuvraj108c/ComfyUI-Whisper)   -> COMFYUI_SAVE_SRT_CLASS
 */

import type { ComfyWorkflow } from './client';

// ─── Defaults (override with the matching env var) ────────────────────────────

/** Stable Video Diffusion checkpoint, relative to ComfyUI/models/checkpoints. */
export const DEFAULT_SVD_CHECKPOINT = 'svd_xt.safetensors';
/**
 * ACE-Step diffusion transformer, relative to ComfyUI/models/diffusion_models.
 * Override with COMFYUI_ACE_STEP_UNET.
 */
export const DEFAULT_ACE_STEP_UNET = 'ace_step_transformer.safetensors';
/**
 * ACE-Step text encoder, relative to ComfyUI/models/text_encoders. Built locally
 * by `inject_spiece.py`. Override with COMFYUI_ACE_STEP_CLIP.
 */
export const DEFAULT_ACE_STEP_CLIP = 'umt5_base_ace.safetensors';
/**
 * Combined ACE-Step music DCAE + vocoder VAE, relative to ComfyUI/models/vae.
 * Built locally by `merge_ace_vae.py`. Override with COMFYUI_ACE_STEP_VAE.
 */
export const DEFAULT_ACE_STEP_VAE = 'music_dcae_vocoder_combined.safetensors';
/** VoxCPM model folder name under ComfyUI/models/tts/VoxCPM. */
export const DEFAULT_VOXCPM_MODEL = 'VoxCPM2';
/** Whisper model size accepted by ComfyUI-Whisper's combo widget. */
export const DEFAULT_WHISPER_MODEL = 'base';

/** UNVERIFIED custom-node class type — confirm after installing the node pack. */
export const DEFAULT_VOXCPM_TTS_CLASS = 'VoxCPM2_TTS';
/** UNVERIFIED custom-node class type — confirm after installing the node pack. */
export const DEFAULT_WHISPER_CLASS = 'Apply Whisper';
/** UNVERIFIED custom-node class type — confirm after installing the node pack. */
export const DEFAULT_SAVE_SRT_CLASS = 'Save SRT';

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000_000_000);
}

// ─── 1. Image → Video (Stable Video Diffusion, core ComfyUI) ──────────────────

/**
 * Node id of the SaveVideo node in `buildImageToVideoWorkflow`.
 * Address outputs by id — `/history` outputs are an object, so relying on the
 * position of a flattened array is a bug waiting for a graph edit.
 */
export const IMAGE_TO_VIDEO_OUTPUT_NODE = '8';

export interface ImageToVideoOptions {
  /** Filename inside ComfyUI's input directory (see ComfyUIClient.uploadFile). */
  imageName: string;
  width?: number;
  height?: number;
  /** 14 for svd.safetensors, 25 for svd_xt.safetensors. */
  videoFrames?: number;
  /** Higher = more motion. */
  motionBucketId?: number;
  fps?: number;
  augmentationLevel?: number;
  steps?: number;
  cfg?: number;
  /** CFG at the first frame; ramps up to `cfg` by the last frame. */
  minCfg?: number;
  seed?: number;
  filenamePrefix?: string;
}

/**
 * SVD image-to-video. Defaults target the 14-frame `svd.safetensors` at
 * 1024x576 — the heaviest step in the pipeline and the one most likely to OOM
 * on 8GB. Bump `videoFrames` to 25 only alongside COMFYUI_SVD_CHECKPOINT=svd_xt.
 */
export function buildImageToVideoWorkflow(options: ImageToVideoOptions): ComfyWorkflow {
  const {
    imageName,
    width = 1024,
    height = 576,
    videoFrames = 14,
    motionBucketId = 127,
    fps = 6,
    augmentationLevel = 0.0,
    steps = 20,
    cfg = 2.5,
    minCfg = 1.0,
    seed = randomSeed(),
    filenamePrefix = 'video/venturo_scene',
  } = options;

  return {
    '1': {
      class_type: 'ImageOnlyCheckpointLoader',
      inputs: { ckpt_name: env('COMFYUI_SVD_CHECKPOINT', DEFAULT_SVD_CHECKPOINT) },
    },
    '2': {
      class_type: 'LoadImage',
      inputs: { image: imageName },
    },
    '3': {
      class_type: 'SVD_img2vid_Conditioning',
      inputs: {
        clip_vision: ['1', 1],
        init_image: ['2', 0],
        vae: ['1', 2],
        width,
        height,
        video_frames: videoFrames,
        motion_bucket_id: motionBucketId,
        fps,
        augmentation_level: augmentationLevel,
      },
    },
    '4': {
      class_type: 'VideoLinearCFGGuidance',
      inputs: { model: ['1', 0], min_cfg: minCfg },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['4', 0],
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'karras',
        positive: ['3', 0],
        negative: ['3', 1],
        latent_image: ['3', 2],
        denoise: 1.0,
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
    },
    '7': {
      class_type: 'CreateVideo',
      inputs: { images: ['6', 0], fps },
    },
    '8': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['7', 0],
        filename_prefix: filenamePrefix,
        format: 'mp4',
        codec: 'h264',
      },
    },
  };
}

// ─── 2. Background music (ACE-Step, core ComfyUI) ─────────────────────────────

/** Node id of the SaveAudioMP3 node in `buildMusicWorkflow`. */
export const MUSIC_OUTPUT_NODE = '8';

export interface MusicOptions {
  /** Comma-separated style/genre/mood tags, e.g. "cinematic, uplifting, piano". */
  tags: string;
  /** Leave empty for an instrumental bed. */
  lyrics?: string;
  seconds?: number;
  lyricsStrength?: number;
  steps?: number;
  cfg?: number;
  /** ModelSamplingSD3 shift; ACE-Step's reference workflow uses 5.0. */
  shift?: number;
  seed?: number;
  filenamePrefix?: string;
}

/** ACE-Step text-to-music, mirroring ComfyUI's official ACE-Step v1 template. */
export function buildMusicWorkflow(options: MusicOptions): ComfyWorkflow {
  const {
    tags,
    lyrics = '',
    seconds = 30,
    lyricsStrength = 1.0,
    steps = 50,
    cfg = 5.0,
    shift = 5.0,
    seed = randomSeed(),
    filenamePrefix = 'audio/venturo_bgm',
  } = options;

  return {
    // ACE-Step is loaded as three separate components rather than via
    // CheckpointLoaderSimple: the working local install keeps the transformer,
    // the spiece-injected text encoder and the merged DCAE+vocoder VAE as
    // individual files. Each is env-overridable so a second machine can point
    // at its own filenames without editing this file.
    '1a': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: env('COMFYUI_ACE_STEP_UNET', DEFAULT_ACE_STEP_UNET),
        weight_dtype: 'default',
      },
    },
    '1b': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: env('COMFYUI_ACE_STEP_CLIP', DEFAULT_ACE_STEP_CLIP), type: 'ace' },
    },
    '1c': {
      class_type: 'VAELoader',
      inputs: { vae_name: env('COMFYUI_ACE_STEP_VAE', DEFAULT_ACE_STEP_VAE) },
    },
    '2': {
      class_type: 'TextEncodeAceStepAudio',
      inputs: { clip: ['1b', 0], tags, lyrics, lyrics_strength: lyricsStrength },
    },
    '3': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['2', 0] },
    },
    '4': {
      class_type: 'EmptyAceStepLatentAudio',
      inputs: { seconds, batch_size: 1 },
    },
    '5': {
      class_type: 'ModelSamplingSD3',
      inputs: { model: ['1a', 0], shift },
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        model: ['5', 0],
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'simple',
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        denoise: 1.0,
      },
    },
    '7': {
      class_type: 'VAEDecodeAudio',
      inputs: { samples: ['6', 0], vae: ['1c', 0] },
    },
    // SaveAudioMP3 is flagged deprecated on ComfyUI master but is still registered
    // and is what the official ACE-Step template uses; it is the option that works
    // across the widest range of ComfyUI versions. Its replacement,
    // SaveAudioAdvanced, needs a newer DynamicCombo-style `format` input.
    '8': {
      class_type: 'SaveAudioMP3',
      inputs: { audio: ['7', 0], filename_prefix: filenamePrefix, quality: 'V0' },
    },
  };
}

// ─── 3. Narration (VoxCPM2 TTS, CUSTOM NODE — contract unverified) ────────────

/** Node id of the SaveAudioMP3 node in `buildNarrationWorkflow`. */
export const NARRATION_OUTPUT_NODE = '2';

export interface NarrationOptions {
  text: string;
  /** Voice design prompt, e.g. "A warm Indonesian female narrator". */
  voiceDescription?: string;
  cfgValue?: number;
  inferenceTimesteps?: number;
  maxTokens?: number;
  seed?: number;
  /** Unload the TTS model after the run — on by default to free VRAM for SVD. */
  forceOffload?: boolean;
  filenamePrefix?: string;
}

/**
 * VoxCPM2 text-to-speech.
 *
 * UNVERIFIED-PENDING-INSTALL: `VoxCPM2_TTS` and its input keys were read from
 * Saganaki22/ComfyUI-VoxCPM2 upstream source, not from a running instance. If a
 * different VoxCPM pack is installed, set COMFYUI_VOXCPM_TTS_CLASS and expect
 * the input names to differ too.
 */
export function buildNarrationWorkflow(options: NarrationOptions): ComfyWorkflow {
  const {
    text,
    voiceDescription = '',
    cfgValue = 2.0,
    inferenceTimesteps = 10,
    maxTokens = 4096,
    seed = randomSeed(),
    forceOffload = true,
    filenamePrefix = 'audio/venturo_narration',
  } = options;

  return {
    '1': {
      class_type: env('COMFYUI_VOXCPM_TTS_CLASS', DEFAULT_VOXCPM_TTS_CLASS),
      inputs: {
        model_name: env('COMFYUI_VOXCPM_MODEL', DEFAULT_VOXCPM_MODEL),
        lora_name: 'None',
        voice_description: voiceDescription,
        text,
        cfg_value: cfgValue,
        inference_timesteps: inferenceTimesteps,
        max_tokens: maxTokens,
        normalize_text: true,
        seed,
        force_offload: forceOffload,
        dtype: 'auto',
        device: env('COMFYUI_VOXCPM_DEVICE', 'cuda'),
        torch_compile: false,
      },
    },
    '2': {
      class_type: 'SaveAudioMP3',
      inputs: { audio: ['1', 0], filename_prefix: filenamePrefix, quality: 'V0' },
    },
  };
}

// ─── 4. Transcription (Whisper, CUSTOM NODE — contract unverified) ────────────

/**
 * Node id of the PreviewAny that reports the .srt path written by `Save SRT`.
 * Both PreviewAny nodes emit a `text` payload, so `collectOutputText` without a
 * node id returns the SRT path and the raw transcript in key order — always ask
 * for one of these ids instead.
 */
export const TRANSCRIPTION_SRT_PATH_NODE = '4';
/** Node id of the PreviewAny that reports the plain transcript text. */
export const TRANSCRIPTION_TEXT_NODE = '5';
/**
 * Subfolder (under ComfyUI/output) that `Save SRT` writes into. The node is not
 * an OUTPUT node, so `/history` carries no ComfyFileRef for the .srt — callers
 * must build `{ filename, subfolder: this, type: 'output' }` themselves before
 * downloading it through /view.
 */
export const TRANSCRIPTION_SRT_SUBFOLDER = 'srt';

export interface TranscriptionOptions {
  /** Audio filename inside ComfyUI's input directory (see ComfyUIClient.uploadFile). */
  audioName: string;
  /** tiny | base | small | medium | large-v3 | turbo … */
  model?: string;
  /** "auto", or a capitalised language name such as "Indonesian". */
  language?: string;
  /**
   * Base name for the .srt written to ComfyUI/output/srt.
   *
   * REQUIRED, and it must be unique per run. `SaveSRTNode.save_srt` upstream is
   * `os.path.join(output_dir, name) + ".srt"` opened with a plain `'w'` — no
   * counter, no dedup, straight overwrite — so a shared default would let two
   * concurrent runs collide on one file and burn each other's subtitles. There is
   * deliberately no default here: uniqueness has to be the caller's decision.
   */
  srtName: string;
}

/**
 * Whisper transcription of an already-uploaded audio file. Writes an SRT to
 * ComfyUI/output/srt/<srtName>.srt for Task 3's subtitle burn-in, and previews
 * the resulting path plus the raw transcript so both come back through /history.
 *
 * UNVERIFIED-PENDING-INSTALL: `Apply Whisper` / `Save SRT` and their input keys
 * were read from yuvraj108c/ComfyUI-Whisper upstream source, not from a running
 * instance. Override with COMFYUI_WHISPER_CLASS / COMFYUI_SAVE_SRT_CLASS.
 *
 * Note: `Save SRT` is not itself an OUTPUT node, so node "4" (core PreviewAny)
 * is what makes this graph terminal and legal for ComfyUI to accept.
 */
export function buildTranscriptionWorkflow(options: TranscriptionOptions): ComfyWorkflow {
  const {
    audioName,
    srtName,
    model = env('COMFYUI_WHISPER_MODEL', DEFAULT_WHISPER_MODEL),
    language = 'auto',
  } = options;

  return {
    '1': {
      class_type: 'LoadAudio',
      inputs: { audio: audioName },
    },
    '2': {
      class_type: env('COMFYUI_WHISPER_CLASS', DEFAULT_WHISPER_CLASS),
      inputs: { audio: ['1', 0], model, language, prompt: '' },
    },
    '3': {
      // Input slot 1 of Apply Whisper is `segments_alignment`.
      class_type: env('COMFYUI_SAVE_SRT_CLASS', DEFAULT_SAVE_SRT_CLASS),
      inputs: { alignment: ['2', 1], name: srtName },
    },
    '4': {
      class_type: 'PreviewAny',
      inputs: { source: ['3', 0] },
    },
    '5': {
      // Slot 0 of Apply Whisper is the plain transcript text.
      class_type: 'PreviewAny',
      inputs: { source: ['2', 0] },
    },
  };
}
