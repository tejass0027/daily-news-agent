import Parser from 'rss-parser';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
});

// One feed per carousel slot. Swap URLs any time - no API key required, these are public RSS feeds.
const SLOTS = [
  { tag: 'World',   icon: '🌍', feed: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { tag: 'Science', icon: '🔬', feed: 'https://www.sciencedaily.com/rss/top/science.xml' },
  { tag: 'Markets', icon: '📈', markets: true },
  { tag: 'Tech',    icon: '💡', feed: 'http://feeds.bbci.co.uk/news/technology/rss.xml' },
  { tag: 'Sports',  icon: '🏆', feed: 'http://feeds.bbci.co.uk/sport/rss.xml' },
];

// Markets slide pulls one stock-market headline from India and one from the US, instead of
// a single general business story.
const MARKET_FEEDS = {
  india: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  us: 'https://www.marketwatch.com/rss/marketpulse',
};

const STOPWORDS = new Set(['about','after','their','there','which','would','could','should','where','while','among','under','being','these','those','other','still','again','first','world']);

const HTML_ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&#39': "'", '&lsquo;': '‘', '&rsquo;': '’',
  '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–',
};

function stripHtml(s = '') {
  let text = s.replace(/<[^>]*>/g, ' ');
  text = text.replace(/&#39;s/g, "'s"); // common feed bug: apostrophe entity missing its semicolon
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.split(entity).join(char);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/#(\d{2,4});/g, (_, code) => String.fromCharCode(Number(code))); // some feeds drop the leading "&"
  return text.replace(/\s+/g, ' ').trim();
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

function truncateWords(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, '').trimEnd() + '…' : text;
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
    .map(s => truncateWords(s, 100));
  return sentences.length ? sentences : [text.slice(0, 100)];
}

async function fetchMarketsSlot(slot) {
  const [indiaRes, usRes] = await Promise.allSettled([
    parser.parseURL(MARKET_FEEDS.india),
    parser.parseURL(MARKET_FEEDS.us),
  ]);
  const indiaItem = indiaRes.status === 'fulfilled' ? indiaRes.value.items?.[0] : null;
  const usItem = usRes.status === 'fulfilled' ? usRes.value.items?.[0] : null;

  if (!indiaItem) console.error(`[fetchNews] Failed to fetch India markets feed:`, indiaRes.reason?.message);
  if (!usItem) console.error(`[fetchNews] Failed to fetch US markets feed:`, usRes.reason?.message);

  const indiaLine = indiaItem ? truncateWords(stripHtml(indiaItem.title), 90) : 'India market update unavailable today.';
  const usLine = usItem ? truncateWords(stripHtml(usItem.title), 90) : 'US market update unavailable today.';

  return {
    icon: slot.icon,
    tag: slot.tag,
    title: 'India *and* US markets today',
    desc: [`India: ${indiaLine}`, `US: ${usLine}`].join('\n'),
    link: '',
  };
}

async function fetchSlot(slot) {
  if (slot.markets) return fetchMarketsSlot(slot);
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
