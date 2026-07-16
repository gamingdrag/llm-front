import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function readBody(req: any): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => body += chunk);
    req.on('end', () => resolve(body || null));
  });
}

const FORWARD_HEADERS = [
  'authorization',
  'x-api-key',
  'anthropic-version',
  'http-referer',
  'x-title',
  'content-type',
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cors-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          try {
            const targetUrl = req.headers['x-proxy-url'] as string;
            if (!targetUrl) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Missing X-Proxy-Url header' }));
              return;
            }

            const headers: Record<string, string> = {};
            for (const h of FORWARD_HEADERS) {
              const val = req.headers[h] as string | undefined;
              if (val) headers[h] = val;
            }

            const body = await readBody(req);

            const upstream = await fetch(targetUrl, {
              method: req.method as string,
              headers,
              body: body || undefined,
            });

            const out: Record<string, string> = {
              'access-control-allow-origin': '*',
              'access-control-allow-headers': '*',
              'access-control-expose-headers': '*',
            };
            upstream.headers.forEach((value, key) => {
              if (!['access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods'].includes(key.toLowerCase())) {
                out[key] = value;
              }
            });

            res.writeHead(upstream.status, out);

            if (upstream.body) {
              const reader = upstream.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); break; }
                res.write(value);
              }
            } else {
              res.end();
            }
          } catch (err: any) {
            if (!res.headersSent) {
              res.writeHead(502);
              res.end(JSON.stringify({ error: err.message }));
            }
          }
        });
      },
    },
  ],
})