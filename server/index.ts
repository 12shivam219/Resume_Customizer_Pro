import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import compression from "compression";
import helmet from "helmet";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { createServer } from "http";

// Load environment variables from .env file
config();

// Load NODE_ENV default to production if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is required`);
    process.exit(1);
  }
}

const app = express();

// Use response compression for better network performance
// Enable for production and development (Vite handles HMR assets separately)
// Security middleware with development-friendly CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  })
);

// Response compression
app.use(compression());

// Add basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error and respond but do not rethrow to avoid crashing the process
    console.error('Unhandled error in request handler:', err instanceof Error ? err.stack || err.message : err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    // Allow graceful shutdown handlers to decide whether to exit
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port} (env=${process.env.NODE_ENV})`);
  });

  // Ensure logs directory exists (PM2 expects configured log paths)
  try {
    const logsDir = path.resolve(process.cwd(), 'logs', 'pm2');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      log(`Created logs directory at ${logsDir}`);
    }
  } catch (e) {
    console.warn('Could not create logs directory:', e);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    try {
      log(`Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        log('HTTP server closed');
        process.exit(0);
      });
      // force exit after 10s
      setTimeout(() => {
        console.error('Forcing shutdown after 10s');
        process.exit(1);
      }, 10_000).unref();
    } catch (e) {
      console.error('Error during shutdown', e);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err instanceof Error ? err.stack || err.message : err);
    // exit after logging
    process.exit(1);
  });
})();
