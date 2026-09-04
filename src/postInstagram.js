const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

async function graphPost(path, params) {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph API error on ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function graphGet(path, params) {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph API error on ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function waitUntilFinished(containerId, accessToken, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status_code } = await graphGet(containerId, { fields: 'status_code', access_token: accessToken });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error(`Container ${containerId} failed to process`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Container ${containerId} timed out waiting to finish processing`);
}

/**
 * Posts a carousel of public image URLs to Instagram via the Graph API.
 * Requires: IG_BUSINESS_ID, IG_ACCESS_TOKEN, and each URL must be publicly fetchable by Meta's servers.
 */
export async function postInstagramCarousel(imageUrls, caption) {
  const igId = process.env.IG_BUSINESS_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  if (!igId || !accessToken) {
    console.log('[postInstagram] IG_BUSINESS_ID or IG_ACCESS_TOKEN not set — skipping Instagram post.');
    return { skipped: true };
  }

  console.log(`[postInstagram] Creating ${imageUrls.length} media containers...`);
  const childIds = [];
  for (const imageUrl of imageUrls) {
    const { id } = await graphPost(`${igId}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: accessToken,
    });
    await waitUntilFinished(id, accessToken);
    childIds.push(id);
  }

  console.log('[postInstagram] Creating carousel container...');
  const { id: carouselId } = await graphPost(`${igId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: accessToken,
  });
  await waitUntilFinished(carouselId, accessToken);

  console.log('[postInstagram] Publishing...');
  const result = await graphPost(`${igId}/media_publish`, {
    creation_id: carouselId,
    access_token: accessToken,
  });
  console.log('[postInstagram] Published:', result.id);
  return result;
}
