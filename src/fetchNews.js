import Parser from 'rss-parser';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const parser = new Parser({ timeout: 15000 });

// One feed per carousel slot. Swap URLs any time - no API key required, these are public RSS feeds.
const SLOTS = [
  { tag: 'World',   icon: '🌍', feed: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { tag: 'India',   icon: '🪔', feed: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { tag: 'Markets', icon: '📈', feed: 'http://feeds.bbci.co.uk/news/business/rss.xml' },
  { tag: 'Tech',    icon: '💡', feed: 'http://feeds.bbci.co.uk/news/technology/rss.xml' },
  { tag: 'Sports',  icon: '🏆', feed: 'http://feeds.bbci.co.uk/sport/rss.xml' },
];

const STOPWORDS = new Set(['about','after','their','there','which','would','could','should','where','while','among','under','being','these','those','other','still','again','first','world']);

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function highlightHeadline(title) {
  const words = title.split(' ');
  let bestIdx = -1, bestLen = 0;
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-zA-Z]/g, '');
    if (i > 0 && clean.length >= 5 && !STOPWORDS.has(clean.toLowerCase()) && clean.length > bestLen) {
      bestLen = clean.length;
      bestIdx = i;
    }
  });
  if (bestIdx === -1) return title;
  words[bestIdx] = `*${words[bestIdx]}*`;
  return words.join(' ');
}

function toBullets(description, title) {
  const text = stripHtml(description);
  if (!text || text.length < 15 || text.toLowerCase() === title.toLowerCase().trim()) {
    return ['Full details in the source report — tap through to read more.'];
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 12)
    .slice(0, 3)
    .map(s => (s.length > 100 ? s.slice(0, 97).trimEnd() + '…' : s));
  return sentences.length ? sentences : [text.slice(0, 100)];
}

async function fetchSlot(slot) {
  try {
    const feed = await parser.parseURL(slot.feed);
    const item = feed.items?.[0];
    if (!item) throw new Error('no items');
    return {
      icon: slot.icon,
      tag: slot.tag,
      title: highlightHeadline(stripHtml(item.title || 'Untitled story')),
      desc: toBullets(item.contentSnippet || item.content || item.summary || '', item.title || '').join('\n'),
      link: item.link || '',
    };
  } catch (err) {
    console.error(`[fetchNews] Failed to fetch ${slot.tag} (${slot.feed}):`, err.message);
    return {
      icon: slot.icon,
      tag: slot.tag,
      title: `${slot.tag} news unavailable today`,
      desc: 'Feed could not be reached — check the source URL in src/fetchNews.js',
      link: '',
    };
  }
}

export async function fetchTodaysStories() {
  const stories = await Promise.all(SLOTS.map(fetchSlot));
  return stories;
}

// Allow running standalone: `node src/fetchNews.js`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stories = await fetchTodaysStories();
  mkdirSync(`${__dirname}/../data`, { recursive: true });
  writeFileSync(`${__dirname}/../data/latest.json`, JSON.stringify(stories, null, 2));
  console.log('Fetched stories:');
  stories.forEach(s => console.log(`  [${s.tag}] ${s.title}`));
  console.log('\nSaved to data/latest.json');
}
