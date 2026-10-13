import { NextResponse } from 'next/server';
import { extractMedia, parseSocialUrl } from '@/lib/extractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, sessionId, cobaltInstance, cobaltApiKey } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const parsed = parseSocialUrl(url);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid link. Please paste a link to an Instagram post, reel, or Facebook video, reel, or post.'
        },
        { status: 400 }
      );
    }

    const result = await extractMedia(url, {
      sessionId,
      cobaltInstance,
      cobaltApiKey
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to extract media from the link.'
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "url" is required.' },
      { status: 400 }
    );
  }

  try {
    const result = await extractMedia(url);
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
