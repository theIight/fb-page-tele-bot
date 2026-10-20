import crypto from 'crypto';

export function cleanFacebookUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    // Remove FB tracking params
    const cleanParams = new URLSearchParams();
    for (const [key, val] of u.searchParams.entries()) {
      if (!['__cft__', '__tn__', 'ref', 'ref_src', 'locale'].some(p => key.startsWith(p))) {
        cleanParams.set(key, val);
      }
    }
    u.search = cleanParams.toString();
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export function extractPostId(url, text, timestamp) {
  if (url) {
    // 1. Matches /posts/<id>
    const postMatch = url.match(/\/posts\/([a-zA-Z0-9_\-]+)/);
    if (postMatch) return `post_${postMatch[1]}`;

    // 2. Matches /reel/<id>
    const reelMatch = url.match(/\/reel\/([0-9]+)/);
    if (reelMatch) return `reel_${reelMatch[1]}`;

    // 3. Matches /videos/<id>
    const videoMatch = url.match(/\/videos\/([0-9]+)/);
    if (videoMatch) return `video_${videoMatch[1]}`;

    // 4. Matches story_fbid=<id>
    const storyMatch = url.match(/[?&]story_fbid=([0-9]+)/);
    if (storyMatch) return `story_${storyMatch[1]}`;

    // 5. Matches fbid=<id>
    const fbidMatch = url.match(/[?&]fbid=([0-9]+)/);
    if (fbidMatch) return `photo_${fbidMatch[1]}`;

    // 6. Matches set=a.<id> (album)
    const albumMatch = url.match(/set=a\.([0-9]+)/);
    if (albumMatch) return `album_${albumMatch[1]}`;
  }

  // Fallback: Hash of (cleaned url + snippet of text)
  const source = `${url || ''}|${(text || '').slice(0, 200)}|${timestamp || ''}`;
  return 'hash_' + crypto.createHash('md5').update(source).digest('hex');
}
