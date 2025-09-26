import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

// Vite and its logger are only needed in development. We'll import them dynamically
// inside setupVite to prevent requiring 'vite' at runtime in production bundles.
let viteLogger: any = null;

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  if (process.env.NODE_ENV === 'production') return;

  const [{ createServer: createViteServer, createLogger }, viteConfig] = await Promise.all([
    import('vite'),
    import('../vite.config')
  ]);

  viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig.default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with smarter caching and precompressed support
  // Set long cache TTL for fingerprinted assets but prevent caching for index.html
  app.use((req, res, next) => {
    const url = req.path;
    if (url === "/" || url.endsWith("index.html")) {
      // Don't cache HTML entry points
      res.setHeader("Cache-Control", "no-store, must-revalidate");
    } else {
      // Cache other static assets for 1 year (immutable)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    next();
  });

  // Middleware to serve precompressed assets when available
  app.use((req, res, next) => {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const tryServeCompressed = (filePath: string) => {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      return null;
    };

    // Only for GET requests
    if (req.method !== "GET") return next();

    const originalUrl = req.path;
    // Only handle requests for static asset files (has an extension)
    if (!path.extname(originalUrl)) return next();

    const uncompressedPath = path.join(distPath, originalUrl);

    // Helper to serve a file with proper headers and conditional GET
    const serveFileWithHeaders = (fileOnDisk: string, encoding?: string) => {
      try {
        const stat = fs.statSync(fileOnDisk);

        // Conditional GET support
        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince) {
          const since = new Date(ifModifiedSince as string);
          if (!isNaN(since.getTime()) && stat.mtime <= since) {
            res.status(304).end();
            return true;
          }
        }

        if (encoding) res.setHeader('Content-Encoding', encoding);
        // Indicate that encoding selection may vary
        res.setHeader('Vary', 'Accept-Encoding');

        // Content-Type based on extension
        const contentType = require('mime-types').lookup(path.extname(fileOnDisk)) || 'application/octet-stream';
        res.setHeader('Content-Type', contentType as string);
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Last-Modified', stat.mtime.toUTCString());

        res.sendFile(fileOnDisk);
        return true;
      } catch (e) {
        return false;
      }
    };

    // Prefer Brotli
    if (acceptEncoding.includes("br")) {
      const brPath = uncompressedPath + ".br";
      if (fs.existsSync(brPath)) {
        if (serveFileWithHeaders(brPath, 'br')) return;
      }
    }

    // Then gzip
    if (acceptEncoding.includes("gzip")) {
      const gzPath = uncompressedPath + ".gz";
      if (fs.existsSync(gzPath)) {
        if (serveFileWithHeaders(gzPath, 'gzip')) return;
      }
    }

    next();
  });

  // Serve static files fallback
  app.use(express.static(distPath));

  // Handle API routes first
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
    }
  });

  // Handle client-side routing - serve index.html for all non-api routes
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
