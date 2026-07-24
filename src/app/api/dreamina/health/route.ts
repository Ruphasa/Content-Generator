import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/dreamina/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await checkHealth();
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        baseUrl: process.env.JIMENG_API_BASE_URL || 'http://localhost:5100',
        model: process.env.DREAMINA_VIDEO_MODEL || 'jimeng-video-seedance-2.0-fast',
        message: `Error: ${error.message}`
      },
      { status: 500 }
    );
  }
}
