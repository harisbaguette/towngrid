import { existsSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { Plugin } from "vite";

// Vite serves public files verbatim but does not resolve directory index pages.
// Keep the standalone character previews available in the Node dev runtime.
export function publicDirectoryIndex(): Plugin {
  return {
    name: "towngrid:public-directory-index",
    configureServer(server) {
      const publicDir = server.config.publicDir;
      if (!publicDir) return;
      const prefix = resolve(publicDir) + sep;
      server.middlewares.use((request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") return next();
        try {
          const url = new URL(request.url ?? "/", "http://localhost");
          const pathname = decodeURIComponent(url.pathname);
          if (pathname === "/" || extname(pathname)) return next();
          const index = resolve(publicDir, "." + pathname, "index.html");
          if (!index.startsWith(prefix) || !existsSync(index)) return next();
          if (!url.pathname.endsWith("/")) {
            response.writeHead(302, { Location: url.pathname + "/" + url.search });
            response.end();
            return;
          }
          request.url = url.pathname + "index.html" + url.search;
        } catch {
          // Let Vite handle malformed URLs.
        }
        next();
      });
    },
  };
}
