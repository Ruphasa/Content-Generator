import { NextRequest, NextResponse } from "next/server";
import { Communicate, SubMaker } from 'edge-tts-universal';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ success: false, error: "Text is required" }, { status: 400 });
    }

    const communicate = new Communicate(text, voice || 'id-ID-AndikaNeural');
    const subMaker = new SubMaker();
    
    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
      } else if (chunk.type === 'WordBoundary') {
        subMaker.feed(chunk); // Generate SRT timestamp per word
      }
    }
    
    const srtContent = subMaker.getSrt();
    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');
    
    // Save to public folder
    const fs = require('fs');
    const path = require('path');
    const timestamp = Date.now();
    const ttsDir = path.join(process.cwd(), 'public', 'generations', 'tts');
    fs.mkdirSync(ttsDir, { recursive: true });
    
    const audioPath = path.join(ttsDir, `tts_${timestamp}.mp3`);
    const srtPath = path.join(ttsDir, `subs_${timestamp}.srt`);
    
    fs.writeFileSync(audioPath, audioBuffer);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');

    // Calculate duration in seconds from SRT content
    let duration = 5.0; // fallback
    const timeMatches = [...srtContent.matchAll(/--> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
    if (timeMatches.length > 0) {
      const lastMatch = timeMatches[timeMatches.length - 1];
      const hours = parseInt(lastMatch[1], 10);
      const minutes = parseInt(lastMatch[2], 10);
      const seconds = parseInt(lastMatch[3], 10);
      const millis = parseInt(lastMatch[4], 10);
      duration = hours * 3600 + minutes * 60 + seconds + millis / 1000;
    }

    return NextResponse.json({ 
      success: true, 
      audioBase64: audioBase64,
      mimeType: 'audio/mpeg',
      srtContent: srtContent,
      duration: duration,
      savedPath: `/generations/tts/tts_${timestamp}.mp3`
    });

  } catch (error: any) {
    console.error("TTS Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
