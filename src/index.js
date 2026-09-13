import 'dotenv/config';
import { basename } from 'path';
import { fetchTodaysStories } from './fetchNews.js';
import { renderCarousel } from './renderCarousel.js';
import { buildInstagramCaption, buildTwitterText } from './caption.js';
import { postInstagramCarousel } from './postInstagram.js';
import { postTweet } from './postTwitter.js';

async function main() {
  console.log('=== Daily News Agent ===');

  console.log('\n[1/4] Fetching news (global + India)...');
  const stories = await fetchTodaysStories();
  stories.forEach(s => console.log(`  [${s.tag}] ${s.title.replace(/\*/g, '')}`));

  console.log('\n[2/4] Rendering carousel images...');
  const { files, iso, data } = await renderCarousel(stories);

  console.log('\n[3/4] Posting to Instagram...');
  const igCaption = buildInstagramCaption(stories, data.dateSub, data.handle);
  const publicBase = process.env.PUBLIC_IMAGE_BASE_URL;
  if (publicBase) {
    const imageUrls = files.map(f => `${publicBase.replace(/\/$/, '')}/${iso}/${basename(f)}`);
    try {
      await postInstagramCarousel(imageUrls, igCaption);
    } catch (err) {
      console.error('[index] Instagram post failed:', err.message);
    }
  } else {
    console.log('[index] PUBLIC_IMAGE_BASE_URL not set — skipping Instagram (images have no public URL yet).');
  }

  console.log('\n[4/4] Posting to X (Twitter)...');
  const twitterText = buildTwitterText(stories, data.dateSub);
  try {
    await postTweet(files, twitterText);
  } catch (err) {
    console.error('[index] Twitter post failed:', err.message);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('[index] Fatal error:', err);
  process.exit(1);
});
