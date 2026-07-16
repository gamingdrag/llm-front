// functions/api/proxy.ts

const FORWARD_HEADERS = [
  'authorization',
  'x-api-key',
  'anthropic-version',
  'http-referer',
  'x-title',
  'content-type',
];

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-proxy-url, x-api-key, anthropic-version, HTTP-Referer, X-Title',
    },
  });
};

export const onRequest = async (context: { request: Request }) => {
  try {
    const targetUrl = context.request.headers.get('x-proxy-url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing X-Proxy-Url header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Parse the URL safely
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid target URL' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Security: Block SSRF (Server-Side Request Forgery)
    // Prevent attackers from using your proxy to hit internal networks
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254', 'metadata.google.internal'];
    if (blockedHosts.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return new Response(JSON.stringify({ error: 'Access to internal networks is blocked' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Security: Prevent Open Proxy Abuse
    // Only allow requests that originate from your actual frontend URL.
    // This stops people from using your Worker as a free public proxy.
    // TODO: Replace with your actual Cloudflare domain when you get it!
    const allowedOrigins = [
      'https://llm-front.pages.dev', // Example: your Cloudflare domain
      'http://localhost:5173'         // For local testing
    ];
    const requestOrigin = context.request.headers.get('Origin');
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      return new Response(JSON.stringify({ error: 'Unauthorized origin' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Forward the headers
    const headers = new Headers();
    for (const h of FORWARD_HEADERS) {
      const val = context.request.headers.get(h);
      if (val) headers.set(h, val);
    }

    const method = context.request.method;
    const body = method !== 'GET' && method !== 'HEAD' ? await context.request.text() : undefined;

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body || undefined,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};