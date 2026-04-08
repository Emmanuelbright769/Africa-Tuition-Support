import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "15mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

async function runMigrations() {
  try {
    await db.execute(sql`
      ALTER TABLE co_affiliates
        ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(14,6) NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE trade_wallets
        ADD COLUMN IF NOT EXISTS bot_activated_at TIMESTAMP
    `);
    console.log("[MIGRATE] Schema migrations applied successfully");
  } catch (e) {
    console.error("[MIGRATE] Migration error:", e);
  }
}

async function seedAdmin() {
  const ADMIN_EMAIL = "admin@tsiforafrica.com";
  const ADMIN_PASSWORD = "admin123";
  try {
    const existing = await storage.getUserByEmailAndRole(ADMIN_EMAIL, "admin");
    if (!existing) {
      const admin = await storage.createUser({
        firstName: "TSIA",
        lastName: "Admin",
        email: ADMIN_EMAIL,
        phone: "",
        password: ADMIN_PASSWORD,
        country: "gb",
        role: "admin",
        referredBy: null,
      });
      await storage.updateUserAffiliateCode(admin.id, "ADMIN-TSIA");
      console.log("[SEED] Admin user created:", ADMIN_EMAIL);
    } else if (existing.password !== ADMIN_PASSWORD) {
      // Password drifted — correct it
      await db.update(users).set({ password: ADMIN_PASSWORD }).where(eq(users.id, existing.id));
      console.log("[SEED] Admin password corrected for:", ADMIN_EMAIL);
    } else {
      console.log("[SEED] Admin user OK:", ADMIN_EMAIL);
    }
  } catch (e) {
    console.error("[SEED] Failed to seed admin:", e);
  }
}

(async () => {
  await runMigrations();
  await registerRoutes(httpServer, app);
  await seedAdmin();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
