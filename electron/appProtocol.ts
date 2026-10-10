import * as path from 'path';
import * as fs from 'fs';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

function isInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Maps an app:// URL to a file inside distPath. Returns null when the decoded
// path escapes distPath (e.g. "..%2f..%2fetc/passwd") or the URL is malformed.
// Unknown in-bundle paths fall back to index.html so client-side routes work.
export function resolveAppFile(distPath: string, requestUrl: string): string | null {
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(new URL(requestUrl).pathname);
  } catch {
    return null;
  }

  const root = path.resolve(distPath);
  const candidate = path.resolve(root, `.${path.sep}${relativePath}`);
  if (!isInside(root, candidate)) return null;

  const isFile = fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  return isFile ? candidate : path.join(root, 'index.html');
}

export function createAppProtocolHandler(getDistPath: () => string): (request: Request) => Response {
  return (request) => {
    const filePath = resolveAppFile(getDistPath(), request.url);
    if (!filePath) return new Response('Not found', { status: 404 });

    try {
      // fs.readFileSync is patched by Electron to read inside the ASAR archive;
      // net.fetch(file://) does not understand that format.
      const data = fs.readFileSync(filePath);
      const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(data, {
        headers: {
          'Content-Type': mimeType,
          // Font requests are always CORS-mode, even same-origin.
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  };
}
