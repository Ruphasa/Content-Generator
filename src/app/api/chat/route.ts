import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const maxDuration = 30;

// Initialize Supabase client for Server
// Using Anon Key here is fine because we enabled public read/write in RLS for the cache table.
// If you use Service Role Key, you can bypass RLS, but this is simpler for now.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  const { messages, data } = await req.json();

  let dnaContext = "";
  if (data && data.dnaData) {
    dnaContext = `
Kontek Klien Saat Ini (DNA Form State):
- Brand Name: ${data.dnaData.brandName || "Belum diisi"}
- Category: ${data.dnaData.category || "Belum diisi"}
- Core Identity: ${data.dnaData.coreIdentity || "Belum diisi"}
- Audience: ${data.dnaData.audience || "Belum diisi"}
- Tone: ${data.dnaData.tone || "Belum diisi"}
- Font: ${data.dnaData.font || "Belum diisi"}
- Aspect Ratio: ${data.dnaData.aspectRatio || "Belum diisi"}

Gunakan konteks ini untuk memberikan saran yang relevan. Jika pengguna meminta saran font, berikan rekomendasi berdasarkan Category dan Tone mereka. Jangan menyebutkan bahwa kamu melihat JSON atau form state ini secara eksplisit, bersikaplah seolah-olah kamu adalah asisten (Copilot) proaktif yang menemani mereka mengisi form. Gunakan bahasa Indonesia yang santai, profesional, dan menyenangkan (seperti style Venturo).
`;
  }

  // Caching Logic
  // We hash the system context + the latest user message to find identical queries
  const latestMessage = messages[messages.length - 1]?.content || "";
  const rawString = dnaContext + latestMessage;
  const hash = crypto.createHash('sha256').update(rawString).digest('hex');

  console.log("Checking cache for hash:", hash);

  try {
    if (supabase) {
      const { data: cacheData, error: cacheError } = await supabase
      .from('ai_responses_cache')
      .select('response_text')
      .eq('prompt_hash', hash)
      .maybeSingle();

    if (cacheData && cacheData.response_text) {
      console.log("CACHE HIT! Returning stored response.");
      
      // Simulate a streaming response for the UI
      // We yield words one by one to trick the frontend into thinking it's typing
      const words = cacheData.response_text.split(' ');
      
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < words.length; i++) {
            // AI SDK expects data stream format (0: text)
            // https://sdk.vercel.ai/docs/reference/ai-sdk-ui/stream-parts
            controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(words[i] + (i < words.length - 1 ? ' ' : ''))}\n`));
            await new Promise((resolve) => setTimeout(resolve, 20)); // simulated delay
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1',
        },
      });
      }
    }
  } catch (e) {
    console.error("Cache lookup failed, proceeding to LLM:", e);
    // Proceed to LLM if table doesn't exist or other error
  }

  console.log("CACHE MISS! Calling Groq LLM.");

  const systemMessage = {
    role: 'system',
    content: `Kamu adalah asisten AI (Copilot) untuk aplikasi pembuat video otomatis. ${dnaContext}`
  };

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'), 
    messages: [systemMessage, ...messages],
    async onFinish({ text }) {
      // Save to cache after streaming is finished
      try {
        if (supabase) {
          await supabase
            .from('ai_responses_cache')
            .insert({
              prompt_hash: hash,
              response_text: text
            });
          console.log("Successfully saved response to cache.");
        }
      } catch (e) {
        console.error("Failed to save to cache:", e);
      }
    }
  });

  return result.toTextStreamResponse();
}
