import { TwitterApi } from 'twitter-api-v2';

/**
 * Posts up to 4 local image files + text to X (Twitter) via the free-tier API v2.
 */
export async function postTweet(localFiles, text) {
  const { TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } = process.env;
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log('[postTwitter] Twitter API credentials not set — skipping Twitter post.');
    return { skipped: true };
  }

  const client = new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET,
  });

  const filesToPost = localFiles.slice(0, 4); // X allows max 4 images per tweet
  console.log(`[postTwitter] Uploading ${filesToPost.length} images...`);
  const mediaIds = await Promise.all(filesToPost.map(f => client.v1.uploadMedia(f)));

  console.log('[postTwitter] Posting tweet...');
  const result = await client.v2.tweet({ text, media: { media_ids: mediaIds } });
  console.log('[postTwitter] Posted:', result.data.id);
  return result;
}
