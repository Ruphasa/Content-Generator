import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { customGroq } from '@/lib/groq';

export const maxDuration = 30;

// Initialize Supabase client for Server
// Using Anon Key here is fine because we enabled public read/write in RLS for the cache table.
// If you use Service Role Key, you can bypass RLS, but this is simpler for now.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  const json = await req.json();
  const messages = json.messages;
  let requestData = json.data || {};
  console.log("INCOMING PAYLOAD:", JSON.stringify(json, null, 2));
  let dnaContext = "";
  if (requestData && requestData.dnaState) {
    dnaContext = `
Kontek Klien Saat Ini (DNA Form State):
- Brand Name: ${requestData.dnaState.brandName || "Belum diisi"}
- Brand Overview: ${requestData.dnaState.brandOverview || "Belum diisi"}
- Visi: ${requestData.dnaState.visi || "Belum diisi"}
- Misi: ${requestData.dnaState.misi || "Belum diisi"}
- Target Audience: ${requestData.dnaState.targetAudience || "Belum diisi"}
- Tone of Voice: ${requestData.dnaState.tone || "Belum diisi"}
- Primary Font: ${requestData.dnaState.primaryFont || "Belum diisi"}
- Secondary Font: ${requestData.dnaState.secondaryFont || "Belum diisi"}
- Primary Color: ${requestData.dnaState.primaryColor || "Belum diisi"}
- Secondary Color: ${requestData.dnaState.secondaryColor || "Belum diisi"}
`;
  }

  const sanitizedMessages = messages.map((m: any) => ({
    role: m.role,
    content: m.text || m.content || (m.parts && m.parts[0]?.text) || ''
  }));

  // Caching Logic
  // We hash the system context + the latest user message to find identical queries
  let latestMessageContent = sanitizedMessages[sanitizedMessages.length - 1]?.content || "";
  try {
    const parsed = JSON.parse(latestMessageContent);
    if (parsed.text) latestMessageContent = parsed.text;
    if (parsed.dnaState) {
      requestData.dnaState = parsed.dnaState;
      dnaContext = `
Kontek Klien Saat Ini (DNA Form State):
- Brand Name: ${requestData.dnaState.brandName || "Belum diisi"}
- Brand Overview: ${requestData.dnaState.brandOverview || "Belum diisi"}
- Visi: ${requestData.dnaState.visi || "Belum diisi"}
- Misi: ${requestData.dnaState.misi || "Belum diisi"}
- Target Audience: ${requestData.dnaState.targetAudience || "Belum diisi"}
- Tone of Voice: ${requestData.dnaState.tone || "Belum diisi"}
- Primary Font: ${requestData.dnaState.primaryFont || "Belum diisi"}
- Secondary Font: ${requestData.dnaState.secondaryFont || "Belum diisi"}
- Primary Color: ${requestData.dnaState.primaryColor || "Belum diisi"}
- Secondary Color: ${requestData.dnaState.secondaryColor || "Belum diisi"}
`;
    }
  } catch(e) {}
  
  // Override the last message content so the LLM doesn't see raw JSON
  if (sanitizedMessages.length > 0) {
    sanitizedMessages[sanitizedMessages.length - 1].content = latestMessageContent;
  }

  const rawString = dnaContext + latestMessageContent;
  const hash = crypto.createHash('sha256').update(rawString).digest('hex');

  console.log("rawString for hash:", rawString);
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
      
      // Simulate the stream using the actual LLM (Fast Path) to guarantee perfect compatibility with the frontend's useChat
      const cacheResult = streamText({
        model: customGroq('llama-3.3-70b-versatile'),
        system: "Kamu adalah sistem pemroses teks otomatis. Tugasmu hanya satu: keluarkan teks yang diberikan oleh user sama persis, tanpa ditambahi pembukaan, penutup, atau tanda kutip tambahan.",
        messages: [{ role: 'user', content: cacheData.response_text }]
      });
      return (cacheResult as any).toUIMessageStreamResponse();
      }
    }
  } catch (e) {
    console.error("Cache lookup failed, proceeding to LLM:", e);
    // Proceed to LLM if table doesn't exist or other error
  }

  console.log("CACHE MISS! Calling Groq LLM.");

  const systemPrompt = `Kamu adalah asisten AI (Copilot) untuk aplikasi pembuat video otomatis. 
${dnaContext}

Gunakan konteks ini untuk memberikan saran yang relevan. Jika pengguna meminta saran font, warna, visi, misi, atau konten, berikan rekomendasi berdasarkan Category dan Tone mereka. Jangan menyebutkan bahwa kamu melihat form state ini secara eksplisit. Gunakan bahasa Indonesia yang santai, profesional, dan menyenangkan (seperti style Venturo).

PENTING: Jika kamu memberikan rekomendasi yang spesifik untuk di-apply ke form pengguna (seperti merekomendasikan Warna, Font, Visi, Misi, Slogan, atau Ide Konten), kamu WAJIB menyertakan blok JSON khusus di BARIS PALING AKHIR pesanmu. Gunakan tag [SUGGESTION_JSON] dan [/SUGGESTION_JSON] untuk mengapit JSON tersebut.
Format JSON-nya (pilih field "colors", "font", atau "text"):
[SUGGESTION_JSON]
{
  "type": "suggestion",
  "field": "colors|font|text",
  "options": [
    {"primaryColor": "#HEX", "secondaryColor": "#HEX", "label": "Tema Warna 1"} // Jika field="colors"
    // atau jika field="font"
    // {"fontFamily": "Inter", "label": "Modern & Clean"}
    // atau jika field="text"
    // {"text": "Isi rekomendasi visi/misi/slogan", "label": "Opsi 1"}
  ]
}
[/SUGGESTION_JSON]
`;

  const result = streamText({
    model: customGroq('llama-3.3-70b-versatile'), 
    system: systemPrompt,
    messages: sanitizedMessages,
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

  return (result as any).toUIMessageStreamResponse();
}
