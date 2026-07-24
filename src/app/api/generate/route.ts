import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const customStream = new ReadableStream({
    async start(controller) {
      function sendProgress(message: string, data?: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message, ...data })}\n\n`));
      }

      try {
        const origin = new URL(req.url).origin;
        sendProgress("Memulai AI Director (MOCKED)...", { progress: 10 });

        const plan = {
          narration: "Halo semua, hari ini kita akan menguji coba integrasi sistem ffmpeg untuk menggabungkan video, suara, dan teks.",
          bgmPrompt: "",
          caption: "Test caption",
          scenes: [
            { type: "generated", sourceUrl: origin + "/generations/video/video_1784780603361.mp4" }
          ]
        };
        sendProgress("Editing Plan berhasil dibuat!", { progress: 30, plan });

        sendProgress("Membuat Voice-over (TTS)...", { progress: 40 });

        // TTS Task (Keep Real)
        const ttsRes = await fetch(`${origin}/api/generate/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: plan.narration, voice: "id-ID-AndikaNeural" })
        }).then(r => r.json());

        if (!ttsRes.success) throw new Error(ttsRes.error || "TTS failed");

        // BGM Task (MOCK)
        const bgmPath = path.join(process.cwd(), 'public', 'generations', 'bgm', 'Porter Robinson - dullscythe (Skybreak Remix) [No Copyright Music] [t-oJODEZha0].mp3');
        const bgmBuffer = await fs.promises.readFile(bgmPath);
        const bgmBase64 = bgmBuffer.toString('base64');

        // Video Gen Task (MOCK)
        const videoUrl = origin + "/generations/video/video_1784780603361.mp4";

        sendProgress("Aset Audio/Video berhasil di-generate!", { progress: 70 });

        sendProgress("Siap untuk In-Browser Stitching", { 
          progress: 80, 
          action: 'STITCH',
          data: {
            ttsBase64: ttsRes.audioBase64,
            bgmBase64: bgmBase64,
            srtContent: ttsRes.srtContent,
            videoUrl: videoUrl,
            videoBase64: null,
            videoSource: "dummy",
            plan: plan
          } 
        });

      } catch (error: any) {
        sendProgress("Error", { error: error.message, progress: 0 });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
