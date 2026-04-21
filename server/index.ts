import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./email";

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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id),
        type          TEXT NOT NULL CHECK (type IN ('bank','crypto')),
        amount        DECIMAL(14,2) NOT NULL,
        fee           DECIMAL(14,2) NOT NULL DEFAULT 0,
        net_amount    DECIMAL(14,2) NOT NULL,
        bank_name     TEXT,
        bank_code     TEXT,
        account_number TEXT,
        account_name  TEXT,
        network       TEXT,
        address       TEXT,
        status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','refunded')),
        admin_note    TEXT,
        processed_at  TIMESTAMP,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE verifications
        ADD COLUMN IF NOT EXISTS sponsorship_reason TEXT
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

async function startAutoRefundJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // check every 60 minutes (reduced from 15 min to cut compute costs)
  setInterval(async () => {
    try {
      const stale = await storage.getPendingWithdrawalsOlderThan24h();
      for (const wd of stale) {
        // Refund balance
        const wallet = await storage.getOrCreateWallet(wd.userId);
        const refundAmt = parseFloat(wd.amount as string);
        const newBalance = (parseFloat(wallet.balance as string) + refundAmt).toFixed(2);
        await storage.updateWalletBalance(wd.userId, newBalance);
        await storage.createTransaction({
          userId: wd.userId, type: "refund",
          amount: refundAmt.toFixed(2), fee: "0",
          paymentMethod: wd.type === "bank" ? "bank_transfer" : "crypto",
          description: "Auto-refund: withdrawal not processed within 24 hours",
        });
        await storage.updateWithdrawalRequest(wd.id, {
          status: "refunded",
          adminNote: "Auto-refunded after 24h timeout",
          processedAt: new Date(),
        });
        const user = await storage.getUser(wd.userId);
        const notif = await storage.createNotification({
          userId: wd.userId, type: "wallet_credit",
          title: "Withdrawal Auto-Refunded",
          message: `Your withdrawal of $${refundAmt.toFixed(2)} was not processed within 24 hours and has been returned to your TSIA wallet.`,
          data: { withdrawalId: wd.id }, isRead: false,
        });
        try {
          await sendEmail(
            user!.email,
            "Withdrawal Auto-Refunded — TSIA",
            `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
              <h2 style="color:#92400e">Withdrawal Auto-Refunded</h2>
              <p style="color:#6b7280">Hi ${user!.firstName}, your withdrawal request was not processed within 24 hours.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#92400e">
                <strong>$${refundAmt.toFixed(2)}</strong> has been returned to your TSIA wallet.
              </div>
              <p style="font-size:13px;color:#6b7280">You can submit a new withdrawal request at any time. Please contact support if you need assistance.</p>
            </div>`
          );
        } catch {}
        console.log(`[AUTO-REFUND] Refunded withdrawal #${wd.id} ($${refundAmt}) for user ${wd.userId}`);
      }
    } catch (e) {
      console.error("[AUTO-REFUND] Error:", e);
    }
  }, INTERVAL_MS);
  console.log("[AUTO-REFUND] Job started — checking every 60 minutes");
}

(async () => {
  await runMigrations();
  await registerRoutes(httpServer, app);
  await seedAdmin();
  startAutoRefundJob();

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
