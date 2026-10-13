import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mediaUrl = searchParams.get('url');
  let filename = searchParams.get('filename') || 'media.mp4';

  if (!mediaUrl) {
    return new NextResponse('Media URL parameter is required.', { status: 400 });
  }

  // Clean filename to be safe for Content-Disposition
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  const isFb = mediaUrl.includes('fbcdn.net') || mediaUrl.includes('facebook.com') || filename.startsWith('facebook_');
  const referer = isFb ? 'https://www.facebook.com/' : 'https://www.instagram.com/';

  try {
    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': '*/*'
      }
    });

    if (!upstreamRes.ok) {
      return new NextResponse(`Failed to fetch media from CDN (Status: ${upstreamRes.status})`, {
        status: upstreamRes.status
      });
    }

    const contentType = upstreamRes.headers.get('content-type') ||
      (filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : 'video/mp4');
    const contentLength = upstreamRes.headers.get('content-length');

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Type', contentType);
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    headers.set('Cache-Control', 'public, max-age=86400, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(upstreamRes.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Download stream error:', error);
    return new NextResponse('Internal error streaming download.', { status: 500 });
  }
}
