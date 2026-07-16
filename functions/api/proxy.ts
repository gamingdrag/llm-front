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