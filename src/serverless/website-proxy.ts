/**
 * Website Proxy — Serverless Function
 *
 * Deploy this function to a serverless endpoint (Cloudflare Worker, Vercel Function,
 * Netlify Function, or similar) to proxy website fetches for the Website Intelligence
 * Engine. The browser's CORS restrictions prevent direct client-side fetches to most
 * external websites; this proxy bypasses that by running server-side.
 *
 * ── Deployment Instructions ──
 *
 * Cloudflare Workers (recommended — fastest):
 *   wrangler deploy website-proxy.js --name creativelead-website-proxy
 *   Then set VITE_WEBSITE_PROXY_URL=https://creativelead-website-proxy.yourname.workers.dev
 *
 * Vercel:
 *   Save as api/website-proxy.ts, deploy, set VITE_WEBSITE_PROXY_URL
 *
 * Netlify:
 *   Save as netlify/functions/website-proxy.js, deploy, set VITE_WEBSITE_PROXY_URL
 *
 * ── Environment Variable ──
 *   VITE_WEBSITE_PROXY_URL — the URL of the deployed proxy function.
 *   If not set, the engine will attempt direct CORS fetch and gracefully degrade.
 */

export async function handleProxy(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: corsHeaders });
  }

  let body: { url: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }

  if (!body.url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: corsHeaders });
  }

  try {
    const resp = await fetch(body.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const responseHeaders: Record<string, string> = {};
    resp.headers.forEach((val, key) => { responseHeaders[key] = val; });

    return new Response(JSON.stringify({
      statusCode: resp.status,
      body: await resp.text(),
      headers: responseHeaders,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      statusCode: 0,
      body: '',
      headers: {},
      error: err instanceof Error ? err.message : 'Fetch failed',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 502,
    });
  }
}