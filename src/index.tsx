import { serve } from "bun";
import path from "path";
import index from "./index.html";

const publicDir = path.join(import.meta.dir, "..", "public");

/**
 * Serve a file from `public/` during development.
 *
 * The Bun HTML bundler only knows about files reachable from an HTML
 * entrypoint, so root-scoped static files (the push service worker `/sw.js`
 * and its icon) are served explicitly here. In production these same files are
 * copied into `dist/` by `build.ts` and served by the static host.
 */
async function servePublicFile(fileName: string, contentType: string): Promise<Response> {
  const file = Bun.file(path.join(publicDir, fileName));
  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      // The service worker must always be revalidated so updates ship fast.
      "Cache-Control": "no-cache",
    },
  });
}

const server = serve({
  routes: {
    // Push service worker — must be served from the root scope (`/sw.js`).
    "/sw.js": () => servePublicFile("sw.js", "text/javascript; charset=utf-8"),

    // Notification icon referenced by the service worker.
    "/logo.svg": () => servePublicFile("logo.svg", "image/svg+xml"),

    // Static files under public/data/ (GeoJSON, etc.)
    "/data/*": async (req) => {
      const fileName = path.join("data", new URL(req.url).pathname.replace(/^\/data\//, ""));
      const file = Bun.file(path.join(publicDir, fileName));
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file, { headers: { "Content-Type": "application/geo+json" } });
    },

    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);
