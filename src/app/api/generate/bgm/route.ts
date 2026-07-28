import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { prompt, tags, title } = await req.json();

    // Legacy route, superseded by ACE-Step in src/app/actions/generate.ts.
    console.log(`[BGM-Mock] MOCK MODE AKTIF: mengembalikan BGM statis, bukan hasil generate...`);
    
    // Simulate a brief delay
    await new Promise(r => setTimeout(r, 1000));
    
    const bgmPath = path.join(process.cwd(), 'public', 'generations', 'bgm', 'Porter Robinson - dullscythe (Skybreak Remix) [No Copyright Music] [t-oJODEZha0].mp3');
    const audioBuffer = fs.readFileSync(bgmPath);

    return NextResponse.json({ 
      success: true, 
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/mpeg',
      savedPath: `/generations/bgm/Porter Robinson - dullscythe (Skybreak Remix) [No Copyright Music] [t-oJODEZha0].mp3`
    });

  } catch (error: any) {
    console.error("BGM Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
