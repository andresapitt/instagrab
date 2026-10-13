import * as cheerio from 'cheerio';

const ENCODING_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Helper to unescape JSON/HTML strings
 */
function decodeEscaped(str) {
  if (!str) return null;
  let s = str.replace(/\\\//g, '/').replace(/\\u0025/g, '%').replace(/\\u0026/g, '&');
  try {
    s = JSON.parse(`"${str}"`);
  } catch {}
  return s.replace(/&amp;/g, '&');
}

/**
 * Converts an Instagram shortcode (e.g., "CmUvM3Cjj-G") to its numeric PK (Media ID)
 */
export function shortcodeToPk(shortcode) {
  let cleanCode = shortcode;
  if (cleanCode.length > 28) {
    cleanCode = cleanCode.slice(0, -28);
  }
  let base = BigInt(64);
  let pk = BigInt(0);
  for (let i = 0; i < cleanCode.length; i++) {
    const char = cleanCode[i];
    const index = BigInt(ENCODING_CHARS.indexOf(char));
    if (index === -1n) continue;
    pk = pk * base + index;
  }
  return pk.toString();
}

/**
 * Detects whether an input is from Instagram or Facebook
 */
export function detectPlatform(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/(?:facebook\.com|fb\.watch|fb\.me)\b/i.test(trimmed)) {
    return 'facebook';
  }
  if (/(?:instagram\.com|instagr\.am)\b/i.test(trimmed) || /^[A-Za-z0-9_-]{9,20}$/.test(trimmed)) {
    return 'instagram';
  }
  return null;
}

/**
 * Extracts and normalizes the Instagram shortcode and post URL from any raw text or link
 */
export function parseInstagramUrl(input) {
  if (!input || typeof input !== 'string') return null;

  // Match URL inside text (handles mobile share strings like "Check this out: https://instagram.com/reel/...")
  const urlMatch = input.match(/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/[a-zA-Z0-9_\-]+)\/([A-Za-z0-9_-]+)/i)
    || input.match(/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:[a-zA-Z0-9._-]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);

  if (urlMatch) {
    const shortcode = urlMatch[1];
    return {
      platform: 'instagram',
      shortcode,
      canonicalUrl: `https://www.instagram.com/p/${shortcode}/`,
      type: input.includes('/reel/') || input.includes('/reels/') ? 'reel' : 'post'
    };
  }

  // Check if raw shortcode was pasted (e.g. 11 alphanumeric characters)
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{9,20}$/.test(trimmed)) {
    return {
      platform: 'instagram',
      shortcode: trimmed,
      canonicalUrl: `https://www.instagram.com/p/${trimmed}/`,
      type: 'post'
    };
  }

  return null;
}

/**
 * Extracts and normalizes Facebook video, reel, or post URL from any raw text or link
 */
export function parseFacebookUrl(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  const isFb = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?(?:facebook\.com|fb\.watch|fb\.me)\b/i.test(trimmed);
  if (!isFb) return null;

  const urlMatch = trimmed.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:facebook\.com|fb\.watch|fb\.me)\/[^\s<>"']+/i);
  const targetUrl = urlMatch ? urlMatch[0] : (trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

  let type = 'video';
  if (targetUrl.includes('/reel/') || targetUrl.includes('/share/r/')) {
    type = 'reel';
  } else if (targetUrl.includes('/photo') || targetUrl.includes('/photos/')) {
    type = 'photo';
  } else if (targetUrl.includes('/posts/') || targetUrl.includes('/story.php')) {
    type = 'post';
  }

  let id = 'facebook_media';
  const idMatch = targetUrl.match(/(?:videos|reel|watch|posts|photos|r|v)\/(?:[^\s/?#]+\/)?([0-9A-Za-z_-]+)/i) ||
                  targetUrl.match(/[?&](?:v|story_fbid|fbid)=([0-9A-Za-z_-]+)/i) ||
                  targetUrl.match(/fb\.watch\/([0-9A-Za-z_-]+)/i);

  if (idMatch) {
    id = idMatch[1];
  } else {
    id = `fb_${Date.now()}`;
  }

  return {
    platform: 'facebook',
    id,
    shortcode: id,
    canonicalUrl: targetUrl,
    type
  };
}

/**
 * Unified parser for both Instagram and Facebook links
 */
export function parseSocialUrl(input) {
  const platform = detectPlatform(input);
  if (platform === 'facebook') {
    return parseFacebookUrl(input);
  }
  if (platform === 'instagram') {
    return parseInstagramUrl(input);
  }
  return null;
}

/**
 * Strategy 1 (Instagram): Fetch via Instagram Mobile API or Web GraphQL using optional sessionid cookie
 */
async function fetchViaInstagramSession(shortcode, sessionId) {
  if (!sessionId) return null;
  const pk = shortcodeToPk(shortcode);

  // Normalize session cookie header
  let cookieHeader = sessionId.trim();
  const userIdMatch = cookieHeader.match(/(\d{6,})%3A/) || cookieHeader.match(/(\d{6,}):/) || cookieHeader.match(/ds_user_id=(\d+)/);
  if (!cookieHeader.includes('sessionid=')) {
    cookieHeader = `sessionid=${cookieHeader}`;
  }
  if (userIdMatch && !cookieHeader.includes('ds_user_id=')) {
    cookieHeader = `${cookieHeader}; ds_user_id=${userIdMatch[1]}`;
  }

  // 1A. Try Mobile API with iOS header
  try {
    const apiUrl = `https://i.instagram.com/api/v1/media/${pk}/info/`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Instagram 319.0.0.38.109 (iPhone14,3; iOS 17_4; en_US; en-US; scale=3.00; 1284x2778; 576822237)',
        'X-IG-App-ID': '124024574287414',
        'X-ASBD-ID': '359341',
        'X-IG-WWW-Claim': '0',
        'Cookie': cookieHeader,
        'Accept': '*/*',
        'Accept-Language': 'en-US'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.items && data.items.length > 0) {
        const item = data.items[0];
        const author = {
          username: item.user?.username || 'instagram_user',
          fullName: item.user?.full_name || '',
          avatar: item.user?.profile_pic_url || null
        };
        const caption = item.caption?.text || '';

        // Check carousel media
        if (item.carousel_media && Array.isArray(item.carousel_media) && item.carousel_media.length > 0) {
          const media = item.carousel_media.map((child, idx) => {
            const isVideo = child.media_type === 2 || !!child.video_versions;
            const downloadUrl = isVideo && child.video_versions?.[0]
              ? child.video_versions[0].url
              : child.image_versions2?.candidates?.[0]?.url;
            const thumb = child.image_versions2?.candidates?.[0]?.url || downloadUrl;
            return {
              type: isVideo ? 'video' : 'image',
              url: downloadUrl,
              thumbnail: thumb,
              width: child.original_width || 1080,
              height: child.original_height || 1080,
              filename: `instagrab_${shortcode}_${idx + 1}.${isVideo ? 'mp4' : 'jpg'}`
            };
          });

          return {
            success: true,
            platform: 'instagram',
            engine: 'instagram_authenticated_mobile',
            shortcode,
            url: `https://www.instagram.com/p/${shortcode}/`,
            type: 'carousel',
            author,
            caption,
            media
          };
        }

        // Single video or photo
        const isVideo = item.media_type === 2 || !!item.video_versions;
        const downloadUrl = isVideo && item.video_versions?.[0]
          ? item.video_versions[0].url
          : item.image_versions2?.candidates?.[0]?.url;
        const thumb = item.image_versions2?.candidates?.[0]?.url || downloadUrl;

        return {
          success: true,
          platform: 'instagram',
          engine: 'instagram_authenticated_mobile',
          shortcode,
          url: `https://www.instagram.com/p/${shortcode}/`,
          type: isVideo ? 'video' : 'image',
          author,
          caption,
          media: [
            {
              type: isVideo ? 'video' : 'image',
              url: downloadUrl,
              thumbnail: thumb,
              width: item.original_width || 1080,
              height: item.original_height || 1920,
              filename: `instagrab_${shortcode}_1.${isVideo ? 'mp4' : 'jpg'}`
            }
          ]
        };
      }
    }
  } catch {}

  // 1B. Fallback: Try Web GraphQL endpoint (ideal for desktop/browser session cookies)
  try {
    const gqlUrl = `https://www.instagram.com/graphql/query/?doc_id=10015901848480474&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`;
    const gqlRes = await fetch(gqlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '129477',
        'Cookie': cookieHeader,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Site': 'same-origin',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (gqlRes.ok) {
      const gqlData = await gqlRes.json();
      const mediaData = gqlData?.data?.xdt_shortcode_media;
      if (mediaData) {
        const author = {
          username: mediaData.owner?.username || 'instagram_user',
          fullName: mediaData.owner?.full_name || '',
          avatar: mediaData.owner?.profile_pic_url || null
        };
        const caption = mediaData.edge_media_to_caption?.edges?.[0]?.node?.text || '';

        // Carousel items
        if (mediaData.edge_sidecar_to_children?.edges?.length > 0) {
          const media = mediaData.edge_sidecar_to_children.edges.map((edge, idx) => {
            const node = edge.node;
            const isVideo = node.is_video || !!node.video_url;
            const downloadUrl = isVideo ? node.video_url : node.display_url;
            return {
              type: isVideo ? 'video' : 'image',
              url: downloadUrl,
              thumbnail: node.display_url || downloadUrl,
              filename: `instagrab_${shortcode}_${idx + 1}.${isVideo ? 'mp4' : 'jpg'}`
            };
          });

          return {
            success: true,
            platform: 'instagram',
            engine: 'instagram_authenticated_web',
            shortcode,
            url: `https://www.instagram.com/p/${shortcode}/`,
            type: 'carousel',
            author,
            caption,
            media
          };
        }

        // Single video or image
        const isVideo = mediaData.is_video || !!mediaData.video_url;
        const downloadUrl = isVideo ? mediaData.video_url : mediaData.display_url;
        return {
          success: true,
          platform: 'instagram',
          engine: 'instagram_authenticated_web',
          shortcode,
          url: `https://www.instagram.com/p/${shortcode}/`,
          type: isVideo ? 'video' : 'image',
          author,
          caption,
          media: [
            {
              type: isVideo ? 'video' : 'image',
              url: downloadUrl,
              thumbnail: mediaData.display_url || downloadUrl,
              filename: `instagrab_${shortcode}_1.${isVideo ? 'mp4' : 'jpg'}`
            }
          ]
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Strategy 2 (Instagram): Extract via Instagram OpenGraph & Embed page parsing
 */
async function fetchViaInstagramEmbed(shortcode) {
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const $ = cheerio.load(html);

    // Check for author
    const username = $('.UsernameText').text().trim() || $('.EmbedUsernameText').text().trim() || 'instagram_user';
    const avatar = $('.EmbeddedMediaAvatarImage').attr('src') || null;
    const caption = $('.Caption').text().trim() || $('.EmbedCaption').text().trim() || '';

    // Check for video tag
    const videoSrc = $('video').attr('src') || $('video source').attr('src');
    if (videoSrc) {
      const thumb = $('video').attr('poster') || $('img.EmbeddedMediaImage').attr('src');
      return {
        success: true,
        platform: 'instagram',
        engine: 'embed_video',
        shortcode,
        url: `https://www.instagram.com/p/${shortcode}/`,
        type: 'video',
        author: { username, fullName: '', avatar },
        caption,
        media: [
          {
            type: 'video',
            url: videoSrc.replace(/&amp;/g, '&'),
            thumbnail: thumb ? thumb.replace(/&amp;/g, '&') : null,
            filename: `instagrab_${shortcode}_1.mp4`
          }
        ]
      };
    }

    // Check for image tag
    const imgSrc = $('img.EmbeddedMediaImage').attr('src');
    if (imgSrc) {
      return {
        success: true,
        platform: 'instagram',
        engine: 'embed_image',
        shortcode,
        url: `https://www.instagram.com/p/${shortcode}/`,
        type: 'image',
        author: { username, fullName: '', avatar },
        caption,
        media: [
          {
            type: 'image',
            url: imgSrc.replace(/&amp;/g, '&'),
            thumbnail: imgSrc.replace(/&amp;/g, '&'),
            filename: `instagrab_${shortcode}_1.jpg`
          }
        ]
      };
    }

    // Regex check for embedded CDN URLs in embed HTML
    const videoMatches = [...html.matchAll(/"video_url":\s*"([^"]+)"/g)].map(m => m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
    if (videoMatches.length > 0) {
      const displayMatches = [...html.matchAll(/"display_url":\s*"([^"]+)"/g)].map(m => m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
      return {
        success: true,
        platform: 'instagram',
        engine: 'embed_regex_video',
        shortcode,
        url: `https://www.instagram.com/p/${shortcode}/`,
        type: 'video',
        author: { username, fullName: '', avatar },
        caption,
        media: [
          {
            type: 'video',
            url: videoMatches[0],
            thumbnail: displayMatches[0] || null,
            filename: `instagrab_${shortcode}_1.mp4`
          }
        ]
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves Facebook shortlinks (fb.watch, fb.me, /share/r/, /share/v/, /share/)
 * to their full canonical URL. Facebook rejects desktop user-agents on shortlinks with HTTP 400,
 * but returns 302 Found to Facebook crawler or mobile user agents.
 */
export async function resolveFacebookShortlink(url) {
  if (!url || typeof url !== 'string') return url;

  const isShortlink = /(?:fb\.watch|fb\.me|\/share\/[rv]?\/)/i.test(url);
  if (!isShortlink) return url;

  // 1. Try Facebook crawler User-Agent (fastest and most reliable for shortlink redirects)
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });

    const location = res.headers.get('location');
    if (location) {
      return location.startsWith('http') ? location : new URL(location, 'https://www.facebook.com').toString();
    }
  } catch {}

  // 2. Fallback to iPhone User-Agent
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
      },
      signal: AbortSignal.timeout(6000)
    });

    const location = res.headers.get('location');
    if (location) {
      return location.startsWith('http') ? location : new URL(location, 'https://www.facebook.com').toString();
    }
  } catch {}

  return url;
}

/**
 * Strategy (Facebook): Direct Native Scraper for Facebook Videos, Reels & Posts
 */
async function fetchViaNativeFacebook(url, id) {
  const targetUrlResolved = await resolveFacebookShortlink(url);
  async function parseHtml(targetUrl, userAgent) {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Site': 'none'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') ||
                  $('meta[name="twitter:title"]').attr('content') ||
                  $('title').text().replace(/\s*\|\s*Facebook$/i, '').trim();

    const caption = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="twitter:description"]').attr('content') ||
                    title;

    // Check HD video keys
    const hdMatch = html.match(/browser_native_hd_url["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/playable_url_quality_hd["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/hd_src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/hd_src_no_ratelimit["']?\s*:\s*["']([^"']+)["']/i);

    // Check SD video keys
    const sdMatch = html.match(/browser_native_sd_url["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/playable_url["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/sd_src["']?\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/sd_src_no_ratelimit["']?\s*:\s*["']([^"']+)["']/i);

    const ogVideo = $('meta[property="og:video"]').attr('content') ||
                    $('meta[property="og:video:secure_url"]').attr('content') ||
                    $('meta[property="og:video:url"]').attr('content');

    const hdUrl = decodeEscaped(hdMatch?.[1]);
    const sdUrl = decodeEscaped(sdMatch?.[1]);
    const videoUrl = hdUrl || sdUrl || decodeEscaped(ogVideo);

    // Thumbnail
    let thumbnail = $('meta[property="og:image"]').attr('content') ||
                    $('meta[property="og:image:secure_url"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') || null;

    if (!thumbnail) {
      const imgMatch = html.match(/https:[^"'\s\\]+fbcdn\.net[^"'\s\\]+\.(?:jpg|jpeg|png|webp)[^"'\s\\]*/i);
      if (imgMatch) {
        thumbnail = decodeEscaped(imgMatch[0]);
      }
    }

    // Author name extraction
    let authorName = 'facebook_user';
    const pipeParts = title.split('|').map(s => s.trim()).filter(Boolean);
    if (pipeParts.length > 1) {
      const lastPart = pipeParts[pipeParts.length - 1];
      if (!lastPart.toLowerCase().includes('facebook') && lastPart.length < 60) {
        authorName = lastPart;
      }
    } else {
      const authorMatch = title.match(/^([^·|–-]+)/);
      if (authorMatch && authorMatch[1].trim().length > 1 && !authorMatch[1].includes('views') && !authorMatch[1].includes('reactions')) {
        authorName = authorMatch[1].trim();
      }
    }

    if (videoUrl) {
      return {
        success: true,
        platform: 'facebook',
        engine: 'facebook_native',
        id,
        shortcode: id,
        url: targetUrl,
        type: 'video',
        author: {
          username: authorName,
          fullName: authorName,
          avatar: thumbnail
        },
        caption: caption || title,
        media: [
          {
            type: 'video',
            url: videoUrl,
            thumbnail: thumbnail || videoUrl,
            quality: hdUrl ? 'HD' : 'SD',
            filename: `facebook_${id}_${hdUrl ? 'HD' : 'SD'}.mp4`
          }
        ]
      };
    }

    // Photo post fallback
    if (thumbnail && (targetUrl.includes('/photo') || targetUrl.includes('/photos/') || targetUrl.includes('/posts/'))) {
      return {
        success: true,
        platform: 'facebook',
        engine: 'facebook_native_photo',
        id,
        shortcode: id,
        url: targetUrl,
        type: 'image',
        author: {
          username: authorName,
          fullName: authorName,
          avatar: thumbnail
        },
        caption: caption || title,
        media: [
          {
            type: 'image',
            url: thumbnail,
            thumbnail,
            filename: `facebook_${id}.jpg`
          }
        ]
      };
    }

    return null;
  }

  // 1. Try Desktop Web User-Agent
  try {
    const desktopResult = await parseHtml(
      targetUrlResolved,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    if (desktopResult) return desktopResult;
  } catch {}

  // 2. Try Mobile Web fallback (m.facebook.com)
  try {
    const mobileUrl = targetUrlResolved.replace(/(?:www\.|web\.)?facebook\.com/, 'm.facebook.com');
    const mobileResult = await parseHtml(
      mobileUrl,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    );
    if (mobileResult) return mobileResult;
  } catch {}

  return null;
}

/**
 * Strategy 3: SnapSave Protocol Resolver (supports Instagram and Facebook)
 */
async function fetchViaSnapSave(url, shortcode, platform = 'instagram') {
  try {
    const formData = new URLSearchParams();
    formData.append('url', url);

    const res = await fetch('https://snapsave.app/action.php?lang=en', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://snapsave.app',
        'Referer': 'https://snapsave.app/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: formData,
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return null;
    const rawText = await res.text();
    if (!rawText || rawText.includes('Unable to connect') || rawText.includes('error')) return null;

    // Decode snap script if encoded
    let decodedHtml = rawText;
    if (rawText.includes('eval(')) {
      try {
        const runner = rawText.replace(/eval\s*\(/, 'return (');
        const evaluated = new Function(runner)();
        if (typeof evaluated === 'string') {
          decodedHtml = evaluated;
        }
      } catch {}
    }

    // Extract innerHTML assignment if wrapped in JavaScript
    let parsedHtml = decodedHtml;
    const innerHtmlMatch = decodedHtml.match(/innerHTML\s*=\s*(".*?")\s*;/s) || decodedHtml.match(/innerHTML\s*=\s*('.*?')\s*;/s);
    if (innerHtmlMatch) {
      try {
        parsedHtml = JSON.parse(innerHtmlMatch[1]);
      } catch {
        parsedHtml = innerHtmlMatch[1].slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }

    const $ = cheerio.load(parsedHtml);
    const media = [];
    const filePrefix = platform === 'facebook' ? 'facebook' : 'instagrab';

    // Check download items
    $('div.download-items').each((idx, el) => {
      const thumb = $(el).find('div.download-items__thumb img').attr('src');
      const btn = $(el).find('div.download-items__btn a, a.button');
      const href = btn.attr('href');
      const isVideo = $(el).find('.icon-dlvideo').length > 0 || (href && href.includes('.mp4'));
      const mediaUrl = href || thumb;
      if (mediaUrl) {
        media.push({
          type: isVideo ? 'video' : 'image',
          url: mediaUrl,
          thumbnail: thumb || mediaUrl,
          filename: `${filePrefix}_${shortcode}_${idx + 1}.${isVideo ? 'mp4' : 'jpg'}`
        });
      }
    });

    // Check generic buttons or rapidcdn links
    if (media.length === 0) {
      $('a[href*="rapidcdn"], a[href*="download"], a.button').each((idx, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('snapsave.app')) {
          const isVideo = href.includes('.mp4') || $(el).text().toLowerCase().includes('video');
          media.push({
            type: isVideo ? 'video' : 'image',
            url: href,
            thumbnail: $('img').first().attr('src') || href,
            filename: `${filePrefix}_${shortcode}_${idx + 1}.${isVideo ? 'mp4' : 'jpg'}`
          });
        }
      });
    }

    // Check table format (common on Facebook downloads)
    if (media.length === 0 && $('table.table').length) {
      $('tbody tr').each((idx, el) => {
        const qualityText = $(el).find('td').eq(0).text().trim();
        const link = $(el).find('td').eq(2).find('a').attr('href');
        if (link && !link.startsWith('javascript:')) {
          media.push({
            type: 'video',
            url: link,
            quality: qualityText || undefined,
            thumbnail: $('article.media img').attr('src') || null,
            filename: `${filePrefix}_${shortcode}_${idx + 1}.mp4`
          });
        }
      });
    }

    if (media.length > 0) {
      const caption = $('span.video-des').text().trim() || '';
      return {
        success: true,
        platform,
        engine: 'snapsave',
        shortcode,
        id: shortcode,
        url,
        type: media.length > 1 ? 'carousel' : media[0].type,
        author: { username: `${platform}_post`, fullName: '', avatar: null },
        caption,
        media
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Strategy 4: Fast Public Invidious / Alternative Open Proxy Resolver
 */
async function fetchViaPublicResolver(url, shortcode, platform = 'instagram') {
  const mirrors = [
    `https://api.vkrdownloader.com/server?vkr=${encodeURIComponent(url)}`,
    `https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(url)}`
  ];
  const filePrefix = platform === 'facebook' ? 'facebook' : 'instagrab';

  for (const mirror of mirrors) {
    try {
      const res = await fetch(mirror, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;
      const data = await res.json();

      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const media = data.data.filter(item => item.url).map((item, idx) => {
          const isVid = item.type === 'video' || item.url.includes('.mp4');
          return {
            type: isVid ? 'video' : 'image',
            url: item.url,
            thumbnail: item.thumbnail || item.url,
            filename: `${filePrefix}_${shortcode}_${idx + 1}.${isVid ? 'mp4' : 'jpg'}`
          };
        });
        if (media.length > 0) {
          return {
            success: true,
            platform,
            engine: 'public_resolver',
            shortcode,
            id: shortcode,
            url,
            type: media.length > 1 ? 'carousel' : media[0].type,
            author: { username: `${platform}_post`, fullName: '', avatar: null },
            caption: data.title || '',
            media
          };
        }
      }

      if (data?.result && Array.isArray(data.result) && data.result.length > 0) {
        const media = data.result.filter(item => item.url && item.url.length > 5).map((item, idx) => {
          const isVid = item.url.includes('.mp4');
          return {
            type: isVid ? 'video' : 'image',
            url: item.url,
            thumbnail: item.thumbnail || item.url,
            filename: `${filePrefix}_${shortcode}_${idx + 1}.${isVid ? 'mp4' : 'jpg'}`
          };
        });
        if (media.length > 0) {
          return {
            success: true,
            platform,
            engine: 'public_resolver',
            shortcode,
            id: shortcode,
            url,
            type: media.length > 1 ? 'carousel' : media[0].type,
            author: { username: `${platform}_post`, fullName: '', avatar: null },
            caption: '',
            media
          };
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Strategy 5: Custom Cobalt Instance (if configured by user or environment)
 */
async function fetchViaCobalt(url, shortcode, customInstance, apiKey, platform = 'instagram') {
  const instance = (customInstance || process.env.COBALT_INSTANCE || '').trim().replace(/\/$/, '');
  if (!instance) return null;
  const filePrefix = platform === 'facebook' ? 'facebook' : 'instagrab';

  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Api-Key ${apiKey}`;
    }

    const res = await fetch(`${instance}/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data.status === 'redirect' || data.status === 'tunnel') {
      const isVid = data.url.includes('.mp4') || !data.url.includes('.jpg');
      return {
        success: true,
        platform,
        engine: 'cobalt',
        shortcode,
        id: shortcode,
        url,
        type: isVid ? 'video' : 'image',
        author: { username: `${platform}_post`, fullName: '', avatar: null },
        caption: data.filename || '',
        media: [
          {
            type: isVid ? 'video' : 'image',
            url: data.url,
            thumbnail: data.url,
            filename: `${filePrefix}_${shortcode}_1.${isVid ? 'mp4' : 'jpg'}`
          }
        ]
      };
    }

    if (data.status === 'picker' && Array.isArray(data.picker)) {
      const media = data.picker.map((item, idx) => {
        const isVid = item.type === 'video' || item.url.includes('.mp4');
        return {
          type: isVid ? 'video' : 'image',
          url: item.url,
          thumbnail: item.thumb || item.url,
          filename: `${filePrefix}_${shortcode}_${idx + 1}.${isVid ? 'mp4' : 'jpg'}`
        };
      });
      return {
        success: true,
        platform,
        engine: 'cobalt_picker',
        shortcode,
        id: shortcode,
        url,
        type: 'carousel',
        author: { username: `${platform}_post`, fullName: '', avatar: null },
        caption: '',
        media
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Orchestrator: Runs multiple extraction engines for Instagram
 */
export async function extractInstagramMedia(inputUrl, options = {}) {
  const parsed = parseInstagramUrl(inputUrl);
  if (!parsed) {
    throw new Error('Please provide a valid Instagram post, reel, or video link.');
  }

  const { shortcode, canonicalUrl } = parsed;
  const sessionId = options.sessionId || process.env.INSTAGRAM_SESSION_ID || null;
  const cobaltInstance = options.cobaltInstance || process.env.COBALT_INSTANCE || null;
  const cobaltApiKey = options.cobaltApiKey || process.env.COBALT_API_KEY || null;

  // 1. If session cookie provided, priority goes to official authenticated media API
  if (sessionId) {
    try {
      const sessionResult = await fetchViaInstagramSession(shortcode, sessionId);
      if (sessionResult && sessionResult.media?.length > 0) {
        return {
          platform: 'instagram',
          ...sessionResult
        };
      }
    } catch {}
  }

  // 2. Try fast parallel execution of public engines
  const engines = [
    fetchViaSnapSave(canonicalUrl, shortcode, 'instagram'),
    fetchViaInstagramEmbed(shortcode),
    fetchViaPublicResolver(canonicalUrl, shortcode, 'instagram')
  ];

  if (cobaltInstance) {
    engines.push(fetchViaCobalt(canonicalUrl, shortcode, cobaltInstance, cobaltApiKey, 'instagram'));
  }

  // Await the fastest successful resolver
  const results = await Promise.allSettled(engines);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.success && r.value.media?.length > 0) {
      return {
        platform: 'instagram',
        ...r.value
      };
    }
  }

  throw new Error('Unable to fetch media from this Instagram link right now. The post might be private, age-restricted, or Instagram temporarily rate-limited public access. If you have an Instagram account, you can add your session cookie in Settings for 100% reliable downloads.');
}

/**
 * Orchestrator: Runs multiple extraction engines for Facebook
 */
export async function extractFacebookMedia(inputUrl, options = {}) {
  // First, resolve shortlinks (fb.watch, fb.me, share/r/, etc.) into the canonical URL
  const resolvedUrl = await resolveFacebookShortlink(inputUrl);
  const parsed = parseFacebookUrl(resolvedUrl) || parseFacebookUrl(inputUrl);
  if (!parsed) {
    throw new Error('Please provide a valid Facebook video, reel, or post link.');
  }

  const { canonicalUrl, id } = parsed;
  const cobaltInstance = options.cobaltInstance || process.env.COBALT_INSTANCE || null;
  const cobaltApiKey = options.cobaltApiKey || process.env.COBALT_API_KEY || null;

  // 1. Priority: Fast direct native Facebook extraction
  try {
    const nativeResult = await fetchViaNativeFacebook(canonicalUrl, id);
    if (nativeResult && nativeResult.media?.length > 0) {
      return nativeResult;
    }
  } catch {}

  // 2. Fallback to public resolvers & Cobalt
  const engines = [
    fetchViaSnapSave(canonicalUrl, id, 'facebook'),
    fetchViaPublicResolver(canonicalUrl, id, 'facebook')
  ];

  if (cobaltInstance) {
    engines.push(fetchViaCobalt(canonicalUrl, id, cobaltInstance, cobaltApiKey, 'facebook'));
  }

  const results = await Promise.allSettled(engines);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.success && r.value.media?.length > 0) {
      return {
        platform: 'facebook',
        ...r.value
      };
    }
  }

  throw new Error('Unable to fetch media from this Facebook link. The post might be private, restricted, or temporarily unavailable.');
}

/**
 * Universal Orchestrator: Detects platform and extracts Instagram or Facebook media
 */
export async function extractMedia(inputUrl, options = {}) {
  const platform = detectPlatform(inputUrl);

  if (platform === 'facebook') {
    return extractFacebookMedia(inputUrl, options);
  }

  if (platform === 'instagram') {
    return extractInstagramMedia(inputUrl, options);
  }

  // If unrecognized format, attempt Instagram first then Facebook
  try {
    return await extractInstagramMedia(inputUrl, options);
  } catch {
    return await extractFacebookMedia(inputUrl, options);
  }
}
