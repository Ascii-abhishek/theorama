import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build, headers, root, siteSettings } from "./build.mjs";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
};
const fixtures = /^\/(?:tests\/(?:notes|pagination)(?:\.test\.js|\.html)|src\/(?:js\/[\w-]+\.js|styles\/[\w-]+\.css)|assets\/fonts\/[\w-]+\.woff2)$/;

export function createPreviewServer({ out = resolve(root, "dist"), base = "/", tests = false } = {}) {
  return createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const respond = (code, type, bytes, cache = "no-store", fixture = false) => {
      const security = fixture ? {} : headers;
      const compress = bytes.length > 1024 && /^(?:text\/|application\/(?:json|xml))/.test(type) &&
        /(?:^|,)\s*gzip\s*(?:,|$)/.test(request.headers["accept-encoding"] ?? "");
      const body = compress ? gzipSync(bytes) : bytes;
      response.writeHead(code, {
        ...security, "Content-Type": type, "Cache-Control": cache,
        "Content-Length": body.length, Vary: "Accept-Encoding",
        ...(compress ? { "Content-Encoding": "gzip" } : {}),
      });
      response.end(request.method === "GET" ? body : undefined);
    };
    try {
      const url = new URL(request.url, "http://localhost");
      const path = decodeURIComponent(url.pathname);
      if (path.split("/").some((segment) => segment.startsWith(".") || /[\\\x00-\x1f]/.test(segment))) {
        respond(400, types[".txt"], Buffer.from("Invalid path"));
        return;
      }
      const fixture = tests && fixtures.test(path);
      const relative = path.startsWith(base) ? path.slice(base.length) : null;
      let file = fixture ? join(root, path) : relative === null ? null : join(out, relative);
      if (file && !fixture && path === base) file = join(out, "index.html");
      let info = file && await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        if (!path.endsWith("/")) {
          response.writeHead(308, { Location: path + "/" + url.search }).end();
          return;
        }
        file = join(file, "index.html");
        info = await stat(file).catch(() => null);
      }
      if (info?.isFile() && types[extname(file)]) {
        const cache = relative?.startsWith("_static/") ? "public, max-age=31536000, immutable" : "no-store";
        respond(200, types[extname(file)], await readFile(file), cache, fixture);
      } else {
        respond(404, types[".html"], await readFile(join(out, "404.html")));
      }
    } catch {
      if (!response.headersSent) respond(500, types[".txt"], Buffer.from("Unable to load this page."));
      else response.end();
    }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await build();
    const { base } = siteSettings(process.env);
    const port = Number(process.env.PORT ?? 5173);
    const server = createPreviewServer({ base, tests: true });
    server.listen(port, "127.0.0.1");
    await once(server, "listening");
    console.log(`Local: http://127.0.0.1:${server.address().port}${base}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
