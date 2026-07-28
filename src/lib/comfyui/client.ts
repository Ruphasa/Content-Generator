/**
 * Minimal HTTP client for a locally running ComfyUI instance.
 *
 * Responsibility: transport only — queue a graph, poll until it finishes,
 * surface execution errors, and resolve/download the files it produced.
 * It knows nothing about SVD / ACE-Step / VoxCPM / Whisper; graph construction
 * lives in `./workflows`.
 *
 * Endpoints used (all part of ComfyUI's built-in aiohttp server):
 *   POST /prompt              -> queue a workflow, returns { prompt_id, ... }
 *   GET  /history/{prompt_id} -> { [prompt_id]: { status, outputs } }
 *   GET  /view?filename&subfolder&type -> raw bytes of an output file
 *   POST /upload/image        -> writes a file into ComfyUI's input directory
 *                                (generic file writer despite the name; the
 *                                multipart field must still be called "image")
 *
 * Env:
 *   COMFYUI_BASE_URL  (default "http://127.0.0.1:8188")
 */

export const DEFAULT_COMFYUI_BASE_URL = 'http://127.0.0.1:8188';

/** A reference to another node's output: [nodeId, outputSlotIndex]. */
export type ComfyNodeLink = [string, number];

export type ComfyInputValue = string | number | boolean | ComfyNodeLink;

/** A single node in ComfyUI's "API format" graph. */
export interface ComfyNode {
  class_type: string;
  inputs: Record<string, ComfyInputValue>;
}

/** An API-format workflow: node id -> node. */
export type ComfyWorkflow = Record<string, ComfyNode>;

/** Where a produced/consumed file lives, as ComfyUI reports it. */
export interface ComfyFileRef {
  filename: string;
  subfolder: string;
  type: 'output' | 'input' | 'temp';
}

/** Response of POST /upload/image. */
export interface ComfyUploadResult {
  name: string;
  subfolder: string;
  type: 'output' | 'input' | 'temp';
}

/** Response of a successful POST /prompt. */
export interface ComfyQueueResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

/** Body of a rejected POST /prompt (HTTP 400). */
interface ComfyPromptErrorResponse {
  error?: { type?: string; message?: string; details?: string };
  node_errors?: Record<string, unknown>;
}

export interface ComfyExecutionStatus {
  status_str: 'success' | 'error';
  completed: boolean;
  messages: unknown[];
}

/**
 * Per-node outputs. ComfyUI keys these by the node's UI payload key, e.g.
 * `images`/`gifs`/`audio`/`video` (arrays of file refs) or `text`
 * (array of strings, e.g. from PreviewAny).
 */
export type ComfyNodeOutput = Record<string, ComfyFileRef[] | string[] | undefined>;

export interface ComfyHistoryEntry {
  status?: ComfyExecutionStatus | null;
  outputs: Record<string, ComfyNodeOutput>;
}

export type ComfyHistoryResponse = Record<string, ComfyHistoryEntry>;

export interface ComfyUIClientOptions {
  baseUrl?: string;
  clientId?: string;
  /** Give up waiting for a prompt after this long. Default 10 minutes. */
  timeoutMs?: number;
  /** How often to poll /history while waiting. Default 2 seconds. */
  pollIntervalMs?: number;
}

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/** Errors raised by this client. `details` carries ComfyUI's node_errors when present. */
export class ComfyUIError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = 'ComfyUIError';
    this.status = options.status;
    this.details = options.details;
  }
}

function isFileRef(value: unknown): value is ComfyFileRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ComfyFileRef).filename === 'string' &&
    typeof (value as ComfyFileRef).type === 'string'
  );
}

function toBlob(data: Blob | ArrayBuffer | Uint8Array): Blob {
  if (data instanceof Blob) return data;
  if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return new Blob([copy.buffer]);
  }
  return new Blob([data]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ComfyUIClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: ComfyUIClientOptions = {}) {
    const configured = options.baseUrl ?? process.env.COMFYUI_BASE_URL ?? DEFAULT_COMFYUI_BASE_URL;
    this.baseUrl = configured.replace(/\/+$/, '');
    this.clientId = options.clientId ?? 'venturo-content-generator';
    this.timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
  }

  /** True if ComfyUI answers at all. Useful for a pre-flight check before a long job. */
  async isReachable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, { cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Queue a workflow. Returns the prompt id assigned by ComfyUI. */
  async queuePrompt(workflow: ComfyWorkflow): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
        cache: 'no-store',
      });
    } catch (error) {
      throw new ComfyUIError(
        `Tidak dapat menghubungi ComfyUI di ${this.baseUrl}: ${(error as Error).message}`,
      );
    }

    const raw = await response.text();

    if (!response.ok) {
      let parsed: ComfyPromptErrorResponse | null = null;
      try {
        parsed = JSON.parse(raw) as ComfyPromptErrorResponse;
      } catch {
        // Non-JSON error body; fall through to the raw text.
      }
      const message = parsed?.error?.message ?? raw ?? response.statusText;
      const details = parsed?.error?.details;
      throw new ComfyUIError(
        `ComfyUI menolak workflow (${response.status}): ${message}${details ? ` — ${details}` : ''}`,
        { status: response.status, details: parsed?.node_errors },
      );
    }

    const body = JSON.parse(raw) as ComfyQueueResponse;
    if (!body.prompt_id) {
      throw new ComfyUIError('ComfyUI tidak mengembalikan prompt_id.', { details: body });
    }
    return body.prompt_id;
  }

  /** Fetch one prompt's history entry. Returns null while it is still queued/running. */
  async getHistory(promptId: string): Promise<ComfyHistoryEntry | null> {
    const response = await fetch(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new ComfyUIError(
        `Gagal membaca history ComfyUI (${response.status} ${response.statusText}).`,
        { status: response.status },
      );
    }
    const body = (await response.json()) as ComfyHistoryResponse;
    return body[promptId] ?? null;
  }

  /**
   * Poll /history until the prompt finishes.
   * Throws on ComfyUI execution errors and on timeout — never resolves silently.
   */
  async waitForPrompt(promptId: string, options: WaitOptions = {}): Promise<ComfyHistoryEntry> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const pollIntervalMs = options.pollIntervalMs ?? this.pollIntervalMs;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const entry = await this.getHistory(promptId);
      const status = entry?.status;

      if (entry && status) {
        if (status.status_str === 'error') {
          throw new ComfyUIError(`Eksekusi ComfyUI gagal untuk prompt ${promptId}.`, {
            details: status.messages,
          });
        }
        if (status.completed) return entry;
      }

      await sleep(pollIntervalMs);
    }

    throw new ComfyUIError(
      `Prompt ComfyUI ${promptId} tidak selesai dalam ${Math.round(timeoutMs / 1000)} detik.`,
    );
  }

  /** Queue a workflow and wait for it to finish. */
  async runWorkflow(workflow: ComfyWorkflow, options: WaitOptions = {}): Promise<ComfyHistoryEntry> {
    const promptId = await this.queuePrompt(workflow);
    return this.waitForPrompt(promptId, options);
  }

  /**
   * Flatten every file produced by a finished prompt.
   * Pass `nodeId` to read only one node's outputs (e.g. the SaveVideo node).
   */
  collectOutputFiles(entry: ComfyHistoryEntry, nodeId?: string): ComfyFileRef[] {
    const nodes = nodeId
      ? entry.outputs[nodeId]
        ? { [nodeId]: entry.outputs[nodeId] }
        : {}
      : entry.outputs;

    const files: ComfyFileRef[] = [];
    for (const output of Object.values(nodes)) {
      for (const value of Object.values(output ?? {})) {
        if (!Array.isArray(value)) continue;
        for (const item of value) {
          if (isFileRef(item)) files.push(item);
        }
      }
    }
    return files;
  }

  /**
   * Text produced by a finished prompt (ComfyUI's `text` UI payload, e.g. PreviewAny).
   * Pass `nodeId` to read only one node's text.
   */
  collectOutputText(entry: ComfyHistoryEntry, nodeId?: string): string[] {
    const nodes = nodeId
      ? entry.outputs[nodeId]
        ? { [nodeId]: entry.outputs[nodeId] }
        : {}
      : entry.outputs;

    const texts: string[] = [];
    for (const output of Object.values(nodes)) {
      const value = output?.text;
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (typeof item === 'string') texts.push(item);
      }
    }
    return texts;
  }

  /** The URL that serves an output file's bytes. */
  viewUrl(file: ComfyFileRef): string {
    const params = new URLSearchParams({
      filename: file.filename,
      subfolder: file.subfolder ?? '',
      type: file.type,
    });
    return `${this.baseUrl}/view?${params.toString()}`;
  }

  /** Download an output file's bytes. */
  async downloadFile(file: ComfyFileRef): Promise<Buffer> {
    const response = await fetch(this.viewUrl(file), { cache: 'no-store' });
    if (!response.ok) {
      throw new ComfyUIError(
        `Gagal mengunduh "${file.filename}" dari ComfyUI (${response.status} ${response.statusText}).`,
        { status: response.status },
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Put a file into ComfyUI's input directory so LoadImage / LoadAudio can reference it.
   * Returns the name to use as that loader node's input value.
   */
  async uploadFile(
    data: Blob | ArrayBuffer | Uint8Array,
    filename: string,
    options: { subfolder?: string; type?: 'input' | 'temp' } = {},
  ): Promise<ComfyUploadResult> {
    const form = new FormData();
    form.append('image', toBlob(data), filename);
    form.append('type', options.type ?? 'input');
    form.append('subfolder', options.subfolder ?? '');
    // Overwrite avoids ComfyUI's duplicate-detection path, which assumes image files.
    form.append('overwrite', 'true');

    const response = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: form,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new ComfyUIError(
        `Gagal mengunggah "${filename}" ke ComfyUI (${response.status} ${response.statusText}).`,
        { status: response.status },
      );
    }
    return (await response.json()) as ComfyUploadResult;
  }
}
