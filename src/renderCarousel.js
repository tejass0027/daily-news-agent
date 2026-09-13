import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function formatDate(tz) {
  const now = new Date();
  const main = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: '2-digit' })
    .format(now).toUpperCase().replace(',', '');
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now).toUpperCase();
  const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(now);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  return { dateMain: main, dateSub: `${day} · ${year}`, iso };
}

export async function renderCarousel(stories) {
  const tz = process.env.TIMEZONE || 'Asia/Kolkata';
  const handle = process.env.HANDLE || '@__thedailybrief__';
  const { dateMain, dateSub, iso } = formatDate(tz);

  const data = {
    handle,
    dateMain,
    dateSub,
    coverHeadline: "What you *missed* today",
    stories,
  };

  const outDir = `${__dirname}/../public/${iso}`;
  mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`file://${__dirname}/template.html`, { waitUntil: 'networkidle0' });
    await page.evaluate((d) => window.__renderBrief(d), data);

    const files = [];
    for (let i = 0; i <= stories.length; i++) {
      const dataUrl = await page.evaluate((idx) => window.__captureSlide(idx), i);
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const label = i === 0 ? 'cover' : `story${i}`;
      const filePath = `${outDir}/${label}.png`;
      writeFileSync(filePath, Buffer.from(base64, 'base64'));
      files.push(filePath);
      console.log(`[renderCarousel] wrote ${filePath}`);
    }
    // Committed alongside the images so any machine that pulls the repo has the exact
    // captions/handle/date that match today's rendered PNGs (data/latest.json is gitignored).
    writeFileSync(`${outDir}/data.json`, JSON.stringify(data, null, 2));
    return { files, iso, data };
  } finally {
    await browser.close();
  }
}

// Allow running standalone: `node src/renderCarousel.js` (reads data/latest.json from fetchNews.js)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stories = JSON.parse(readFileSync(`${__dirname}/../data/latest.json`, 'utf-8'));
  const { files } = await renderCarousel(stories);
  console.log(`\nRendered ${files.length} slides.`);
}
