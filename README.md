# Daily News Agent

A free, fully automated daily news brief bot. Every day at **6:00 PM IST**:

1. Pulls the top global + India headlines from free public RSS feeds (BBC World, Times of India, BBC Business, BBC Tech, BBC Sport).
2. Renders your 6-slide Instagram carousel design (the one from your `daily_brief_carousel_instagram.html` file) as PNGs.
3. Posts the carousel to **Instagram** and up to 4 of the images + a summary to **X (Twitter)**.

It runs on **GitHub Actions**, which has a free tier for scheduled jobs — your PC does not need to be on.

> Note on images: story slides use the clean gradient card design (no photo), not the original news outlets' photos. Hotlinking other publishers' images into your own posts is a copyright/ToS risk, so this was left out by design. You can add images back in later if you have rights to use them.

## How it's built

```
src/
  fetchNews.js      -- pulls RSS headlines, no API key needed
  template.html     -- your carousel design, adapted for headless rendering
  renderCarousel.js -- uses Puppeteer (headless Chrome) to render template.html -> 6 PNGs
  caption.js         -- builds the Instagram caption + Twitter text
  postInstagram.js  -- posts the carousel via the Meta Graph API
  postTwitter.js    -- posts images + text via the X API v2
  index.js           -- runs everything locally in one go (fetch -> render -> post)
  postOnly.js        -- posts already-rendered images (used by the GitHub Action)
.github/workflows/daily-post.yml -- the free cron job
```

## 1. Try it locally first (no API keys needed yet)

```bash
npm install
npm run test-render
```

This fetches real news and renders the 6 PNGs into `public/<today's date>/`. Open that folder and check the images look right before wiring up any accounts.

## 2. Set up Instagram posting (free)

Instagram's API only lets **Business or Creator accounts** post automatically, and only through a Meta Developer app.

1. **Convert your Instagram account**: Instagram app → Settings → Account type and tools → Switch to Professional Account → choose Creator or Business.
2. **Link it to a Facebook Page**: Business accounts need a connected Facebook Page (you can create a new, empty Page just for this — it's free). Do this from Instagram's Settings → Linked accounts, or via Meta Business Suite.
3. **Create a Meta Developer app**: go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create App → type "Business" → give it any name.
4. In the app, add the **Instagram Graph API** product.
5. **Get a Page access token** with the `instagram_basic` and `instagram_content_publish` permissions:
   - Easiest path: use the [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select your app, select your Page, and request those permissions to generate a token.
   - Exchange it for a **long-lived token** (lasts ~60 days) using the "Access Token Debugger" or the `oauth/access_token?grant_type=fb_exchange_token` endpoint. You'll need to regenerate this every couple of months — Meta's docs walk through it, or ask me and I'll write you a refresh script.
6. **Find your Instagram Business Account ID**: `GET https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_TOKEN` to get your Page ID, then `GET https://graph.facebook.com/v21.0/{page-id}?fields=instagram_business_account&access_token=YOUR_TOKEN`.
7. You'll end up with two values: `IG_BUSINESS_ID` and `IG_ACCESS_TOKEN`. Keep these secret — you'll paste them into GitHub Secrets in step 4 below.

## 3. Set up X (Twitter) posting (free)

1. Go to [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard) and sign up for a free developer account (attach it to your normal X account).
2. Create a Project + App.
3. In the app's **Settings → User authentication settings**, enable OAuth 1.0a with **Read and Write** permissions (this is required to post).
4. In **Keys and tokens**, generate:
   - API Key & Secret
   - Access Token & Secret (make sure these are generated *after* you enabled Read+Write, otherwise regenerate them)
5. You'll end up with 4 values: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`.

## 4. Put this on GitHub and schedule it

1. Create a **public** GitHub repo (needs to be public so Instagram's servers can fetch the generated image URLs for free via `raw.githubusercontent.com`).
2. Push this project to it.
3. In the repo, go to **Settings → Secrets and variables → Actions**:
   - Under **Secrets**, add: `IG_BUSINESS_ID`, `IG_ACCESS_TOKEN`, `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`.
   - Under **Variables**, add: `HANDLE` (e.g. `@yourhandle`) and optionally `TIMEZONE` (default `Asia/Kolkata`).
4. Go to the **Actions** tab and enable workflows if prompted.
5. To test before waiting for 6pm: open the "Daily News Brief" workflow → **Run workflow** (this is the `workflow_dispatch` trigger) to fire it manually.
6. From then on it runs automatically every day at 6:00 PM IST (cron `30 12 * * *` UTC).

## Notes / things worth knowing

- **Cost**: RSS feeds, GitHub Actions (public repos get generous free minutes), the Graph API, and the X free tier are all free for this volume of use (1 post/day). The only thing that could ever cost money is if you later swap the plain-headline captions for LLM-written ones.
- **Twitter image limit**: X only allows 4 images per tweet, so it posts the cover + first 3 story slides; the caption lists all 5 headlines as text.
- **Instagram token expiry**: long-lived Page tokens need refreshing periodically (Meta's guidance is ~60 days). If a run starts failing with an auth error, that's almost always why — regenerate the token and update the GitHub Secret.
- **Changing the news sources**: edit the `SLOTS` array in `src/fetchNews.js` — swap in any RSS feed URL for any category.
- **Changing the post time**: edit the `cron` line in `.github/workflows/daily-post.yml` (it's always in UTC).
