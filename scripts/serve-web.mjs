/**
 * Static file server for the exported web build (`dist/`).
 *
 * The Playwright suite used to boot the Metro dev server (`expo start --web`),
 * which needs a cold bundle on every run and is far too slow and flaky for CI.
 * Instead CI runs `npx expo export --platform web` once and serves the result
 * with this server.
 *
 * app.json sets web.output = "single", so the export is a single-page app:
 * every unknown path must fall back to index.html or deep links such as
 * /settings and /templates return 404.
 *
 * No dependencies on purpose — it must run from a bare `npm ci`.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.env.WEB_DIST_DIR ?? 'dist');
const PORT = Number(process.env.WEB_PORT ?? 8081);
const HOST = process.env.WEB_HOST ?? '127.0.0.1';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Resolve a URL path to a readable file inside ROOT, or null. */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  // Reject traversal outside the served directory.
  if (candidate !== ROOT && !candidate.startsWith(ROOT + '/')) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
    if (info.isDirectory()) {
      const index = join(candidate, 'index.html');
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    /* falls through to the SPA fallback */
  }
  return null;
}

const indexHtml = join(ROOT, 'index.html');
try {
  await stat(indexHtml);
} catch {
  console.error(
    `serve-web: ${indexHtml} not found. Build it first:\n` +
      `  npx expo export --platform web`,
  );
  process.exit(1);
}

const server = createServer((req, res) => {
  resolveFile(req.url ?? '/')
    .then((file) => {
      // SPA fallback: unknown routes are client-side routes.
      const target = file ?? indexHtml;
      res.writeHead(200, {
        'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(target).pipe(res);
    })
    .catch(() => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    });
});

server.listen(PORT, HOST, () => {
  console.log(`serve-web: serving ${ROOT} at http://${HOST}:${PORT}`);
});
