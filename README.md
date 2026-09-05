# Daily News Agent

A free daily news brief bot for Instagram (`@__thedailybrief__`) and X.

Every day:
1. **GitHub Actions** (free, automatic, runs even if your PC is off) fetches today's top **World, Science, Markets (India + US), Tech, and Sports** headlines from free public RSS feeds, renders them into your 6-slide carousel design, and commits the PNGs to this repo so they have a public URL.
2. **You** run one command from your own PC (`post-today.bat`, or `npm run post-only`) to actually publish to Instagram/X.

> Why isn't step 2 automatic too? Meta blocks API requests coming from GitHub Actions' cloud IP ranges ("API access blocked") as an anti-bot measure, even with a fully valid token. The identical code works fine from a home/office IP, so posting has to happen from your machine. This is documented in `.github/workflows/daily-post.yml`.

> Note on images: story slides use a clean gradient card design (no photo), not the original outlets' photos — hotlinking other publishers' images into your own posts is a copyright/ToS risk, so it was left out by design.

## How it's built

```
src/
  fetchNews.js       -- pulls RSS headlines, no API key needed
  template.html      -- your carousel design, adapted for headless rendering
  renderCarousel.js  -- Puppeteer renders template.html -> 6 PNGs + data.json
  caption.js         -- builds the Instagram caption + Twitter text
  postInstagram.js   -- posts the carousel via the Instagram API (graph.instagram.com)
  postTwitter.js     -- posts images + text via the X API v2
  index.js           -- runs everything locally in one go (fetch -> render -> post)
  postOnly.js         -- posts already-rendered images (what you run daily)
.github/workflows/daily-post.yml -- the free cron job (fetch + render + commit only)
post-today.bat        -- double-click this each day to pull + post
```

## Daily routine (once everything below is set up)

Double-click **`post-today.bat`** any time after 6pm IST (or whenever the GitHub Action last ran) — it pulls the latest generated images and posts them. Or manually:

```bash
git pull
npm run post-only
```

## 1. Try it locally first (no API keys needed yet)

```bash
npm install
npm run test-render
```

This fetches real news and renders the 6 PNGs into `public/<today's date>/`. Open that folder and check the images look right before wiring up any accounts.

## 2. Instagram setup (what was actually done for this bot)

Instagram's API only lets **Business or Creator accounts** post automatically.

1. Convert the account: Instagram app → profile → ☰ → **Business tools and controls** → **Switch account type** if not already Professional.
2. Connect a Facebook Page: same menu → **Connect to Facebook** (creates one for free if you don't have one).
3. Create a Meta Developer app at [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create App → Other → Business.
4. Add the use case **"Manage messaging & content on Instagram"**.
5. Under that use case → **API setup with Instagram login**:
   - Click **"Add all required permissions"**.
   - Go to **App roles → Roles → Instagram Testers** → add your IG username, then **accept the invite inside the Instagram app** (Settings → Apps and websites → Tester invites).
   - Back on the API setup page, click **Add account**, log in, and allow all requested permissions (must include "Access and publish content").
   - Click **Generate token** — this is your `IG_ACCESS_TOKEN`.
6. Your Instagram-scoped user ID (`IG_BUSINESS_ID`) is **not** the numeric ID shown on that dashboard page — verify it by calling `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=YOUR_TOKEN` and using the `id` it returns.
7. These go in `.env` locally and as GitHub **Secrets** (`IG_BUSINESS_ID`, `IG_ACCESS_TOKEN`) for the render workflow's image-hosting to work end to end.

## 3. Set up X (Twitter) posting (free) — not done yet

1. Go to [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard), sign up for a free developer account.
2. Create a Project + App.
3. In **Settings → User authentication settings**, enable OAuth 1.0a with **Read and Write** permissions.
4. In **Keys and tokens**, generate API Key & Secret, and Access Token & Secret (generate these *after* enabling Read+Write).
5. Add all 4 to `.env` locally and as GitHub Secrets: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`.

## 4. GitHub setup (already done for this bot)

Repo: `github.com/tejass0027/daily-news-agent` (public — needs to be, so `raw.githubusercontent.com` URLs work for free).

- Repo **Variables**: `HANDLE`, `TIMEZONE`
- Repo **Secrets**: `IG_BUSINESS_ID`, `IG_ACCESS_TOKEN` (Twitter ones once set up)
- The scheduled workflow only fetches + renders + commits — it does not post (see note above).

## Notes / things worth knowing

- **Cost**: RSS feeds, GitHub Actions (public repos get generous free minutes), and the Instagram/X APIs are all free for this volume of use (1 post/day).
- **Twitter image limit**: X only allows 4 images per tweet, so it posts the cover + first 3 story slides; the caption lists all 5 headlines as text.
- **Instagram token expiry**: tokens need refreshing periodically. If posting starts failing with an auth error, regenerate the token via the same "API setup with Instagram login" page and update both `.env` and the GitHub Secret.
- **Changing the news sources**: edit `SLOTS` / `MARKET_FEEDS` in `src/fetchNews.js` — swap in any RSS feed URL for any category.
- **Changing the post time**: edit the `cron` line in `.github/workflows/daily-post.yml` (it's always in UTC).
