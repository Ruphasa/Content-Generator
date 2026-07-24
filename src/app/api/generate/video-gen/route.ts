import { NextResponse } from "next/server";
import { generateImageFromCloudflare } from "@/lib/cloudflare/image";
import { generateVideoFromImages } from "@/lib/dreamina/scraper";
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // Allow up to 5 mins for AI video generation

export async function POST(req: Request) {
  try {
    const { prompt, prompt1, prompt2 } = await req.json();

    console.log(`[Video-Gen-Mock] MOCK MODE AKTIF: Melompati T2I dan I2V untuk menghemat token/kuota...`);
    
    // Simulate a brief delay
    await new Promise(r => setTimeout(r, 2000));
    
    const timestamp = Date.now();
    
    return NextResponse.json({
      success: true,
      videoUrl: `/generations/video/video_1784780603361.mp4`, // Mock URL
      savedPath: `/generations/video/video_1784780603361.mp4`,
      duration: 5.0,
      source: 'dreamina_mock',
      mimeType: 'video/mp4'
    });

  } catch (error: any) {
    console.error("Video Gen Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
