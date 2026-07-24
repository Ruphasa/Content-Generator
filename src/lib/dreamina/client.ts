export interface DreaminaGenerateOptions {
  model?: string;
  ratio?: string;
  duration?: number;
  firstFrameImage?: string;
}

export interface DreaminaTaskResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  error?: string;
}

export interface DreaminaHealthResult {
  connected: boolean;
  baseUrl: string;
  model: string;
  message: string;
}

/**
 * Checks if the local jimeng-api wrapper service is reachable.
 */
export async function checkHealth(): Promise<DreaminaHealthResult> {
  const baseUrl = process.env.JIMENG_API_BASE_URL || 'http://localhost:5100';
  const model = process.env.DREAMINA_VIDEO_MODEL || 'jimeng-video-seedance-2.0-fast';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${baseUrl}/`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && (res.ok || res.status === 404 || res.status === 200)) {
      return {
        connected: true,
        baseUrl,
        model,
        message: 'Layanan jimeng-api terhubung (localhost:5100)'
      };
    }

    return {
      connected: false,
      baseUrl,
      model,
      message: 'Layanan jimeng-api tidak merespons pada port 5100'
    };
  } catch (err: any) {
    return {
      connected: false,
      baseUrl,
      model,
      message: `Gagal terhubung ke jimeng-api: ${err.message || 'Connection refused'}`
    };
  }
}

/**
 * Generates video using Dreamina/Jimeng API wrapper.
 * Supports smart polling internally via jimeng-api.
 */
export async function generateVideo(
  prompt: string,
  options: DreaminaGenerateOptions = {}
): Promise<DreaminaTaskResult> {
  const baseUrl = process.env.JIMENG_API_BASE_URL || 'http://localhost:5100';
  const sessionId = process.env.DREAMINA_SESSION_ID || '';
  const model = options.model || process.env.DREAMINA_VIDEO_MODEL || 'jimeng-video-seedance-2.0-fast';
  const ratio = options.ratio || '9:16';
  const duration = options.duration || 5;

  if (!sessionId || sessionId.includes('YOUR_SESSION_ID')) {
    return {
      success: false,
      error: 'DREAMINA_SESSION_ID belum dikonfigurasi di file .env.local'
    };
  }

  try {
    const payload: Record<string, any> = {
      model,
      prompt,
      ratio,
      duration,
    };

    if (options.firstFrameImage) {
      payload.first_frame_image = options.firstFrameImage;
    }

    console.log(`[Video-Gen] Menggunakan Session ID: ${sessionId.substring(0, 5)}...`);
    // Call jimeng-api video generation endpoint
    const response = await fetch(`${baseUrl}/v1/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionId}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("[Video-Gen] Jimeng response:", JSON.stringify(data, null, 2));

    if (!response.ok || data.error) {
      const errMsg = data.error || data.message || `HTTP ${response.status}`;
      return {
        success: false,
        error: `Dreamina API Error: ${errMsg}`
      };
    }

    // Extract video URL from OpenAI-compatible response format
    const videoUrl = data.data?.[0]?.url || data.video_url || data.url;

    if (!videoUrl) {
      return {
        success: false,
        error: 'Video URL tidak ditemukan dalam respon Dreamina API'
      };
    }

    return {
      success: true,
      videoUrl,
      taskId: data.id || data.task_id
    };

  } catch (error: any) {
    console.error('Dreamina Client Error:', error);
    return {
      success: false,
      error: error.message || 'Gagal menghubungi service Dreamina'
    };
  }
}
