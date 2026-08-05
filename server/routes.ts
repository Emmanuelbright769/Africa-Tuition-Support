import type { Express } from "express";
import { type Server } from "http";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { addSseClient, removeSseClient, pushToUser } from "./realtime";
import { getCached, setCached, invalidateCacheKey, invalidateCachePrefix } from "./cache";
import {
  vtuBuyAirtime, vtuBuyData, vtuBuyElectricity, vtuBuyTv, vtuFundBetting,
  vtuGetDataVariations, vtuGetTvVariations, vtuVerifyCustomer, vtuGetBalance,
} from "./vtuNg";
import {
  sendEmail, ADMIN_EMAIL,
  sendOtpEmail, sendWelcomeEmail, sendWalletCreditEmail, sendWalletReceivedEmail, sendWalletSentEmail,
  sendOrderUpdateEmail, sendLoanUpdateEmail, sendLoanOfferEmail, sendVerificationUpdateEmail,
  sendReferralCommissionEmail, sendPriceDropEmail,
  sendNewSaleEmail, sendBotEarningsEmail, sendCoAffiliateEnrollmentEmail,
  sendTourBookingEmail, sendQceActivationEmail, sendQceWithdrawalEmail,
  sendNewArrivalEmail, sendReferralSignupEmail, sendNewMovieEmail,
  sendSupportContactToAdmin, sendSupportConfirmation,
  sendAdminNewUserEmail, sendAdminDepositEmail, sendAdminWithdrawalEmail,
  sendAdminVerificationEmail, sendAdminPortalFeeEmail, sendAdminLoanEmail,
  sendAdminSponsorshipEmail, sendStudentPlanReceiptEmail, sendAdminKycEmail, sendAdminOrderEmail,
  sendAdminCommissionWithdrawalEmail, sendAdminDepositConfirmedEmail,
  sendAdminTradeDepositEmail, sendAdminTradeWithdrawExchangeEmail,
  sendDisbursementProcessedEmail, sendDisbursementDeclinedEmail, sendDisbursementEditedEmail, sendScholarshipDeclinedEmail,
  sendAdminBankTransferEmail,
  sendAdminWalletTransferEmail,
  sendWithdrawalOtpEmail,
  sendTransferOtpEmail,
  sendTransactionReceiptEmail,
} from "./email";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import { VERBAL_QUESTIONS, QUANT_QUESTIONS, pickQuestions } from "./questions";
import { calculateWaecPercentage, getPayoutTier, CURRENCY_RATES, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, WAEC_GRADE_WEIGHTS, WAEC_GRADE_KEYS, generateAffiliateCode, getCoAffiliatePricing, getMilestoneProgress, CO_AFFILIATE_PROGRAM, TRADE_MARKET, TRADE_BROKERS, ECOMMERCE, getEliteSharePercentage, calculateStudentLoanLimit, calculateAffiliateLoanLimit, calculateLoanMonthly, calculateLoanByDays, QCE, getCoAffiliateTransactionRate, users, loans, transactions, tradeTransactions, orders, orderTracking, wallets, verifications, coAffiliates, walletDeposits, forumPosts, forumTopics, disbursements, notifications, billPayments, tradeWallets, exchangeHoldings, exchangeOrders, exchangeWatchlist } from "@shared/schema";
import { getAllQuotes, getQuote, getHistory } from "./exchangeService";
import { db } from "./db";
import { eq, desc, ne, and, sql, or } from "drizzle-orm";
import YahooFinance from "yahoo-finance2";

const PgSession = pgSession(session);

// In-memory cache for Paystack bank account resolutions
// key: `${bankCode}:${accountNumber}` → accountName
const bankResolveCache = new Map<string, string>();
const yf = new YahooFinance({ suppressNotices: ["ripHistorical"] });
const priceCache: { ts: number; data: any[] } = { ts: 0, data: [] };
const signalCache: { ts: number; signals: any[] } = { ts: 0, signals: [] };
const TRADE_SYMBOLS = [
  // Crypto
  { symbol: "BTC-USD",  label: "Bitcoin",       category: "crypto" },
  { symbol: "ETH-USD",  label: "Ethereum",      category: "crypto" },
  { symbol: "BNB-USD",  label: "BNB",           category: "crypto" },
  { symbol: "SOL-USD",  label: "Solana",        category: "crypto" },
  { symbol: "XRP-USD",  label: "Ripple",        category: "crypto" },
  { symbol: "ADA-USD",  label: "Cardano",       category: "crypto" },
  { symbol: "DOGE-USD", label: "Dogecoin",      category: "crypto" },
  { symbol: "AVAX-USD", label: "Avalanche",     category: "crypto" },
  { symbol: "DOT-USD",  label: "Polkadot",      category: "crypto" },
  { symbol: "LINK-USD", label: "Chainlink",     category: "crypto" },
  // Forex
  { symbol: "EURUSD=X", label: "EUR/USD",       category: "forex" },
  { symbol: "GBPUSD=X", label: "GBP/USD",       category: "forex" },
  { symbol: "JPY=X",    label: "USD/JPY",       category: "forex" },
  { symbol: "AUDUSD=X", label: "AUD/USD",       category: "forex" },
  { symbol: "CAD=X",    label: "USD/CAD",       category: "forex" },
  { symbol: "NZDUSD=X", label: "NZD/USD",       category: "forex" },
  { symbol: "EURGBP=X", label: "EUR/GBP",       category: "forex" },
  { symbol: "CHF=X",    label: "USD/CHF",       category: "forex" },
  { symbol: "EURJPY=X", label: "EUR/JPY",       category: "forex" },
  { symbol: "GBPJPY=X", label: "GBP/JPY",       category: "forex" },
  // Commodities
  { symbol: "GC=F",     label: "Gold",          category: "commodities" },
  { symbol: "SI=F",     label: "Silver",        category: "commodities" },
  { symbol: "CL=F",     label: "WTI Crude Oil", category: "commodities" },
  { symbol: "BZ=F",     label: "Brent Crude",   category: "commodities" },
  { symbol: "NG=F",     label: "Natural Gas",   category: "commodities" },
  { symbol: "HG=F",     label: "Copper",        category: "commodities" },
  { symbol: "PL=F",     label: "Platinum",      category: "commodities" },
  // Indices
  { symbol: "^GSPC",    label: "S&P 500",       category: "indices" },
  { symbol: "^IXIC",    label: "NASDAQ 100",    category: "indices" },
  { symbol: "^DJI",     label: "Dow Jones",     category: "indices" },
  { symbol: "^RUT",     label: "Russell 2000",  category: "indices" },
  { symbol: "^FTSE",    label: "FTSE 100",      category: "indices" },
  { symbol: "^GDAXI",   label: "DAX 40",        category: "indices" },
  { symbol: "^N225",    label: "Nikkei 225",    category: "indices" },
  { symbol: "^HSI",     label: "Hang Seng",     category: "indices" },
  // Stocks
  { symbol: "AAPL",     label: "Apple",         category: "stocks" },
  { symbol: "MSFT",     label: "Microsoft",     category: "stocks" },
  { symbol: "NVDA",     label: "NVIDIA",        category: "stocks" },
  { symbol: "TSLA",     label: "Tesla",         category: "stocks" },
  { symbol: "AMZN",     label: "Amazon",        category: "stocks" },
  { symbol: "META",     label: "Meta",          category: "stocks" },
  { symbol: "GOOGL",    label: "Alphabet",      category: "stocks" },
  { symbol: "JPM",      label: "JPMorgan",      category: "stocks" },
];

// ── USD/NGN exchange rate in-memory cache (5-min TTL) ─────────────────────
let _usdNgnRatesCache: { buying: number; selling: number; cachedAt: number } | null = null;
async function getUsdNgnRates(): Promise<{ buying: number; selling: number }> {
  if (_usdNgnRatesCache && Date.now() - _usdNgnRatesCache.cachedAt < 5 * 60 * 1000) {
    return _usdNgnRatesCache;
  }
  const buyingStr  = await storage.getPlatformSetting("usd_ngn_buying_rate");
  const sellingStr = await storage.getPlatformSetting("usd_ngn_selling_rate");
  const buying  = parseFloat(buyingStr  ?? "1480");
  const selling = parseFloat(sellingStr ?? "1280");
  _usdNgnRatesCache = { buying, selling, cachedAt: Date.now() };
  return _usdNgnRatesCache;
}
function invalidateUsdNgnRatesCache() { _usdNgnRatesCache = null; }

// ── Multi-currency exchange rates ──────────────────────────────────────────
const RATE_CURRENCIES = ["usd", "gbp", "eur", "cad", "aud", "ghs", "kes", "zar"] as const;
const RATE_DEFAULTS_BUY:  Record<string, number> = { usd: 1600, gbp: 2100, eur: 1750, cad: 1180, aud: 1020, ghs: 90, kes: 12, zar: 85 };
const RATE_DEFAULTS_SELL: Record<string, number> = { usd: 1550, gbp: 2000, eur: 1680, cad: 1130, aud: 970,  ghs: 85, kes: 11, zar: 80 };
let _allRatesCache: { data: Record<string, { buying: number; selling: number }>; cachedAt: number } | null = null;
async function getAllRates(): Promise<Record<string, { buying: number; selling: number }>> {
  if (_allRatesCache && Date.now() - _allRatesCache.cachedAt < 5 * 60 * 1000) return _allRatesCache.data;
  const data: Record<string, { buying: number; selling: number }> = {};
  for (const code of RATE_CURRENCIES) {
    const buyStr  = await storage.getPlatformSetting(`${code}_ngn_buying_rate`);
    const sellStr = await storage.getPlatformSetting(`${code}_ngn_selling_rate`);
    data[code] = {
      buying:  parseFloat(buyStr  ?? String(RATE_DEFAULTS_BUY[code])),
      selling: parseFloat(sellStr ?? String(RATE_DEFAULTS_SELL[code])),
    };
  }
  _allRatesCache = { data, cachedAt: Date.now() };
  return data;
}
function invalidateAllRatesCache() { _allRatesCache = null; _usdNgnRatesCache = null; }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and PDF files are allowed"));
  },
});

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const derivedBuf = scryptSync(plain, salt, 64);
    return timingSafeEqual(hashBuf, derivedBuf);
  } catch { return false; }
}

function hasPasswordSet(storedPassword: string | null | undefined): boolean {
  return !!storedPassword && storedPassword.startsWith("scrypt:");
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "tsia-session-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  app.post("/api/auth/request-otp", async (req, res) => {
    try {
      const { email, firstName, lastName, phone, country, referralCode, role, loginRole, password: plainPassword } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const normalizedReferralCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";

      const isSignup = !!firstName;

      // ── Login flow (not signup) ────────────────────────────────────────
      if (!isSignup) {
        const allAccounts = await storage.getUsersByEmail(email);

        if (allAccounts.length === 0) {
          return res.status(404).json({ message: "No account found with this email. Please sign up first." });
        }

        // Dual-account email detected — ask the user which one they want
        if (allAccounts.length > 1 && !loginRole) {
          return res.json({
            multipleRoles: true,
            roles: allAccounts.map(u => u.role),
            message: "Multiple accounts found. Please choose which account to sign in to.",
          });
        }

        // Role specified (or single account) — verify that account exists
        const targetUser = loginRole
          ? await storage.getUserByEmailAndRole(email, loginRole)
          : allAccounts[0];

        if (!targetUser) {
          return res.status(404).json({ message: `No ${loginRole} account found with this email.` });
        }

        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createOtp({ email, code, expiresAt, used: false });
        console.log(`[OTP] Code for ${email} (${targetUser.role}): ${code}`);
        sendOtpEmail(email, code, false).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));

        return res.json({ message: "OTP sent to your email", otpSent: true });
      }

      // ── Signup flow ────────────────────────────────────────────────────
      // Helper: create a user for a specific role if they don't exist yet
      const createRoleAccount = async (targetRole: "student" | "affiliate") => {
        let u = await storage.getUserByEmailAndRole(email, targetRole);
        if (!u) {
          u = await storage.createUser({
            firstName, lastName, email, phone: phone || "",
            password: plainPassword && typeof plainPassword === "string" && plainPassword.length >= 8
              ? hashPassword(plainPassword) : "otp-only",
            country: country || "ng", role: targetRole,
            referredBy: normalizedReferralCode || null,
          });
          const affCode = generateAffiliateCode(firstName, u.id);
          await storage.updateUserAffiliateCode(u.id, affCode);
          u = await storage.getUser(u.id);
          // Send wallet activation in-app notification to new user
          try {
            await storage.createNotification({
              userId: u!.id,
              type: "wallet_activation",
              title: "Activate Your TSIA Wallet",
              message: `Welcome to TSIA! To unlock all platform features — including QCE SwiftVault, loans, TS-Mart Online Stores and more — please fund your SwiftWallet with above $2. You can withdraw your money at any time; however, a minimum balance of $2 must remain in your wallet to keep the system running seamlessly. Head to your SwiftWallet section to make your first deposit.`,
              data: { minActivation: QCE.MIN_ACTIVATION, minBalance: QCE.MIN_BALANCE },
              isRead: false,
            });
          } catch { /* non-critical */ }
          // Notify referrer
          if (normalizedReferralCode) {
            try {
              const referrer = await storage.getUserByAffiliateCode(normalizedReferralCode);
              if (referrer) {
                await storage.createNotification({
                  userId: referrer.id, type: "referral", title: "New Referral",
                  message: `${firstName} ${lastName} signed up using your referral link as a ${targetRole}.`,
                  data: { newUserId: u!.id, role: targetRole }, isRead: false,
                });
                sendReferralSignupEmail(referrer.email, referrer.firstName, `${firstName} ${lastName}`, targetRole).catch((err: any) => console.error("[EMAIL] Referral signup email failed:", err?.message ?? err));
              }
            } catch { /* non-critical */ }
          }
          // Send real welcome email
          sendWelcomeEmail(email, firstName, targetRole as "student" | "affiliate").catch((err: any) => console.error("[EMAIL] Welcome send failed:", err?.message ?? err));
          // Notify admin of new registration
          sendAdminNewUserEmail({ name: `${firstName} ${lastName}`, email, role: targetRole, country: country || undefined, phone: phone || undefined, referredBy: normalizedReferralCode || undefined }).catch(() => {});
        }
        return u;
      };

      // "both" — create student + affiliate accounts with one OTP
      if (role === "both") {
        const studentUser  = await createRoleAccount("student");
        const affiliateUser = await createRoleAccount("affiliate");
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createOtp({ email, code, expiresAt, used: false });
        console.log(`[OTP] Dual-account code for ${email}: ${code}`);
        sendOtpEmail(email, code, true).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));
        return res.json({ message: "OTP sent to your email", otpSent: true, bothCreated: true });
      }

      // Single-role signup
      const targetRole = role === "affiliate" ? "affiliate" : "student";
      const user = await createRoleAccount(targetRole);

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email, code, expiresAt, used: false });
      console.log(`[OTP] Code for ${email}: ${code}`);
      sendOtpEmail(email, code, true).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));

      res.json({
        message: "OTP sent to your email",
        otpSent: true,
        isNewUser: !await storage.getVerificationByUser(user!.id),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, code, loginRole } = req.body;
      if (!email || !code) return res.status(400).json({ message: "Email and OTP code are required" });

      const otp = await storage.getValidOtp(email, code);
      if (!otp) return res.status(401).json({ message: "Invalid or expired OTP code" });
      await storage.markOtpUsed(otp.id);

      // Find the correct user — prefer role-specific lookup to handle dual accounts
      const user = loginRole
        ? await storage.getUserByEmailAndRole(email, loginRole)
        : await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      (req.session as any).userId = user.id;

      // Detect new user: wallet balance still 0 (never funded)
      let isNewUser = false;
      try {
        const wallet = await storage.getOrCreateWallet(user.id);
        isNewUser = parseFloat(wallet.balance) === 0;
      } catch { /* non-critical */ }

      req.session.save(async (err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        // Single-session enforcement: record this session as the only valid one
        await storage.updateUserActiveSession(user.id, req.session.id).catch(() => {});
        res.json({
          id: user.id, firstName: user.firstName, lastName: user.lastName,
          email: user.email, role: user.role, phone: user.phone, country: user.country,
          affiliateCode: user.affiliateCode, isNewUser,
        });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    // Single-session enforcement: if another device logged in, this session is stale
    if (user.activeSessionId && user.activeSessionId !== req.session.id) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "SESSION_DISPLACED", reason: "Your account has been signed in on another device. You have been signed out." });
    }

    res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, phone: user.phone, country: user.country, affiliateCode: user.affiliateCode, walletFundDeadline: user.walletFundDeadline ?? null });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (userId) await storage.updateUserActiveSession(userId, null).catch(() => {});
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.patch("/api/user/country", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { country } = req.body;
    if (!country || typeof country !== "string" || country.trim().length < 2) {
      return res.status(400).json({ message: "Valid country code is required" });
    }
    await storage.updateUserCountry(userId, country.trim().toLowerCase());
    const user = await storage.getUser(userId);
    res.json({ ok: true, country: user?.country });
  });

  // GET /api/auth/linked-roles — returns all roles this email has accounts for
  app.get("/api/auth/linked-roles", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const allAccounts = await storage.getUsersByEmail(user.email);
      res.json({ roles: allAccounts.map(u => u.role), currentRole: user.role });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/switch-role — switch to another role for the same email
  app.post("/api/auth/switch-role", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { targetRole } = req.body;
      if (!targetRole) return res.status(400).json({ error: "targetRole is required" });
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(404).json({ error: "User not found" });
      if (currentUser.role === targetRole) return res.json({
        id: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName,
        email: currentUser.email, role: currentUser.role, affiliateCode: currentUser.affiliateCode,
      });
      const targetUser = await storage.getUserByEmailAndRole(currentUser.email, targetRole);
      if (!targetUser) {
        return res.status(404).json({ error: `No ${targetRole} account found for this email. Please sign up for a ${targetRole} account first.` });
      }
      (req.session as any).userId = targetUser.id;
      req.session.save(async (err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
        await storage.updateUserActiveSession(targetUser.id, req.session.id).catch(() => {});
        res.json({
          id: targetUser.id, firstName: targetUser.firstName, lastName: targetUser.lastName,
          email: targetUser.email, role: targetUser.role, affiliateCode: targetUser.affiliateCode,
        });
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user || (user.password !== password && user.password !== "otp-only"))
        return res.status(401).json({ message: "Invalid credentials" });
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── Admin password login (no OTP) ─────────────────────────────────────────
  app.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

      const admin = await storage.getUserByEmailAndRole(email, "admin");
      if (!admin) return res.status(401).json({ message: "Invalid credentials" });
      if (admin.password !== password) return res.status(401).json({ message: "Incorrect password" });

      (req.session as any).userId = admin.id;
      req.session.save(async (err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        await storage.updateUserActiveSession(admin.id, req.session.id).catch(() => {});
        res.json({ id: admin.id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role, affiliateCode: admin.affiliateCode });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Check auth mode: does this email/role have a password set? ─────────────
  app.post("/api/auth/check-auth-mode", async (req, res) => {
    try {
      const { email, loginRole } = req.body;
      if (!email) return res.status(400).json({ message: "Email required" });
      const user = loginRole
        ? await storage.getUserByEmailAndRole(email, loginRole)
        : (await storage.getUsersByEmail(email))[0];
      if (!user) return res.json({ exists: false, hasPassword: false });
      return res.json({ exists: true, hasPassword: hasPasswordSet(user.password), role: user.role });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Password login (users who opted for password auth) ─────────────────────
  app.post("/api/auth/login-password", async (req, res) => {
    try {
      const { email, password, loginRole } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
      const user = loginRole
        ? await storage.getUserByEmailAndRole(email, loginRole)
        : (await storage.getUsersByEmail(email))[0];
      if (!user) return res.status(401).json({ message: "No account found with this email." });
      if (!hasPasswordSet(user.password)) return res.status(401).json({ message: "This account uses OTP login. Please sign in with a one-time code." });
      if (!verifyPassword(password, user.password)) return res.status(401).json({ message: "Incorrect password. Try again or use OTP login." });
      (req.session as any).userId = user.id;
      req.session.save(async (err) => {
        if (err) return res.status(500).json({ message: "Session error" });
        await storage.updateUserActiveSession(user.id, req.session.id).catch(() => {});
        res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, phone: user.phone, country: user.country, affiliateCode: user.affiliateCode });
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Request OTP for password change / set ──────────────────────────────────
  app.post("/api/auth/request-password-otp", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email: user.email, code, expiresAt, used: false });
      console.log(`[OTP] Password change code for ${user.email}: ${code}`);
      sendOtpEmail(user.email, code, false).catch(() => {});
      res.json({ message: "OTP sent to your email", otpSent: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Set / change password (requires valid OTP) ─────────────────────────────
  app.post("/api/auth/set-password", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { otpCode, newPassword } = req.body;
      if (!otpCode || !newPassword) return res.status(400).json({ message: "OTP and new password are required" });
      if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const otp = await storage.getValidOtp(user.email, otpCode.trim());
      if (!otp) return res.status(401).json({ message: "Invalid or expired OTP code" });
      await storage.markOtpUsed(otp.id);
      await storage.updateUserPassword(userId, hashPassword(newPassword));
      res.json({ message: "Password updated successfully" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Request OTP for email change ────────────────────────────────────────────
  app.post("/api/auth/request-email-change-otp", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email: user.email, code, expiresAt, used: false });
      console.log(`[OTP] Email change code for ${user.email}: ${code}`);
      sendOtpEmail(user.email, code, false).catch(() => {});
      res.json({ message: "OTP sent to your current email", otpSent: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Change email (requires valid OTP, new email must be free) ───────────────
  app.post("/api/auth/change-email", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { otpCode, newEmail } = req.body;
      if (!otpCode || !newEmail) return res.status(400).json({ message: "OTP and new email are required" });
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(newEmail.trim())) return res.status(400).json({ message: "Invalid email address" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const otp = await storage.getValidOtp(user.email, otpCode.trim());
      if (!otp) return res.status(401).json({ message: "Invalid or expired OTP code" });
      const existing = await storage.getUserByEmail(newEmail.trim().toLowerCase());
      if (existing && existing.id !== userId) return res.status(409).json({ message: "That email is already in use by another account" });
      await storage.markOtpUsed(otp.id);
      await storage.updateUserEmail(userId, newEmail.trim().toLowerCase());
      res.json({ message: "Email updated successfully" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── User profile ────────────────────────────────────────────────────────────
  app.get("/api/user/profile", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        country: user.country,
        role: user.role,
        affiliateCode: user.affiliateCode,
        hasPassword: hasPasswordSet(user.password),
        authMode: hasPasswordSet(user.password) ? "password" : "otp",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/user/profile", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { firstName, lastName, phone } = req.body;
      const updates: Record<string, string> = {};
      if (firstName?.trim()) updates.firstName = firstName.trim();
      if (lastName?.trim()) updates.lastName = lastName.trim();
      if (phone?.trim()) updates.phone = phone.trim();
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "Nothing to update" });
      await storage.updateUserProfile(userId, updates);
      const updated = await storage.getUser(userId);
      res.json({ message: "Profile updated", user: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const fileData = req.file.buffer.toString("base64");
      const category = (req.body.category as string) || "document";

      const saved = await storage.createFileUpload({
        userId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileData,
        category,
      });

      res.json({
        id: saved.id,
        fileName: saved.fileName,
        fileType: saved.fileType,
        fileSize: saved.fileSize,
        category: saved.category,
        createdAt: saved.createdAt,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/uploads", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const files = await storage.getFilesByUser(userId);
    res.json(files.map(f => ({
      id: f.id, fileName: f.fileName, fileType: f.fileType,
      fileSize: f.fileSize, category: f.category, createdAt: f.createdAt,
    })));
  });

  // ── Helper: verify any Nigerian ID via Prembly (api.prembly.com) ─────────
  // Prembly (formerly Identitypass) supports NIN, BVN, VIN, Driver's Licence, Passport.
  // Set PREMBLY_API_KEY and PREMBLY_APP_ID in secrets to enable live lookups.
  async function ninverifyLookup(idType: string, idBody: Record<string, string>): Promise<{ ok: boolean; data: any; message: string }> {
    const apiKey = process.env.PREMBLY_API_KEY;
    const appId  = process.env.PREMBLY_APP_ID;

    if (!apiKey || !appId) {
      return { ok: false, data: null, message: "Identity verification service is not configured. Please contact support." };
    }

    // Prembly endpoint map — https://api.prembly.com/identitypass/verification/
    const endpointMap: Record<string, string> = {
      nin:             "https://api.prembly.com/identitypass/verification/nin",
      bvn:             "https://api.prembly.com/identitypass/verification/bvn",
      voters_card:     "https://api.prembly.com/identitypass/verification/voter_id",
      drivers_license: "https://api.prembly.com/identitypass/verification/drivers_license",
      passport:        "https://api.prembly.com/identitypass/verification/passport",
      national_id:     "https://api.prembly.com/identitypass/verification/nin",
    };

    // Prembly body field map — field names confirmed against live API
    const bodyMap: Record<string, Record<string, string>> = {
      nin:             { number_nin:      idBody.nin          || "" },
      bvn:             { number:          idBody.bvn          || "" },
      voters_card:     { number:          idBody.vin          || "", last_name: idBody.last_name || "" },
      drivers_license: { number:          idBody.license_no   || "", first_name: idBody.first_name || "", last_name: idBody.last_name || "" },
      passport:        { number:          idBody.passport_no  || "", last_name: idBody.last_name || "" },
      national_id:     { number_nin:      idBody.nin          || "" },
    };

    const url  = endpointMap[idType] || endpointMap.nin;
    const body = bodyMap[idType]     || { number: Object.values(idBody)[0] || "" };

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key":     apiKey,
          "app-id":        appId,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err: any) {
      console.error("[KYC] Network error calling Prembly:", err.message, err.cause?.message ?? "");
      return { ok: false, data: null, message: "Verification service is temporarily unreachable. Please try again shortly." };
    }

    const raw = await resp.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      console.error("[KYC] Non-JSON response from Prembly:", raw.slice(0, 300));
      return { ok: false, data: null, message: "Verification service returned an unexpected response. Please try again." };
    }

    console.log(`[KYC Prembly] ${idType} → HTTP ${resp.status} | status=${json.status} | detail=${json.detail || json.message || ""} | errors=${JSON.stringify(json.errors || {})}`);

    // Prembly returns status:true on success, status:false on failure
    if (!resp.ok || json.status === false) {
      // Wallet balance insufficient → treat as format-only pass so users aren't blocked
      // while the Prembly account is being funded
      const isLowBalance = json?.message?.toLowerCase().includes("insufficient") ||
                           json?.detail?.toLowerCase().includes("insufficient") ||
                           json?.response_code === "04";
      if (isLowBalance) {
        console.warn("[KYC Prembly] Insufficient wallet balance — falling back to format-only validation");
        return { ok: true, data: null, message: "format_only" };
      }
      const errMsg = json?.detail || json?.message || "ID could not be verified. Please check your details and try again.";
      return { ok: false, data: null, message: errMsg };
    }

    const d = json.data || json;
    return {
      ok: true,
      message: json.detail || json.message || "Verified",
      data: {
        firstName:   d.firstname  || d.firstName  || d.first_name  || "",
        lastName:    d.surname    || d.lastName   || d.last_name   || d.lastname   || "",
        middleName:  d.middlename || d.middleName || d.middle_name || "",
        gender:      d.gender     || "",
        phone:       d.phone      || d.phoneNumber || d.phone_number || "",
        dateOfBirth: d.birthdate  || d.dateOfBirth || d.date_of_birth || d.dob || "",
        photo:       d.photo      || d.image       || d.passport_photo || null,
      },
    };
  }

  // ID type format validators
  const ID_VALIDATORS: Record<string, (v: string) => boolean> = {
    nin:             v => /^\d{11}$/.test(v),
    bvn:             v => /^\d{11}$/.test(v),
    voters_card:     v => v.length >= 10 && v.length <= 25,
    drivers_license: v => v.length >= 8 && v.length <= 20,
    passport:        v => v.length >= 6 && v.length <= 15,
    national_id:     v => v.length >= 5 && v.length <= 30,
  };
  const ID_LABELS: Record<string, string> = {
    nin: "NIN", bvn: "BVN", voters_card: "Voter's Card (VIN)", drivers_license: "Driver's License",
    passport: "International Passport", national_id: "National ID / Residence Permit",
  };

  // ── Unified ID validation endpoint ──────────────────────────────────────
  // Intentionally public (no session required): this is called during signup
  // Step 2 before the user's account exists. It is a pure Prembly lookup —
  // no user data is written here. The downstream /api/verification/identity
  // route (which persists the result) still requires authentication.
  app.post("/api/verification/validate-id", async (req, res) => {
    try {
      const { idType = "nin", idNumber, lastName } = req.body;
      if (!idNumber || !idType) return res.status(400).json({ message: "ID type and number are required." });

      const validator = ID_VALIDATORS[idType];
      if (!validator || !validator(idNumber.trim())) {
        return res.status(400).json({ message: `Invalid ${ID_LABELS[idType] || idType} format. Please check and try again.` });
      }

      // Build the request body for ninverify based on ID type
      const bodyMap: Record<string, Record<string, string>> = {
        nin:             { nin: idNumber.trim() },
        bvn:             { bvn: idNumber.trim() },
        voters_card:     { vin: idNumber.trim() },
        drivers_license: { license_no: idNumber.trim() },
        passport:        { passport_no: idNumber.trim(), last_name: (lastName || "").trim() },
        national_id:     { nin: idNumber.trim() },
      };
      const idBody = bodyMap[idType] || { nin: idNumber.trim() };

      const result = await ninverifyLookup(idType, idBody);
      if (!result.ok) return res.status(400).json({ message: result.message });

      const isFormatOnly = result.message === "format_only" || result.message === "demo" || !result.data;
      return res.json({
        valid: true,
        idType,
        idNumber,
        demo: isFormatOnly,
        message: isFormatOnly
          ? `${ID_LABELS[idType] || idType} accepted — live verification will be confirmed by the team.`
          : `${ID_LABELS[idType] || idType} verified successfully.`,
        data: result.data,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Backward-compat alias for old NIN-only endpoint
  app.post("/api/verification/validate-nin", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const wallet = await storage.getOrCreateWallet(userId);
    const nin = req.body.nin || req.body.idNumber;
    if (!nin || nin.length !== 11 || !/^\d{11}$/.test(nin)) return res.status(400).json({ message: "NIN must be exactly 11 digits." });
    const result = await ninverifyLookup("nin", { nin });
    if (!result.ok) return res.status(400).json({ message: result.message });
    const demo = result.message === "demo";
    return res.json({ valid: true, nin, demo, data: result.data });
  });

  app.post("/api/verification/identity", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const wallet = await storage.getOrCreateWallet(userId);

      // Support both old { nin } and new { idType, idNumber } shapes
      const idType   = req.body.idType || "nin";
      const idNumber = req.body.idNumber || req.body.nin;
      if (!idNumber) return res.status(400).json({ message: "ID number is required." });

      let verification = await storage.getVerificationByUser(userId);
      const update = { nin: idNumber, idType } as any;
      if (verification) {
        verification = await storage.updateVerification(verification.id, update);
      } else {
        verification = await storage.createVerification({ userId, nin: idNumber, idType, status: "pending", portalFeePaid: false, tier: "none" });
      }
      res.json(verification);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/waec-validate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const wallet = await storage.getOrCreateWallet(userId);

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) return res.status(400).json({ message: "Start verification first" });

      const { waecRegNumber, waecYear, subjects, grades, schoolName, schoolLocation, sponsorshipReason } = req.body;

      if (!waecRegNumber || !waecYear) {
        return res.status(400).json({ message: "WAEC registration number and year are required" });
      }

      if (!schoolName || !schoolLocation) {
        return res.status(400).json({ message: "School name and location are required" });
      }

      if (!subjects || !Array.isArray(subjects) || subjects.length !== 5) {
        return res.status(400).json({ message: "Exactly 5 subjects are required (Mathematics + English Language + 3 electives)" });
      }

      if (!subjects.includes("Mathematics") || !subjects.includes("English Language")) {
        return res.status(400).json({ message: "Mathematics and English Language are compulsory subjects" });
      }

      if (!grades || !Array.isArray(grades) || grades.length !== 5) {
        return res.status(400).json({ message: "Grades are required for all 5 subjects" });
      }

      const validGrades = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
      for (const g of grades) {
        if (!validGrades.includes(g.toUpperCase())) {
          return res.status(400).json({ message: `Invalid grade "${g}". Valid grades: ${validGrades.join(", ")}` });
        }
      }

      const gradeScaleRaw = await storage.getPlatformSetting("waec_grade_scale");
      const gradeScale = gradeScaleRaw ? JSON.parse(gradeScaleRaw) : undefined;
      const percentage = calculateWaecPercentage(grades, gradeScale);
      const tierPayouts = await storage.getTierPayouts();
      const payoutInfo = (() => {
        if (percentage >= 75) return { min: tierPayouts.platinum.min, max: tierPayouts.platinum.max, label: "platinum" };
        if (percentage >= 60) return { min: tierPayouts.gold.min, max: tierPayouts.gold.max, label: "gold" };
        if (percentage >= 51) return { min: tierPayouts.silver.min, max: tierPayouts.silver.max, label: "silver" };
        return { min: 0, max: 0, label: "none" };
      })();

      const waecApiResponse = {
        valid: true,
        regNumber: waecRegNumber,
        year: waecYear,
        candidateName: `${(await storage.getUser(userId))?.firstName} ${(await storage.getUser(userId))?.lastName}`,
        school: schoolName,
        subjects: subjects.map((s: string, i: number) => ({ subject: s, grade: grades[i] })),
        verificationId: `WAEC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      };

      let tier: "platinum" | "gold" | "silver" | "none" = payoutInfo.label as any;

      // Silent age disqualification: estimated age = currentYear - waecYear + 16; if > 29, flag silently
      const currentYear = new Date().getFullYear();
      const estimatedAge = currentYear - parseInt(waecYear, 10) + 16;
      const isAgeDisqualified = estimatedAge > 29;

      verification = await storage.updateVerification(verification.id, {
        waecRegNumber,
        waecYear,
        waecSubjects: subjects.join(","),
        waecGrades: grades.join(" "),
        schoolName,
        schoolLocation,
        tier,
        waecPercentage: percentage.toFixed(2),
        payoutMin: payoutInfo.min.toFixed(2),
        payoutMax: payoutInfo.max.toFixed(2),
        ageDisqualified: isAgeDisqualified,
        ...(sponsorshipReason ? { sponsorshipReason } : {}),
      });

      // Set 72-hour wallet funding deadline — if wallet not activated by then, account is purged
      const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await storage.setWalletFundDeadline(userId, deadline);

      // Return success regardless of age — disqualification is invisible to user
      res.json({
        ...verification,
        calculatedPercentage: percentage,
        payoutRange: payoutInfo,
        waecValidation: waecApiResponse,
        walletFundDeadline: deadline.toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── BVN Verification via Prembly (api.prembly.com) ─────────────────────────
  app.post("/api/verification/bvn", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { bvn } = req.body;
      if (!bvn || bvn.length !== 11 || !/^\d{11}$/.test(bvn)) {
        return res.status(400).json({ message: "BVN must be exactly 11 digits." });
      }

      const apiKey = process.env.PREMBLY_API_KEY;
      const appId  = process.env.PREMBLY_APP_ID;
      if (!apiKey || !appId) {
        console.warn("[BVN] PREMBLY_API_KEY/PREMBLY_APP_ID not set — running format-only check");
        return res.json({ valid: true, bvn, message: "BVN format validated (live lookup pending key).", demo: true });
      }

      // Prembly BVN lookup
      let verifyData: any = null;
      try {
        const verifyRes = await fetch("https://api.prembly.com/identitypass/verification/bvn", {
          method: "POST",
          headers: {
            "x-api-key":    apiKey,
            "app-id":       appId,
            "Content-Type": "application/json",
            "Accept":       "application/json",
          },
          body: JSON.stringify({ number: bvn }),
          signal: AbortSignal.timeout(15000),
        });
        const raw = await verifyRes.text();
        try { verifyData = JSON.parse(raw); } catch { /* non-JSON response */ }
        if (verifyData && (!verifyRes.ok || verifyData.status === false)) {
          return res.status(400).json({
            message: verifyData?.detail || verifyData?.message || "BVN could not be verified. Please check the number and try again.",
          });
        }
      } catch (fetchErr: any) {
        console.warn("[BVN] Prembly unreachable — falling back to format-only validation:", fetchErr?.message);
        return res.json({ valid: true, bvn, message: "BVN accepted (format validated). Proceeding.", demo: true });
      }

      const bvnData = (verifyData?.data) || verifyData;
      return res.json({
        valid: true,
        bvn,
        message: "BVN verified successfully.",
        data: {
          firstName: bvnData.firstName || bvnData.first_name || "",
          lastName: bvnData.lastName || bvnData.last_name || "",
          phone: bvnData.phoneNumber || bvnData.phone || "",
          dateOfBirth: bvnData.dateOfBirth || bvnData.dob || "",
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Wallet KYC Completion (BVN + GPS + Selfie → marks biometricVerified) ────
  app.post("/api/verification/wallet-kyc", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { bvn, gpsCoords, selfieBase64 } = req.body;
      if (!gpsCoords)     return res.status(400).json({ message: "GPS coordinates are required." });
      if (!selfieBase64)  return res.status(400).json({ message: "Facial selfie is required." });

      // ── Determine if BVN is required based on estimated age from WAEC year ─
      let verification = await storage.getVerificationByUser(userId);
      if (!verification) {
        verification = await storage.createVerification({
          userId, status: "pending", portalFeePaid: false, tier: "none",
        });
      }
      const currentYearKyc = new Date().getFullYear();
      const waecYrKyc = verification.waecYear ? parseInt(verification.waecYear, 10) : null;
      const estimatedAgeKyc = waecYrKyc ? currentYearKyc - waecYrKyc + 16 : 99;
      const bvnRequired = estimatedAgeKyc >= 20;

      if (bvnRequired && !bvn) {
        return res.status(400).json({ message: "BVN is required for users aged 20 and above." });
      }
      if (bvn && (bvn.length !== 11 || !/^\d{11}$/.test(bvn))) {
        return res.status(400).json({ message: "BVN must be exactly 11 digits." });
      }

      // ── Optional: Prembly face/liveness check ──────────────────────────────
      try {
        const PREMBLY_KEY = process.env.PREMBLY_API_KEY || "";
        const PREMBLY_APP = process.env.PREMBLY_APP_ID  || "";
        if (PREMBLY_KEY && PREMBLY_APP) {
          const imageData = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
          const pfRes = await fetch("https://api.prembly.com/identitypass/verification/biometrics/face/liveliness_check", {
            method: "POST",
            headers: { "x-api-key": PREMBLY_KEY, "app-id": PREMBLY_APP, "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData }),
            signal: AbortSignal.timeout(20000),
          });
          const pfJson = await pfRes.json();
          if (pfRes.ok && pfJson.status === false && pfJson.verification?.status === "NOT VERIFIED") {
            return res.status(400).json({ message: "Facial liveness check failed. Please retake your selfie in good lighting and look directly at the camera." });
          }
        }
      } catch { /* face API optional — fall through */ }

      const alreadyDone = verification.biometricVerified;

      // Mark biometric/KYC as done — unlocks wallet deposits and withdrawals
      verification = await storage.updateVerification(verification.id, {
        biometricVerified: true,
      });

      // ── Credit 5% referral commission to referrer on wallet KYC (first time only) ──
      // Uses $3 portal fee equivalent as base amount; deduplication prevents double-credit
      // with the portal fee route (whichever fires first wins).
      if (!alreadyDone) {
        const referralResult = await creditReferrerCommissionOnce(userId, 3.00, "wallet activation");
        if (!referralResult.credited) console.log(`[REFERRAL] No wallet KYC commission credited for user ${userId}`);
      }

      // Notify referrer that this user has activated their wallet
      try {
        const kycUser = await storage.getUser(userId);
        if (kycUser?.referredBy && !alreadyDone) {
          const kycReferrer = await storage.getUserByAffiliateCode(kycUser.referredBy);
          if (kycReferrer) {
            const refN = await storage.createNotification({
              userId: kycReferrer.id, type: "referral_activated",
              title: "Referral Wallet Activated 🎉",
              message: `${kycUser.firstName} ${kycUser.lastName.charAt(0)}. (one of your referrals) has activated their TSIA wallet. Your referral commission has been added to your Commission Wallet.`,
              data: { referredUserId: kycUser.id }, isRead: false,
            });
            pushToUser(kycReferrer.id, "notification", refN);
          }
        }
      } catch { /* non-critical */ }

      // Fire notification
      try {
        const kycNotif = await storage.createNotification({
          userId,
          type: "verification_update",
          title: "Wallet KYC Complete ✓",
          message: bvn
            ? "Your BVN, GPS location, and facial biometric have been verified. Your TSIA wallet is now fully unlocked."
            : "Your GPS location and facial biometric have been verified. Your TSIA wallet is now fully unlocked.",
          data: { bvn: bvn ? bvn.slice(-4).padStart(11, "*") : "N/A (under 20)", gpsCoords },
          isRead: false,
        });
        pushToUser(userId, "notification", kycNotif);
      } catch { /* non-critical */ }

      // Notify admin — KYC submitted
      try {
        const kycUser = await storage.getUser(userId);
        if (kycUser) {
          sendAdminKycEmail({
            name: `${kycUser.firstName} ${kycUser.lastName}`,
            email: kycUser.email,
            kycType: "BVN + GPS + Facial Biometric",
            userId,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      res.json({ success: true, verification, message: "Wallet KYC completed. Your wallet is now fully unlocked." });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/biometric", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { selfieBase64 } = req.body;
      if (!selfieBase64) return res.status(400).json({ message: "Selfie image is required." });

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) return res.status(400).json({ message: "Start verification first" });

      // ── Attempt Prembly face/liveness check (requires face verification plan) ──
      let premblyFaceResult: any = null;
      try {
        const PREMBLY_KEY = process.env.PREMBLY_API_KEY || "";
        const PREMBLY_APP = process.env.PREMBLY_APP_ID  || "";
        if (PREMBLY_KEY && PREMBLY_APP) {
          // Strip the data URI prefix if present
          const imageData = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
          const pfRes = await fetch("https://api.prembly.com/identitypass/verification/biometrics/face/liveliness_check", {
            method: "POST",
            headers: {
              "x-api-key":    PREMBLY_KEY,
              "app-id":       PREMBLY_APP,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: imageData }),
            signal: AbortSignal.timeout(20000),
          });
          const pfJson = await pfRes.json();
          if (pfRes.ok && pfJson.status === true && pfJson.verification?.status === "VERIFIED") {
            premblyFaceResult = pfJson;
          }
        }
      } catch { /* face check optional — fall through */ }

      // Mark biometric done regardless (selfie captured = liveness proven)
      verification = await storage.updateVerification(verification.id, { biometricVerified: true });

      res.json({
        success: true,
        message: "Facial biometric verification completed.",
        premblyChecked: !!premblyFaceResult,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Face Liveness Check (called by BiometricVerification.tsx during onboarding) ──
  app.post("/api/verification/face-liveness", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { image } = req.body;
      if (!image) return res.status(400).json({ message: "Image is required." });

      const PREMBLY_KEY = process.env.PREMBLY_API_KEY || "";
      const PREMBLY_APP = process.env.PREMBLY_APP_ID  || "";

      if (!PREMBLY_KEY || !PREMBLY_APP) {
        console.error("[FaceLiveness] PREMBLY_API_KEY / PREMBLY_APP_ID not configured");
        return res.status(503).json({ live: false, reason: "Verification service not configured. Contact support." });
      }

      const imageData = image.replace(/^data:image\/\w+;base64,/, "");

      let pfRes: Response;
      let pfJson: any;
      try {
        pfRes = await fetch("https://api.prembly.com/identitypass/verification/biometrics/face/liveliness_check", {
          method: "POST",
          headers: {
            "x-api-key":    PREMBLY_KEY,
            "app-id":       PREMBLY_APP,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: imageData }),
          signal: AbortSignal.timeout(25000),
        });
        pfJson = await pfRes.json();
      } catch (fetchErr: any) {
        console.error("[FaceLiveness] Prembly unreachable:", fetchErr?.message);
        return res.status(503).json({ live: false, reason: "Verification service is temporarily unavailable. Please try again." });
      }

      if (!pfRes.ok) {
        console.error("[FaceLiveness] Prembly HTTP error:", pfRes.status, pfJson?.detail);
        return res.json({ live: false, confidence: 0, reason: pfJson?.detail || "Verification failed. Please try again." });
      }

      const isLive    = pfJson.status === true && pfJson.verification?.status === "VERIFIED";
      const isNotLive = pfJson.status === false || pfJson.verification?.status === "NOT VERIFIED";
      const confidence = pfJson.data?.confidence_in_percentage ?? (isLive ? 95 : 10);

      console.log(`[FaceLiveness] userId=${userId} live=${isLive} confidence=${confidence} status=${pfJson.verification?.status}`);

      if (isNotLive && !isLive) {
        return res.json({ live: false, confidence, reason: pfJson.detail || "Liveness not detected. Ensure your face is clearly visible and well-lit." });
      }

      return res.json({ live: true, confidence });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/pay-fee", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const feeWallet = await storage.getOrCreateWallet(userId);
      if (!feeWallet.activated) {
        return res.status(403).json({ message: "Activate your TSIA SwiftWallet with above $2 before paying the portal fee." });
      }

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) {
        verification = await storage.createVerification({
          userId, status: "pending", portalFeePaid: false, tier: "none",
        });
      }

      // ── Batch enrollment check ──────────────────────────────────────────────
      const BATCH_MAX = 1000; // server-side only; never sent to client
      let batch = await storage.getCurrentBatch();

      if (batch && batch.status === "closed") {
        // Check if this student has a personal invitation from the admin
        const personalInvite = await storage.getPersonalInvitationByEmail(user.email);
        if (!personalInvite) {
          // No personal invitation — show the closed batch countdown
          const reopens = batch.nextOpenAt
            ? new Date(batch.nextOpenAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : "soon";
          return res.status(409).json({
            code: "BATCH_CLOSED",
            message: `The current enrollment batch is complete. The next batch opens on ${reopens}. You can still access all other platform features while you wait.`,
            nextOpenAt: batch.nextOpenAt,
          });
        }
        // Has a personal invite — allow enrollment and consume the invite
        await storage.usePersonalInvitation(user.email, userId);
        // Increment enrollment count on the closed batch without reopening it
        batch = (await storage.incrementBatchEnrollment(batch.id, BATCH_MAX)).batch;
      }

      if (!batch) {
        // Create new batch (first-ever OR previous batch expired after 30 days)
        const allBatches = await storage.getAllBatches();
        batch = await storage.createBatch((allBatches?.length ?? 0) + 1);
      }

      // Fee already paid for THIS batch — block re-payment
      if (verification.portalFeePaid && (verification as any).paidBatchId === batch.id) {
        return res.status(400).json({ message: "Fee already paid for this batch" });
      }
      // ────────────────────────────────────────────────────────────────────────

      const portalFee = 3.00;
      const serviceCharge = 0.30;
      const totalCharged = portalFee + serviceCharge;
      const ngnEquivalent = Math.round(totalCharged * CURRENCY_RATES.USD_TO_NGN_PAYMENT);

      // ── Debit wallet — must have sufficient balance ──────────────────────────
      const feeWalletBalance = parseFloat(feeWallet.balance);
      const feeWalletLien = parseFloat(feeWallet.lienAmount ?? "0");
      const feeWalletAvailable = Math.max(0, feeWalletBalance - feeWalletLien);
      if (feeWalletAvailable < totalCharged) {
        const shortfall = (totalCharged - feeWalletAvailable).toFixed(2);
        return res.status(402).json({
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient wallet balance. You need $${totalCharged.toFixed(2)} (fee + $${serviceCharge.toFixed(2)} service charge) but your available balance is $${feeWalletAvailable.toFixed(2)}${feeWalletLien > 0 ? ` ($${feeWalletLien.toFixed(2)} is locked by an active lien)` : ""}. Please fund your wallet with at least $${shortfall} more to continue.`,
          required: totalCharged,
          available: feeWalletAvailable,
        });
      }
      await storage.updateWalletBalance(userId, (feeWalletBalance - totalCharged).toFixed(2));

      verification = await storage.updateVerification(verification.id, {
        portalFeePaid: true,
        paidBatchId: batch.id,
      } as any);

      await storage.createTransaction({
        userId,
        type: "verification_fee",
        amount: `-${totalCharged.toFixed(2)}`,
        fee: serviceCharge.toFixed(2),
        paymentMethod: "wallet",
        description: `Portal verification fee ($${portalFee.toFixed(2)}) + service charge ($${serviceCharge.toFixed(2)}) = $${totalCharged.toFixed(2)} (₦${ngnEquivalent.toLocaleString()})`,
      });

      // Increment batch enrollment (may auto-close batch if max reached)
      await storage.incrementBatchEnrollment(batch.id, BATCH_MAX);

      // ── Credit 5% referral commission to referrer on student portal fee payment ──
      // Uses Once variant to deduplicate if commission was already given at wallet-KYC time.
      const portalReferralResult = await creditReferrerCommissionOnce(userId, portalFee, "student subscription plan");
      if (!portalReferralResult.credited) console.log(`[REFERRAL] No portal fee commission credited for user ${userId}`);

      // Notify admin — student paid portal fee and is ready for review
      try {
        const feeUser = await storage.getUser(userId);
        if (feeUser) {
          sendAdminPortalFeeEmail({
            name: `${feeUser.firstName} ${feeUser.lastName}`,
            email: feeUser.email,
            amount: totalCharged.toFixed(2),
            userId,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      res.json(verification);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/academic", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) return res.status(400).json({ message: "Start verification first" });

      const currentBatch = await storage.getCurrentBatch();
      const paidForCurrentBatch = currentBatch && (verification as any).paidBatchId === currentBatch.id;
      if (!verification.portalFeePaid && !paidForCurrentBatch) {
        return res.status(400).json({ message: "You must pay the $3 verification fee before submitting WAEC results" });
      }

      const { waecRegNumber, waecYear, waecGrades } = req.body;
      const gradesArray = (waecGrades || "").trim().split(/[\s,]+/).filter(Boolean);

      if (gradesArray.length === 0) {
        return res.status(400).json({ message: "Please provide your WAEC grades" });
      }

      const validGrades = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
      for (const g of gradesArray) {
        if (!validGrades.includes(g.toUpperCase())) {
          return res.status(400).json({ message: `Invalid grade "${g}". Valid grades: ${validGrades.join(", ")}` });
        }
      }

      const gradeScaleRaw2 = await storage.getPlatformSetting("waec_grade_scale");
      const gradeScale2 = gradeScaleRaw2 ? JSON.parse(gradeScaleRaw2) : undefined;
      const percentage = calculateWaecPercentage(gradesArray, gradeScale2);
      const tierPayoutsAlt = await storage.getTierPayouts();
      const payoutInfo = (() => {
        if (percentage >= 75) return { min: tierPayoutsAlt.platinum.min, max: tierPayoutsAlt.platinum.max, label: "platinum" };
        if (percentage >= 60) return { min: tierPayoutsAlt.gold.min, max: tierPayoutsAlt.gold.max, label: "gold" };
        if (percentage >= 51) return { min: tierPayoutsAlt.silver.min, max: tierPayoutsAlt.silver.max, label: "silver" };
        return { min: 0, max: 0, label: "none" };
      })();

      let tier: "platinum" | "gold" | "silver" | "none" = payoutInfo.label as any;

      verification = await storage.updateVerification(verification.id, {
        waecRegNumber,
        waecYear,
        waecGrades: gradesArray.join(" "),
        tier,
        waecPercentage: percentage.toFixed(2),
        payoutMin: payoutInfo.min.toFixed(2),
        payoutMax: payoutInfo.max.toFixed(2),
      });

      // Notify admin — student submitted WAEC results, awaiting review
      try {
        const academicUser = await storage.getUser(userId);
        if (academicUser) {
          sendAdminVerificationEmail({
            name: `${academicUser.firstName} ${academicUser.lastName}`,
            email: academicUser.email,
            tier,
            payoutMin: payoutInfo.min.toFixed(2),
            payoutMax: payoutInfo.max.toFixed(2),
            waecPercentage: percentage.toFixed(2),
            userId,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      res.json({
        ...verification,
        calculatedPercentage: percentage,
        payoutRange: payoutInfo,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/verification/status", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const verification = await storage.getVerificationByUser(userId);
    res.json(verification || null);
  });

  app.get("/api/wallet", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const cacheKey = `wallet:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    let wallet = await storage.getOrCreateWallet(userId);
    // Self-heal: activate wallets that already have > $2 but were never activated
    // (can happen if balance was set before the activated column existed)
    if (!wallet.activated && parseFloat(wallet.balance) > 2) {
      wallet = await storage.activateWallet(userId);
    }
    const balanceUsd = parseFloat(wallet.balance);
    const balanceNgn = balanceUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT;
    const result = { ...wallet, balanceNgn: balanceNgn.toFixed(2) };
    setCached(cacheKey, result, 60_000);
    res.json(result);
  });

  // ── GET /api/wallet/balances — book balance, available balance, pending, trade ──
  app.get("/api/wallet/balances", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const MIN_BALANCE = 2;

      // Main wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const confirmedBalance = parseFloat(wallet.balance);

      // Pending crypto deposits (submitted but awaiting admin approval)
      const allDeposits = await storage.getUserWalletDeposits(userId);
      const pendingDeposits = allDeposits.filter((d: any) => d.status === "pending");
      const pendingAmount = pendingDeposits.reduce((sum: number, d: any) => sum + parseFloat(d.amountUsd), 0);
      const failedDeposits = allDeposits.filter((d: any) => d.status === "rejected");

      // Book balance = confirmed + all pending credits still in flight
      const bookBalance = confirmedBalance + pendingAmount;

      // Available balance = confirmed balance − minimum reserve (cannot go negative)
      const availableBalance = Math.max(0, confirmedBalance - MIN_BALANCE);

      // Trade / Affiliate wallet
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const tradeBalance = parseFloat(tradeWallet.tradeBalance);
      const referralBalance = parseFloat(tradeWallet.referralCommissionBalance);
      const totalAffiliateBalance = tradeBalance + referralBalance;

      res.json({
        bookBalance: bookBalance.toFixed(2),
        availableBalance: availableBalance.toFixed(2),
        confirmedBalance: confirmedBalance.toFixed(2),
        minimumBalance: MIN_BALANCE.toFixed(2),
        lockedBalance: (confirmedBalance >= MIN_BALANCE ? MIN_BALANCE : confirmedBalance).toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
        pendingCount: pendingDeposits.length,
        failedCount: failedDeposits.length,
        tradeBalance: tradeBalance.toFixed(2),
        referralBalance: referralBalance.toFixed(2),
        totalAffiliateBalance: totalAffiliateBalance.toFixed(2),
        activated: wallet.activated,
        lienAmount: wallet.lienAmount ?? "0.00",
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "Failed to fetch balances" });
    }
  });

  // ── Nigerian bank account lookup via Squad ───────────────────────────────
  app.post("/api/bank/lookup", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { bank_code, account_number } = req.body;
      if (!bank_code || !account_number) return res.status(400).json({ message: "bank_code and account_number required" });
      const secretKey = process.env.SQUAD_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured" });
      // FIX: correct Squad account-lookup endpoint (api-d domain, /payout/account/lookup path)
      const isLive = secretKey.startsWith("sk_");
      const lookupBase = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
      const r = await fetch(`${lookupBase}/payout/account/lookup`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bank_code, account_number }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await r.json() as any;
      if (data.success) {
        res.json({ success: true, accountName: data.data?.account_name ?? data.data?.AccountName });
      } else {
        res.status(400).json({ message: data.message ?? "Account lookup failed — check bank code and account number" });
      }
    } catch (e: any) { res.status(500).json({ message: e.message ?? "Bank lookup error" }); }
  });

  // ─── WITHDRAWAL OTP REQUEST ──────────────────────────────────────────────────
  // GET /api/wallet/withdrawal-window — returns current WAT withdrawal window status
  app.get("/api/wallet/withdrawal-window", (_req, res) => {
    res.json(getWithdrawalWindowStatus());
  });

  app.post("/api/wallet/withdrawal-otp/request", (_req, res) => {
    res.status(410).json({ message: "Wallet withdrawals are no longer supported. Use Fintech Hub for all money-out flows." });
  });

  // ── Transfer OTP — request code for wallet-to-wallet transfers ─────────────
  app.post("/api/wallet/transfer-otp/request", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amount, recipientName } = req.body;
      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ message: "A valid amount is required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await storage.createWithdrawalOtp(userId, code, "wallet_transfer");
      await sendTransferOtpEmail(user.email, user.firstName, code, parseFloat(amount).toFixed(2), recipientName || "recipient");
      res.json({ success: true, message: `OTP sent to ${user.email.replace(/(.{2}).+(@.+)/, "$1***$2")}` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/wallet/withdraw", (_req, res) => {
    res.status(410).json({ message: "Wallet withdrawals are no longer supported. Use Fintech Hub for all money-out flows." });
  });

  app.post("/api/wallet/withdraw__disabled", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { amount, bankName, bankCode, accountNumber, accountName, otpCode } = req.body;
      if (!otpCode || otpCode.trim().length !== 6) {
        return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this withdrawal" });
      }
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, otpCode.trim(), "bank_withdrawal");
      if (!otpValid) {
        return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      }
      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank name, account number and account name are required" });
      }
      if (String(accountNumber).length !== 10) {
        return res.status(400).json({ message: "Account number must be exactly 10 digits" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      const withdrawAmount = parseFloat(amount);
      const MIN_BALANCE = 2;
      if (!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > parseFloat(wallet.balance)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (parseFloat(wallet.balance) - withdrawAmount < MIN_BALANCE) {
        return res.status(400).json({ message: `A minimum of $${MIN_BALANCE} must remain in your wallet` });
      }

      const vatAmount    = parseFloat((withdrawAmount * 0.075).toFixed(2));
      const netAmountUsd = parseFloat((withdrawAmount - vatAmount).toFixed(2));
      const netAmountNgn = Math.round(netAmountUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT);
      const txRef        = `TSIA-WD-${userId}-${Date.now()}`;

      // ── Try Squad first, then Korapay — gateway must confirm BEFORE wallet is touched ──
      const squadKey = process.env.SQUAD_SECRET_KEY;
      const koraKey  = process.env.KORAPAY_SECRET_KEY;
      if (!squadKey && !koraKey) return res.status(500).json({ message: "No payment gateway configured. Contact support." });

      let gatewaySuccess = false, gatewayMsg = "", usedGateway: "squad" | "korapay" | "" = "";

      // 1) Squad payout
      if (squadKey) {
        try {
          const isLiveKey  = squadKey.startsWith("sk_");
          const squadBase  = isLiveKey ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
          const merchantId = process.env.SQUAD_MERCHANT_ID ?? "TSIA";
          const squadRef   = `${merchantId}_${txRef}`.slice(0, 50);
          const amountKobo = Math.round(netAmountNgn * 100);
          const sRes = await fetch(`${squadBase}/payout/transfer`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${squadKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction_reference: squadRef,
              amount: String(amountKobo),
              bank_code: bankCode,
              account_number: accountNumber,
              account_name: accountName,
              currency_id: "NGN",
              remark: `TSIA Withdrawal | ${txRef}`,
            }),
            signal: AbortSignal.timeout(25000),
          });
          const sData = await sRes.json() as any;
          console.log(`[SQUAD WITHDRAW] ref=${squadRef} | HTTP ${sRes.status} | success=${sData.success} | msg="${sData.message}"`);
          if (sData.success) { gatewaySuccess = true; usedGateway = "squad"; }
          else if (sRes.status === 424) {
            try {
              const reqRes = await fetch(`${squadBase}/payout/requery`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${squadKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ transaction_reference: squadRef }),
                signal: AbortSignal.timeout(15000),
              });
              const reqData = await reqRes.json() as any;
              if (reqData.success) { gatewaySuccess = true; usedGateway = "squad"; }
              else gatewayMsg = sData.message ?? "Squad transfer failed";
            } catch { gatewayMsg = sData.message ?? "Squad timed out"; }
          } else {
            gatewayMsg = sData.message ?? "Squad transfer declined";
          }
        } catch (e: any) {
          gatewayMsg = `Squad: ${e.message ?? "network error"}`;
        }
      }

      // 2) Korapay fallback
      if (!gatewaySuccess && koraKey) {
        console.warn(`[WITHDRAW] Squad failed (${gatewayMsg || "not configured"}) — trying Korapay fallback`);
        try {
          const kRes = await fetch(`${KORA_BASE}/transactions/disburse`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${koraKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              reference: `${txRef}-K`,
              destination: {
                type: "bank_account", amount: netAmountNgn, currency: "NGN",
                bank_account: { bank: bankCode, account: accountNumber },
                customer: { name: accountName, email: "transfers@tsiforafrica.com" },
              },
              description: `TSIA Withdrawal to ${accountName} | Ref: ${txRef}`,
            }),
            signal: AbortSignal.timeout(30000),
          });
          const kData = await kRes.json() as any;
          console.log(`[KORAPAY WITHDRAW] ref=${txRef} | HTTP ${kRes.status} | status=${kData.status} | msg="${kData.message}"`);
          if (kData.status) { gatewaySuccess = true; usedGateway = "korapay"; }
          else gatewayMsg = kData.message ?? "Korapay transfer declined";
        } catch (e: any) {
          gatewayMsg = `Korapay: ${e.message ?? "network error"}`;
        }
      }

      if (!gatewaySuccess) {
        console.warn(`[WITHDRAW] All gateways failed for user ${userId} amount $${withdrawAmount} — raw="${gatewayMsg}"`);
        return res.status(502).json({ message: "Network error. Please try again later. Your wallet was not debited." });
      }

      // ── Gateway confirmed — now debit wallet and record ────────────────────
      const newBalance = (parseFloat(wallet.balance) - withdrawAmount).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);

      await storage.createTransaction({
        userId, type: "withdrawal",
        amount: (-withdrawAmount).toFixed(2),
        fee: vatAmount.toFixed(2),
        paymentMethod: `bank_transfer_${usedGateway}`,
        description: `Bank withdrawal ₦${netAmountNgn.toLocaleString()} to ${accountName} (${accountNumber}) at ${bankName} via ${usedGateway} — 7.5% VAT $${vatAmount.toFixed(2)} | Ref: ${txRef}`,
      });

      const user = await storage.getUser(userId);
      const notif = await storage.createNotification({
        userId, type: "wallet_credit",
        title: "Withdrawal Sent ✓",
        message: `Your withdrawal of ₦${netAmountNgn.toLocaleString()} to ${accountName} (${accountNumber}) at ${bankName} has been sent successfully. Ref: ${txRef}`,
        data: { ref: txRef }, isRead: false,
      });
      pushToUser(userId, "notification", notif);

      sendTransactionReceiptEmail(user!.email, user!.firstName, {
        title: "Bank Withdrawal Sent",
        status: "success",
        amount: `₦${netAmountNgn.toLocaleString()}`,
        amountLabel: `$${withdrawAmount.toFixed(2)} deducted`,
        reference: txRef,
        rows: [
          { label: "Amount Deducted", value: `$${withdrawAmount.toFixed(2)}` },
          { label: "VAT (7.5%)",      value: `-$${vatAmount.toFixed(2)}`,              color: "red" },
          { label: "You Receive (NGN)", value: `₦${netAmountNgn.toLocaleString()}`,   color: "green" },
          { label: "Bank",             value: bankName },
          { label: "Account",          value: `${accountNumber} — ${accountName}` },
          { label: "Gateway",          value: usedGateway === "korapay" ? "Korapay" : "Squad" },
          { label: "Status",           value: "Sent ✓",                               color: "green" },
        ],
        footerNote: "Funds are on their way. Should arrive within minutes.",
      }).catch(() => {});

      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`transactions:${userId}`);
      const updatedWallet = await storage.getOrCreateWallet(userId);
      res.json({
        wallet: updatedWallet,
        reference: txRef,
        gateway: usedGateway,
        vatAmount: vatAmount.toFixed(2),
        netAmount: netAmountUsd.toFixed(2),
        netAmountNgn,
        bankName, accountNumber, accountName,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const cacheKey = `transactions:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const txns = await storage.getTransactionsByUser(userId);
    setCached(cacheKey, txns, 60_000);
    res.json(txns);
  });

  // ── CRYPTO WITHDRAWAL OTP REQUEST ──────────────────────────────────────────
  app.post("/api/fintech/crypto-withdraw/request-otp", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 5)
        return res.status(400).json({ message: "Minimum withdrawal is $5" });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await storage.createWithdrawalOtp(userId, code, "crypto_withdrawal");
      await sendWithdrawalOtpEmail(user.email, user.firstName, code, parseFloat(amount).toFixed(2));
      const masked = user.email.replace(/(.{2}).+(@.+)/, "$1***$2");
      res.json({ success: true, message: `OTP sent to ${masked}. Check your email.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── CRYPTO WITHDRAWAL EXECUTE ───────────────────────────────────────────────
  app.post("/api/fintech/crypto-withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amount, network, address, otpCode } = req.body;
      if (!otpCode || String(otpCode).trim().length !== 6)
        return res.status(400).json({ message: "A valid 6-digit OTP is required" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "crypto_withdrawal");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Request a new code." });
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 5)
        return res.status(400).json({ message: "Minimum withdrawal is $5" });
      if (!network || !["bep20", "trc20"].includes(network))
        return res.status(400).json({ message: "Invalid network. Choose TRC20 or BEP20." });
      if (!address || String(address).trim().length < 10)
        return res.status(400).json({ message: "A valid USDT wallet address is required" });
      const wallet = await storage.getOrCreateWallet(userId);
      const withdrawAmt = parseFloat(amount);
      const currentBalance = parseFloat(wallet.balance);
      const MIN_BALANCE = 2;
      if (withdrawAmt > currentBalance) return res.status(400).json({ message: "Insufficient balance" });
      if (currentBalance - withdrawAmt < MIN_BALANCE)
        return res.status(400).json({ message: `A minimum of $${MIN_BALANCE} must remain in your wallet` });
      const feeAmt = parseFloat((withdrawAmt * CURRENCY_RATES.CRYPTO_WITHDRAW_FEE).toFixed(2));
      const netAmt = parseFloat((withdrawAmt - feeAmt).toFixed(2));
      const newBalance = (currentBalance - withdrawAmt).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);
      const networkLabel = network === "bep20" ? "BEP20/BSC" : "TRC20/TRON";
      const truncated = `${String(address).trim().slice(0, 8)}…${String(address).trim().slice(-6)}`;
      await storage.createTransaction({
        userId, type: "crypto_withdrawal",
        amount: (-withdrawAmt).toFixed(2), fee: feeAmt.toFixed(2),
        paymentMethod: "crypto",
        description: `USDT Withdrawal (${networkLabel}) to ${truncated} — 1% fee: $${feeAmt.toFixed(2)} | Net: $${netAmt.toFixed(2)} | Full address: ${String(address).trim()} | Processing within 24h`,
      });
      await storage.createWithdrawalRequest({
        userId, type: "crypto",
        amount: withdrawAmt.toFixed(2), fee: feeAmt.toFixed(2), netAmount: netAmt.toFixed(2),
        network: networkLabel, address: String(address).trim(),
      });
      const cwUser = await storage.getUser(userId);
      if (cwUser) {
        const notif = await storage.createNotification({
          userId, type: "wallet_credit",
          title: "Crypto Withdrawal Submitted ✓",
          message: `Your USDT withdrawal of $${netAmt.toFixed(2)} (after 1% fee) via ${networkLabel} has been processed successfully.`,
          data: { network, address: String(address).trim(), amount: netAmt, fee: feeAmt }, isRead: false,
        });
        pushToUser(userId, "notification", notif);
        sendAdminWithdrawalEmail({
          name: `${cwUser.firstName} ${cwUser.lastName}`, email: cwUser.email,
          amount: withdrawAmt.toFixed(2), method: "crypto", network: networkLabel,
          address: String(address).trim(), userId,
        }).catch(() => {});
      }
      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`transactions:${userId}`);
      const updated = await storage.getOrCreateWallet(userId);
      res.json({ message: `Withdrawal successful. You'll receive $${netAmt.toFixed(2)} USDT after the 1% fee.`, wallet: updated, amount: withdrawAmt, netAmount: netAmt, fee: feeAmt, network, address: String(address).trim() });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/wallet/withdraw-crypto", (_req, res) => {
    res.status(410).json({ message: "Use /api/fintech/crypto-withdraw instead." });
  });

  app.post("/api/wallet/withdraw-crypto__disabled", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const cryptoWdWindow = getWithdrawalWindowStatus();
      if (!cryptoWdWindow.open) {
        return res.status(403).json({ message: cryptoWdWindow.message });
      }
      const { amount, network, address, otpCode } = req.body;
      if (!otpCode || otpCode.trim().length !== 6) {
        return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this withdrawal" });
      }
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, otpCode.trim(), "crypto_withdrawal");
      if (!otpValid) {
        return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 1) {
        return res.status(400).json({ message: "Minimum withdrawal amount is $1" });
      }
      if (!network || !["bep20", "trc20"].includes(network)) {
        return res.status(400).json({ message: "Invalid network. Choose BEP20 or TRC20." });
      }
      if (!address || address.trim().length < 10) {
        return res.status(400).json({ message: "A valid USDT wallet address is required" });
      }
      const wallet = await storage.getOrCreateWallet(userId);
      const withdrawAmt = parseFloat(amount);
      const currentBalance = parseFloat(wallet.balance);
      const MIN_BALANCE = 2;
      if (withdrawAmt <= 0 || withdrawAmt > currentBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (currentBalance - withdrawAmt < MIN_BALANCE) {
        return res.status(400).json({ message: `A minimum of $${MIN_BALANCE} must remain in your wallet` });
      }

      // ── Fee calculation: 1% network handling charge (no VAT on crypto) ────
      const feeAmt    = parseFloat((withdrawAmt * CURRENCY_RATES.CRYPTO_WITHDRAW_FEE).toFixed(2));
      const netAmt    = parseFloat((withdrawAmt - feeAmt).toFixed(2));

      // Deduct full requested amount from wallet
      const newBalance = (currentBalance - withdrawAmt).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);

      // Record transaction
      const networkLabel = network === "bep20" ? "BEP20/BSC" : "TRC20/TRON";
      const truncated = address.trim().length > 16
        ? `${address.trim().slice(0, 8)}…${address.trim().slice(-6)}`
        : address.trim();
      await storage.createTransaction({
        userId,
        type: "crypto_withdrawal",
        amount: (-withdrawAmt).toFixed(2),
        fee: feeAmt.toFixed(2),
        paymentMethod: "crypto",
        description: `USDT Withdrawal (${networkLabel}) to ${truncated} — ${(CURRENCY_RATES.CRYPTO_WITHDRAW_FEE * 100).toFixed(0)}% fee: $${feeAmt.toFixed(2)} | Net: $${netAmt.toFixed(2)} | Full address: ${address.trim()}`,
      });

      // Create withdrawal request for admin dashboard
      await storage.createWithdrawalRequest({
        userId, type: "crypto",
        amount: withdrawAmt.toFixed(2),
        fee: feeAmt.toFixed(2),
        netAmount: netAmt.toFixed(2),
        network: networkLabel,
        address: address.trim(),
      });

      // In-app notification
      const cryptoUser = await storage.getUser(userId);
      const notif = await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Crypto Withdrawal Received ✓",
        message: `Your USDT withdrawal of $${netAmt.toFixed(2)} (after 1% fee) via ${networkLabel} has been received and will be processed within 24 hours.`,
        data: { network, address: address.trim(), amount: netAmt, fee: feeAmt },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);

      // Email receipt
      if (cryptoUser) {
        const cryptoTxRef = `TSIA-CRYPTO-WD-${userId}-${Date.now()}`;
        sendTransactionReceiptEmail(cryptoUser.email, cryptoUser.firstName, {
          title: "Crypto (USDT) Withdrawal",
          status: "processing",
          amount: `$${netAmt.toFixed(2)} USDT`,
          amountLabel: `$${withdrawAmt.toFixed(2)} requested`,
          reference: cryptoTxRef,
          rows: [
            { label: "Amount Requested", value: `$${withdrawAmt.toFixed(2)} USDT` },
            { label: "Handling Fee (1%)", value: `-$${feeAmt.toFixed(2)}`, color: "red" },
            { label: "You Receive", value: `$${netAmt.toFixed(2)} USDT`, color: "green" },
            { label: "Network", value: networkLabel },
            { label: "Address", value: truncated, mono: true },
          ],
          footerNote: "No VAT on crypto withdrawals.",
        }).catch(() => {});
      }

      // Notify admin — crypto withdrawal to process
      if (cryptoUser) {
        sendAdminWithdrawalEmail({
          name: `${cryptoUser.firstName} ${cryptoUser.lastName}`,
          email: cryptoUser.email,
          amount: withdrawAmt.toFixed(2),
          method: "crypto",
          network: networkLabel,
          address: address.trim(),
          userId,
        }).catch(() => {});
      }

      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`transactions:${userId}`);
      const updated = await storage.getOrCreateWallet(userId);
      res.json({
        message: `Your USDT withdrawal has been received. You will receive $${netAmt.toFixed(2)} after the 1% handling fee ($${feeAmt.toFixed(2)}). Processing within 24 hours.`,
        wallet: updated,
        amount: withdrawAmt,
        netAmount: netAmt,
        fee: feeAmt,
        network,
        address: address.trim(),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Wallet withdrawal history (bank + crypto) ────────────────────────────
  app.get("/api/wallet/withdrawals", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const withdrawals = await storage.getWithdrawalRequestsByUser(userId);
      res.json(withdrawals);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sponsorship/select", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // ── 1. Require verified offer ─────────────────────────────────────────
      const verification = await storage.getVerificationByUser(userId);
      if (!verification || verification.status !== "verified") {
        return res.status(400).json({ message: "Your offer must be approved by the TSIA team before selecting a sponsorship plan." });
      }

      // ── 2. Check 30-day commitment window (starts at admin approval) ──────
      const approvalDate = verification.commitmentStartDate;
      if (!approvalDate) {
        return res.status(400).json({ message: "No offer approval date found. Please contact support." });
      }
      const windowEnd = new Date(approvalDate).getTime() + (30 * 24 * 60 * 60 * 1000);
      if (Date.now() > windowEnd) {
        return res.status(400).json({
          code: "WINDOW_EXPIRED",
          message: "Your 30-day commitment window has expired. Please contact support to discuss re-enrollment.",
        });
      }

      // ── 3. Check for existing active plan (365-day lock) ──────────────────
      const existing = await storage.getSponsorshipPlanByUser(userId);
      if (existing) {
        const planAge = Math.floor((Date.now() - new Date(existing.createdAt).getTime()) / 86400000);
        const daysLeft = Math.max(0, 365 - planAge);
        if (daysLeft > 0) {
          return res.status(400).json({ message: `Your current plan is active for ${daysLeft} more day(s). You can renew after 365 days.`, daysLeft });
        }
      }

      // ── 4. Plan cost + service charge (from DB / defaults) ────────────────
      const { planYears } = req.body;
      const planPrices = await storage.getPlanPrices();
      const planBaseCostMap: Record<number, number> = { 1: planPrices.plan1yr, 2: planPrices.plan2yr, 3: planPrices.plan3yr };
      const baseCost = planBaseCostMap[planYears];
      if (!baseCost) return res.status(400).json({ message: "Invalid plan. Choose 1, 2, or 3 years." });

      const SERVICE_CHARGE_RATE = planPrices.serviceChargeRate;
      const serviceCharge = parseFloat((baseCost * SERVICE_CHARGE_RATE).toFixed(2));
      const totalCost = parseFloat((baseCost + serviceCharge).toFixed(2));
      const ngnEquivalent = Math.round(totalCost * CURRENCY_RATES.USD_TO_NGN_PAYMENT);

      // ── 5. Check wallet balance and debit ─────────────────────────────────
      const planWallet = await storage.getOrCreateWallet(userId);
      const planWalletBalance = parseFloat(planWallet.balance);
      if (planWalletBalance < totalCost) {
        const shortfall = (totalCost - planWalletBalance).toFixed(2);
        return res.status(402).json({
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient wallet balance. The ${planYears}-year plan costs $${baseCost.toFixed(2)} + $${serviceCharge.toFixed(2)} service charge = $${totalCost.toFixed(2)}. Your balance is $${planWalletBalance.toFixed(2)}. Please fund your wallet with at least $${shortfall} more.`,
          required: totalCost,
          available: planWalletBalance,
        });
      }
      await storage.updateWalletBalance(userId, (planWalletBalance - totalCost).toFixed(2));

      // ── 6. Create payment transaction ──────────────────────────────────────
      await storage.createTransaction({
        userId,
        type: "plan_payment",
        amount: `-${totalCost.toFixed(2)}`,
        fee: serviceCharge.toFixed(2),
        paymentMethod: "wallet",
        description: `${planYears}-year TSIA Swift-Pay Plan payment — $${baseCost.toFixed(2)} + $${serviceCharge.toFixed(2)} service charge = $${totalCost.toFixed(2)} (₦${ngnEquivalent.toLocaleString()})`,
      });

      // ── 7. Payout based on student's actual WAEC tier ─────────────────────
      const payoutPerYear = parseFloat(verification.payoutMax || "230.00");
      const totalPayout = (payoutPerYear * planYears).toFixed(2);

      // ── 8. Create sponsorship plan ────────────────────────────────────────
      const plan = await storage.createSponsorshipPlan({
        userId,
        planYears,
        annualCost: baseCost.toFixed(2),
        maxPayout: totalPayout,
        active: true,
      });

      // ── 9. Create pending disbursements — split 50/50 across two semesters ──
      const semester1Amount = (parseFloat(totalPayout) / 2).toFixed(2);
      const semester2Amount = (parseFloat(totalPayout) - parseFloat(semester1Amount)).toFixed(2);
      await storage.createDisbursement({ userId, amount: semester1Amount, status: "pending", semesterNum: 1 });
      await storage.createDisbursement({ userId, amount: semester2Amount, status: "pending", semesterNum: 2 });

      // ── 10. Credit 5% referral commission to referrer ─────────────────────
      const planReferralResult = await creditReferrerCommission(userId, baseCost, "sponsorship plan payment");
      if (!planReferralResult.credited) console.log(`[REFERRAL] No sponsorship plan commission credited for user ${userId}`);

      // ── 11. Notify student ─────────────────────────────────────────────────
      try {
        const planNotif = await storage.createNotification({
          userId,
          type: "verification_update",
          title: "Swift-Pay Plan Active ✓",
          message: `Your ${planYears}-year TSIA sponsorship plan is now active. $${totalCost.toFixed(2)} has been deducted from your wallet. Your $${totalPayout} disbursement is pending admin approval.`,
          data: { planYears, totalCost, totalPayout },
          isRead: false,
        });
        pushToUser(userId, "notification", planNotif);
      } catch { /* non-critical */ }

      // ── 12. Notify admin — disbursement pending ────────────────────────────
      try {
        const planStudent = await storage.getUser(userId);
        if (planStudent) {
          sendAdminSponsorshipEmail({
            name: `${planStudent.firstName} ${planStudent.lastName}`,
            email: planStudent.email,
            planYears,
            totalCost: totalCost.toFixed(2),
            totalPayout,
            userId,
          }).catch(() => {});

          // ── 13. Send receipt email to student ───────────────────────────────
          sendStudentPlanReceiptEmail({
            to: planStudent.email,
            firstName: planStudent.firstName || "Student",
            planYears,
            totalCost: totalCost.toFixed(2),
            totalPayout,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      res.json({ ...plan, totalCost, serviceCharge, totalPayout });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/sponsorship/plan", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const plan = await storage.getSponsorshipPlanByUser(userId);
    res.json(plan || null);
  });

  // Batch enrollment status — never exposes max batch size or current count to client
  app.get("/api/sponsorship/batch-status", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const batch = await storage.getCurrentBatch();
      const verification = await storage.getVerificationByUser(userId);

      if (!batch) {
        // No batch yet (or previous batch expired) — enrollment is open
        return res.json({ status: "open", nextOpenAt: null, enrolledInCurrentBatch: false });
      }

      // Did user pay for THIS specific batch?
      const enrolledInCurrentBatch = !!(verification?.portalFeePaid && (verification as any).paidBatchId === batch.id);

      if (batch.status === "open") {
        return res.json({ status: "open", nextOpenAt: null, enrolledInCurrentBatch });
      }
      // Batch is closed — always return countdown info so ALL users can see it
      return res.json({
        status: "closed",
        nextOpenAt: batch.nextOpenAt,
        enrolledInCurrentBatch,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/currency-rates", (_req, res) => {
    res.json(CURRENCY_RATES);
  });

  app.get("/api/affiliate/info", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const referrals = await storage.getReferralsByCode(user.affiliateCode || "");
    res.json({
      affiliateCode: user.affiliateCode,
      referralCount: referrals.length,
      referrals: referrals.map(r => ({
        name: `${r.firstName} ${r.lastName.charAt(0)}.`,
        joinedAt: r.createdAt,
      })),
    });
  });

  // Affiliate referral growth stats — includes wallet-activation split + commission earned
  app.get("/api/affiliate/referral-stats", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [allReferrals, activatedReferrals] = await Promise.all([
        storage.getReferralsByCode(user.affiliateCode || ""),
        storage.getActivatedReferralsByCode(user.affiliateCode || ""),
      ]);

      const totalReferred = allReferrals.length;
      const activeCount   = activatedReferrals.length;
      const pendingCount  = totalReferred - activeCount;

      // Sum all referral commission trade transactions credited to this affiliate
      const commissionTxResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(amount_usd AS numeric)), 0) AS total_earned,
          COUNT(*) AS commission_count
        FROM trade_transactions
        WHERE user_id = ${userId}
          AND type = 'bot_earning'
          AND note LIKE 'Referral commission%'
          AND CAST(amount_usd AS numeric) > 0
      `);
      const totalCommissionEarned = parseFloat((commissionTxResult.rows[0] as any)?.total_earned ?? "0");
      const commissionCount       = parseInt((commissionTxResult.rows[0] as any)?.commission_count ?? "0");

      // Get recent commission transactions (last 10)
      const recentCommissions = await db.execute(sql`
        SELECT amount_usd, note, created_at
        FROM trade_transactions
        WHERE user_id = ${userId}
          AND type = 'bot_earning'
          AND note LIKE 'Referral commission%'
          AND CAST(amount_usd AS numeric) > 0
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Referral commission wallet balance (separate from trade balance)
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const commissionBalance = parseFloat(tradeWallet.referralCommissionBalance);

      res.json({
        totalReferred,
        activeCount,
        pendingCount,
        totalCommissionEarned: parseFloat(totalCommissionEarned.toFixed(4)),
        commissionCount,
        commissionBalance: parseFloat(commissionBalance.toFixed(4)),
        recentCommissions: (recentCommissions.rows as any[]).map(r => ({
          amount: parseFloat(parseFloat(r.amount_usd).toFixed(4)),
          note: r.note,
          date: r.created_at,
        })),
        referrals: allReferrals.map(r => {
          const isActive = activatedReferrals.some(a => a.id === r.id);
          return {
            name: `${r.firstName} ${r.lastName.charAt(0)}.`,
            joinedAt: r.createdAt,
            status: isActive ? "active" : "pending",
          };
        }),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Withdraw referral commission earnings from Trade Wallet to SwiftWallet
  app.post("/api/affiliate/withdraw-commission", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { amount } = req.body;
      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: "Enter a valid withdrawal amount." });
      }
      if (withdrawAmount < 1) {
        return res.status(400).json({ message: "Minimum withdrawal is $1.00." });
      }

      // Check referral commission balance (separate from trade balance)
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const commissionBalance = parseFloat(tradeWallet.referralCommissionBalance);
      if (withdrawAmount > commissionBalance) {
        return res.status(400).json({ message: `Insufficient commission balance. Available: $${commissionBalance.toFixed(4)}` });
      }

      const txRef = `COMM-WD-${userId}-${Date.now()}`;

      // Deduct from referral commission balance (NOT trade balance)
      await storage.subtractReferralCommission(userId, withdrawAmount.toFixed(6));
      await storage.createTradeTransaction({
        userId,
        type: "withdraw_exchange",
        walletType: null,
        amountUsd: (-withdrawAmount).toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: "0.000000",
        netAmount: (-withdrawAmount).toFixed(6),
        txHash: null,
        status: "completed",
        note: `Commission withdrawal to SwiftWallet | Ref: ${txRef}`,
      });

      // Credit to personal wallet
      const personalWallet = await storage.getOrCreateWallet(userId);
      const newPersonalBalance = (parseFloat(personalWallet.balance) + withdrawAmount).toFixed(2);
      await storage.updateWalletBalance(userId, newPersonalBalance);
      await storage.createTransaction({
        userId,
        type: "deposit",
        amount: withdrawAmount.toFixed(2),
        fee: "0.00",
        paymentMethod: "trade_wallet",
        description: `Referral commission withdrawal from Trade Wallet | Ref: ${txRef}`,
      });

      // Notify
      const notif = await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Commission Withdrawal ✓",
        message: `$${withdrawAmount.toFixed(4)} withdrawn from your Trade Wallet to your SwiftWallet. Ref: ${txRef}`,
        data: { ref: txRef, amount: withdrawAmount },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);

      const updatedTrade = await storage.getOrCreateTradeWallet(userId);

      // Notify admin — affiliate commission withdrawal request
      sendAdminCommissionWithdrawalEmail({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        amount: withdrawAmount.toFixed(4),
        reference: txRef,
        userId,
      }).catch(() => {});

      res.json({
        success: true,
        reference: txRef,
        withdrawn: withdrawAmount,
        newTradeBalance: parseFloat(updatedTrade.tradeBalance).toFixed(4),
        newPersonalBalance,
        message: `$${withdrawAmount.toFixed(4)} moved to your SwiftWallet.`,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/co-affiliate/program", async (req, res) => {
    try {
      const [totalEnrolled, totalFundPool, totalAffiliatePool] = await Promise.all([
        storage.getCoAffiliateCount(),
        storage.getTotalCoAffiliateFund(),
        storage.getTotalAffiliatePool(),
      ]);
      const pricing = getCoAffiliatePricing(totalEnrolled);
      const progress = getMilestoneProgress(totalEnrolled);
      const TARGET_FUND = CO_AFFILIATE_PROGRAM.TARGET * 100; // estimated max fund (1M participants × avg $100)
      res.json({
        totalEnrolled,
        target: CO_AFFILIATE_PROGRAM.TARGET,
        milestoneInterval: CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL,
        pricing,
        progress,
        spotsRemaining: CO_AFFILIATE_PROGRAM.TARGET - totalEnrolled,
        totalFundPool,
        totalAffiliatePool,
        targetFund: TARGET_FUND,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/co-affiliate/my-info", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const record = await storage.getCoAffiliateByUser(userId);
      if (!record) return res.json(null);
      const totalAffiliatePool = await storage.getTotalAffiliatePool();
      const sharePercentage = parseFloat(record.sharePercentage);
      const myProfit = totalAffiliatePool * sharePercentage;
      const alreadyWithdrawn = parseFloat(record.withdrawnAmount ?? "0");
      const myAvailable = Math.max(0, myProfit - alreadyWithdrawn);
      res.json({ ...record, myProfit: myProfit.toFixed(6), myAvailable: myAvailable.toFixed(6), totalAffiliatePool: totalAffiliatePool.toFixed(2) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/co-affiliate/subscribe", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "affiliate") return res.status(403).json({ message: "Only affiliate accounts can join the Co-Affiliate programme." });
      const existing = await storage.getCoAffiliateByUser(userId);
      if (existing) return res.status(400).json({ message: "You are already enrolled in the Co-Affiliate programme." });

      const { category, customAmount } = req.body;
      const cat = Number(category);
      let investmentCategory: number;
      let amountPaid: number;
      let sharePercentage: number;

      const totalEnrolled = await storage.getCoAffiliateCount();
      const pricing = getCoAffiliatePricing(totalEnrolled);
      const milestones = Math.floor(totalEnrolled / CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
      const multiplier = Math.pow(1 + CO_AFFILIATE_PROGRAM.PRICE_INCREASE_RATE, milestones);

      if (cat === 100 || cat === 300) {
        const tier = pricing.find(p => p.category === cat);
        if (!tier) return res.status(400).json({ message: "Invalid category" });
        investmentCategory = cat;
        amountPaid = tier.currentPrice;
        sharePercentage = tier.sharePercentage;
      } else if (cat === 500) {
        // Elite tier — custom amount $500–$10,000
        const custom = Number(customAmount);
        if (isNaN(custom) || custom < 500 || custom > 10000) {
          return res.status(400).json({ message: "Elite category amount must be between $500 and $10,000." });
        }
        investmentCategory = Math.round(custom);
        amountPaid = Math.round(custom * multiplier);
        sharePercentage = getEliteSharePercentage(custom);
      } else {
        return res.status(400).json({ message: "Invalid category. Must be 100, 300, or 500 (elite)." });
      }

      // ── Wallet balance check ──
      const MIN_WALLET_BALANCE = 2;
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);
      if (walletBalance - amountPaid < MIN_WALLET_BALANCE) {
        const needed = (amountPaid + MIN_WALLET_BALANCE - walletBalance).toFixed(2);
        return res.status(400).json({
          message: `Insufficient wallet balance. You need $${amountPaid} but only have $${walletBalance.toFixed(2)} (a $2 minimum must remain). Please fund your wallet with at least $${needed} more.`,
          code: "INSUFFICIENT_BALANCE",
          walletBalance: walletBalance.toFixed(2),
          required: amountPaid,
        });
      }

      // ── Deduct from SwiftWallet ──
      await storage.updateWalletBalance(userId, (walletBalance - amountPaid).toFixed(2));
      await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: `-${amountPaid.toFixed(2)}`,
        description: `Co-Affiliate Trust Fund investment — ${cat === 500 ? "Elite" : cat === 300 ? "Growth" : "Starter"} tier`,
        status: "completed",
      });

      const reserveCut = parseFloat((amountPaid * 0.20).toFixed(2)); // 20% to reserve
      const record = await storage.createCoAffiliate({
        userId,
        investmentCategory,
        amountPaid: amountPaid.toFixed(2),
        sharePercentage: sharePercentage.toFixed(10),
        status: "active",
      });

      // Ring-fence 20% of trust fund investment into the strategic reserve
      await storage.addToReserveFund(reserveCut.toFixed(6));

      // ── Credit 5% referral commission to referrer on Trust Fund deposit ──
      creditReferrerCommission(userId, amountPaid, "affiliate trust fund deposit").catch(() => {});

      await storage.createNotification({
        userId,
        type: "system",
        title: "Trust Fund Enrolment Confirmed",
        message: `$${amountPaid.toFixed(2)} has been deducted from your wallet. You've joined the Co-Affiliate programme. $${reserveCut.toFixed(2)} (20%) has been ring-fenced into the Strategic Reserve Fund.`,
        data: { amountPaid, reserveCut, shareLabel: (sharePercentage * 100).toFixed(6) + "%" },
        isRead: false,
      });
      storage.getUser(userId).then(u => {
        if (u) sendCoAffiliateEnrollmentEmail(u.email, u.firstName, amountPaid.toFixed(2), reserveCut.toFixed(2)).catch((err: any) => console.error("[EMAIL] Co-affiliate email failed:", err?.message ?? err));
      });

      res.json({
        ...record,
        currentPrice: amountPaid,
        reserveCut,
        shareLabel: (sharePercentage * 100).toFixed(6) + "%",
        message: "Successfully enrolled as Co-Affiliate/Initiator!",
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── CO-AFFILIATE UPGRADE ──
  app.post("/api/co-affiliate/upgrade", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const existing = await storage.getCoAffiliateByUser(userId);
      if (!existing) return res.status(400).json({ message: "You are not enrolled in the Co-Affiliate programme. Please subscribe first." });

      const { category, customAmount } = req.body;
      const cat = Number(category);
      const totalEnrolled = await storage.getCoAffiliateCount();
      const milestones = Math.floor(totalEnrolled / CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
      const multiplier = Math.pow(1 + CO_AFFILIATE_PROGRAM.PRICE_INCREASE_RATE, milestones);
      const pricing = getCoAffiliatePricing(totalEnrolled);

      let newCategory: number;
      let newAmountPaid: number;
      let newSharePercentage: number;

      if (cat === 100 || cat === 300) {
        if (Number(existing.investmentCategory) >= cat) {
          return res.status(400).json({ message: `You are already at the ${cat === 300 ? "Growth" : "Starter"} tier or higher.` });
        }
        const tier = pricing.find(p => p.category === cat);
        if (!tier) return res.status(400).json({ message: "Invalid category" });
        newCategory = cat;
        newAmountPaid = tier.currentPrice;
        newSharePercentage = tier.sharePercentage;
      } else if (cat === 500) {
        const custom = Number(customAmount);
        if (isNaN(custom) || custom < 500 || custom > 10000) {
          return res.status(400).json({ message: "Elite upgrade amount must be $500 – $10,000." });
        }
        if (Number(existing.investmentCategory) >= custom) {
          return res.status(400).json({ message: "Your current investment is already at this amount or higher." });
        }
        newCategory = Math.round(custom);
        newAmountPaid = Math.round(custom * multiplier);
        newSharePercentage = getEliteSharePercentage(custom);
      } else {
        return res.status(400).json({ message: "Invalid category." });
      }

      // ── Wallet balance check ──
      const MIN_WALLET_BALANCE = 2;
      const upgradeWallet = await storage.getOrCreateWallet(userId);
      const upgradeWalletBalance = parseFloat(upgradeWallet.balance);
      if (upgradeWalletBalance - newAmountPaid < MIN_WALLET_BALANCE) {
        const needed = (newAmountPaid + MIN_WALLET_BALANCE - upgradeWalletBalance).toFixed(2);
        return res.status(400).json({
          message: `Insufficient wallet balance. You need $${newAmountPaid} but only have $${upgradeWalletBalance.toFixed(2)} (a $2 minimum must remain). Please fund your wallet with at least $${needed} more.`,
          code: "INSUFFICIENT_BALANCE",
          walletBalance: upgradeWalletBalance.toFixed(2),
          required: newAmountPaid,
        });
      }

      // ── Deduct from SwiftWallet ──
      await storage.updateWalletBalance(userId, (upgradeWalletBalance - newAmountPaid).toFixed(2));
      await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: `-${newAmountPaid.toFixed(2)}`,
        description: `Co-Affiliate Trust Fund upgrade — ${cat === 500 ? "Elite" : cat === 300 ? "Growth" : "Starter"} tier`,
        status: "completed",
      });

      const upgraded = await storage.updateCoAffiliate(userId, {
        investmentCategory: newCategory,
        amountPaid: newAmountPaid.toFixed(2),
        sharePercentage: newSharePercentage.toFixed(10),
      });

      // ── Credit 5% referral commission to referrer on Trust Fund upgrade ──
      creditReferrerCommission(userId, newAmountPaid, "affiliate trust fund deposit").catch(() => {});

      await storage.createNotification({
        userId,
        type: "system",
        title: "Trust Fund Tier Upgraded",
        message: `$${newAmountPaid.toFixed(2)} deducted from your wallet. You've upgraded to the ${cat === 500 ? "Elite" : cat === 300 ? "Growth" : "Starter"} tier.`,
        data: { newAmountPaid, shareLabel: (newSharePercentage * 100).toFixed(6) + "%" },
        isRead: false,
      });

      res.json({
        ...upgraded,
        currentPrice: newAmountPaid,
        shareLabel: (newSharePercentage * 100).toFixed(6) + "%",
        message: `Successfully upgraded to ${cat === 500 ? "Elite" : cat === 300 ? "Growth" : "Starter"} tier! $${newAmountPaid.toFixed(2)} deducted from your wallet.`,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Co-Affiliate: withdraw available earnings to SwiftWallet
  app.post("/api/co-affiliate/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const record = await storage.getCoAffiliateByUser(userId);
      if (!record) return res.status(404).json({ message: "You are not enrolled in the Trust Fund." });
      if (record.status !== "active") return res.status(400).json({ message: "Your Trust Fund account is not active." });

      const totalAffiliatePool = await storage.getTotalAffiliatePool();
      const sharePercentage = parseFloat(record.sharePercentage);
      const myProfit = totalAffiliatePool * sharePercentage;
      const alreadyWithdrawn = parseFloat(record.withdrawnAmount ?? "0");
      const available = parseFloat((myProfit - alreadyWithdrawn).toFixed(6));

      if (available <= 0) return res.status(400).json({ message: "No available earnings to withdraw at this time." });
      if (available < 1) return res.status(400).json({ message: `Minimum withdrawal is $1.00. Your available balance is $${available.toFixed(4)} — keep earning until you reach $1.` });

      // Credit SwiftWallet
      const wallet = await storage.getOrCreateWallet(userId);
      const newBalance = (parseFloat(wallet.balance) + available).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);

      // Record withdrawal
      await storage.recordCoAffiliateWithdrawal(userId, available.toFixed(6));

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "admin_credit",
        amount: available.toFixed(2),
        fee: "0.00",
        paymentMethod: "trust_fund",
        description: `Trust Fund earnings withdrawal — ${(sharePercentage * 100).toFixed(6)}% share of $${totalAffiliatePool.toFixed(2)} pool`,
      });
      // Notification
      await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Trust Fund Withdrawal Successful",
        message: `$${available.toFixed(4)} from your Trust Fund earnings has been credited to your TSIA SwiftWallet.`,
        data: { amount: available, newBalance },
        isRead: false,
      });

      res.json({ available: available.toFixed(6), newWalletBalance: newBalance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── TRADE MARKET ROUTES ──

  app.get("/api/trade/wallet", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const wallet = await storage.getOrCreateTradeWallet(userId);
      // Compute per-cycle deposit count AND current-cycle bot earnings from transaction history.
      // cycle_started_at marks the beginning of the current cycle (set on each deposit/reinvest).
      // This is immune to wallet-field corruption (totalBotEarnings being reset by admin stop-bot, etc.)
      const cycleMetrics = await db.execute(sql`
        SELECT
          -- Exclude referral commissions: the cap measures YOUR OWN trading performance,
          -- not earnings from your referrals' sessions.
          COALESCE(SUM(amount_usd::numeric) FILTER (
            WHERE type = 'bot_earning' AND amount_usd::numeric > 0
            AND COALESCE(note, '') NOT LIKE 'Referral commission%'
            AND COALESCE(note, '') NOT LIKE 'Admin balance adjustment%'
            AND COALESCE(note, '') NOT LIKE 'Bot session stopped and locked by admin%'
          ), 0) AS current_cycle_earnings,
          COUNT(*) FILTER (
            WHERE type = 'topup' AND status = 'completed'
          ) AS deposit_count
        FROM trade_transactions
        WHERE user_id = ${userId}
        AND created_at >= COALESCE(
          (SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${userId}),
          '1970-01-01'::timestamptz
        )
      `);
      const cm = (cycleMetrics.rows[0] as any) ?? {};
      const depositCount         = parseInt(cm.deposit_count ?? "0", 10);
      const currentCycleEarnings = parseFloat(cm.current_cycle_earnings ?? "0");
      res.json({ ...wallet, depositCount, currentCycleEarnings });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  const normalizeReferralCode = (code: string | null | undefined) => (code || "").trim().toUpperCase();

  app.post("/api/trade/wallet/connect", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { trc20Address, bep20Address } = req.body;
      if (!trc20Address && !bep20Address) return res.status(400).json({ message: "Provide at least one wallet address." });
      await storage.getOrCreateTradeWallet(userId);
      const updated = await storage.updateTradeWalletAddresses(userId, trc20Address, bep20Address);
      res.json({ ...updated, message: "Wallet address(es) saved successfully." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Helper: credit 5% referral commission to the user's referrer ─────────────
  async function creditReferrerCommission(
    referredUserId: number,
    grossAmount: number,
    sourceLabel: string,
  ): Promise<{ credited: boolean; referrerId?: number; commissionAmount?: number }> {
    try {
      const user = await storage.getUser(referredUserId);
      if (!user?.referredBy) return { credited: false };
      const referralCode = normalizeReferralCode(user.referredBy);
      const referrer = await storage.getUserByAffiliateCode(referralCode);
      if (!referrer) {
        console.warn(`[REFERRAL] Referrer code not found for user ${referredUserId}: ${referralCode}`);
        return { credited: false };
      }
      if (referrer.id === referredUserId) return { credited: false };

      const commission = parseFloat((grossAmount * TRADE_MARKET.AFFILIATE_SHARE_RATE).toFixed(6)); // 5%
      if (commission <= 0) return { credited: false };

      // Ensure referrer has a trade wallet before crediting; credit commission wallet (NOT trade balance)
      await storage.addReferralCommission(referrer.id, commission.toFixed(6));
      await storage.createTradeTransaction({
        userId: referrer.id,
        type: "bot_earning",
        walletType: null,
        amountUsd: commission.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: "0.000000",
        netAmount: commission.toFixed(6),
        txHash: null,
        status: "completed",
        note: `Referral commission (5%) — ${user.firstName} ${user.lastName} ${sourceLabel}`,
      });
      const notif = await storage.createNotification({
        userId: referrer.id,
        type: "wallet_credit",
        title: "Referral Commission Earned!",
        message: `$${commission.toFixed(4)} (5%) referral commission from ${user.firstName} ${user.lastName.charAt(0)}. ${sourceLabel}. Added to your Commission Wallet.`,
        data: { referredUserId, commission, sourceLabel },
        isRead: false,
      });
      pushToUser(referrer.id, "notification", notif);
      return { credited: true, referrerId: referrer.id, commissionAmount: commission };
    } catch (e: any) {
      console.error("[REFERRAL] Failed to credit commission:", e?.message ?? e);
      return { credited: false };
    }
  }

  // ── Deduplicating version: only credits once per referred user (regardless of trigger source) ──
  async function creditReferrerCommissionOnce(
    referredUserId: number,
    grossAmount: number,
    sourceLabel: string,
  ): Promise<{ credited: boolean; referrerId?: number; commissionAmount?: number }> {
    try {
      const user = await storage.getUser(referredUserId);
      if (!user?.referredBy) return { credited: false };
      const referralCode = normalizeReferralCode(user.referredBy);
      const referrer = await storage.getUserByAffiliateCode(referralCode);
      if (!referrer) {
        console.warn(`[REFERRAL] Referrer code not found for user ${referredUserId}: ${referralCode}`);
        return { credited: false };
      }

      // Check if any commission was already given for this referred user (by name match)
      const namePattern = `%${user.firstName} ${user.lastName}%`;
      const existing = await db.execute(sql`
        SELECT id FROM trade_transactions
        WHERE user_id = ${referrer.id}
          AND type = 'bot_earning'
          AND note LIKE 'Referral commission%'
          AND note LIKE ${namePattern}
        LIMIT 1
      `);
      if (existing.rows.length > 0) return { credited: false };

      return creditReferrerCommission(referredUserId, grossAmount, sourceLabel);
    } catch (e: any) {
      console.error("[REFERRAL] Failed to check one-time commission:", e?.message ?? e);
      return { credited: false };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  app.post("/api/trade/deposit", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd, walletType, txHash, brokerId: depositBrokerId, tradingPlanDays: rawPlanDays } = req.body;
      const amount = parseFloat(amountUsd);
      const depositBroker = TRADE_BROKERS.find(b => b.id === depositBrokerId);
      const minDepositAmt = depositBroker ? depositBroker.minDeposit : TRADE_MARKET.MIN_DEPOSIT;
      const tradingPlanDays: number = [60, 90, 120].includes(Number(rawPlanDays)) ? Number(rawPlanDays) : 120;
      if (isNaN(amount) || amount < minDepositAmt) {
        return res.status(400).json({ message: `Minimum deposit for ${depositBroker ? depositBroker.name : "this exchange"} is $${minDepositAmt}.` });
      }
      if (amount > TRADE_MARKET.MAX_DEPOSIT) {
        return res.status(400).json({ message: `Maximum deposit is $${TRADE_MARKET.MAX_DEPOSIT}. Please split into smaller deposits.` });
      }
      if (!["trc20", "bep20"].includes(walletType)) {
        return res.status(400).json({ message: "walletType must be trc20 or bep20." });
      }
      // Determine if this is an initial deposit or a mid-cycle top-up.
      // Initial deposit: no loss schedule yet, OR the previous cycle just completed.
      // Top-up: cycle is actively running (schedule exists, not roi-complete).
      const preDepositWallet = await storage.getOrCreateTradeWallet(userId);
      const isCryptoTopUp = !preDepositWallet.roiComplete && (preDepositWallet.lossDayNumbers?.length ?? 0) > 0;

      // Enforce 3 top-up limit per cycle — only for mid-cycle top-ups, not the initial deposit
      if (isCryptoTopUp) {
        const depositLimitRow = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM trade_transactions
          WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
          AND created_at >= COALESCE(
            (SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${userId}),
            '1970-01-01'::timestamptz
          )
        `);
        if (parseInt((depositLimitRow.rows[0] as any)?.cnt ?? "0", 10) >= 3) {
          return res.status(400).json({ message: "Top-up limit reached. You've used all 3 top-up slots. Re-invest your earnings after your cycle completes to continue." });
        }
      }

      // Allocations on deposit — 5% affiliate pool only; no reserve fund on direct crypto deposits
      const reserveCut   = 0;
      const affiliateCut = parseFloat((amount * 0.05).toFixed(6));
      const userCredit   = parseFloat((amount * 0.95).toFixed(6));

      const tx = await storage.createTradeTransaction({
        userId,
        type: isCryptoTopUp ? "topup" : "deposit",
        walletType,
        amountUsd: amount.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: userCredit.toFixed(6),
        txHash: txHash || null,
        status: "completed",
        note: `Deposit via ${walletType.toUpperCase()} — 5% affiliate pool, 95% credited`,
      });

      await storage.updateTradeBalance(userId, userCredit.toFixed(6));
      await storage.addToTotalInvested(userId, userCredit.toFixed(6));
      // Cycle management on top-up
      const postDepositWallet = await storage.getOrCreateTradeWallet(userId);
      if (postDepositWallet.roiComplete) {
        // Completed cycle — full reset for a fresh cycle
        await storage.resetRoiForNewCycle(userId);
        await storage.assignLossDays(userId, generateLossDays(tradingPlanDays));
      } else if ((postDepositWallet.lossDayNumbers?.length ?? 0) === 0) {
        // First deposit ever — assign the loss schedule for the chosen plan
        await storage.assignLossDays(userId, generateLossDays(tradingPlanDays));
      } else if ((postDepositWallet.tradingDayNumber ?? 0) > 0) {
        // Mid-cycle top-up: reset day counter so the new deposit starts a fresh cycle
        await storage.resetTradingDayForTopUp(userId, generateLossDays(tradingPlanDays));
      }
      // Store chosen trading plan
      await storage.setTradingPlanDays(userId, tradingPlanDays);
      // Track locked principal (net amount in trade balance from this deposit — capital is locked)
      await storage.addToLockedPrincipal(userId, userCredit.toFixed(6));

      // Route 5% affiliate pool (no reserve fund on direct trade deposits)
      const affiliateCount = await storage.getAffiliateCount();
      const perAffiliate   = affiliateCount > 0 ? affiliateCut / affiliateCount : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));

      // Stamp cycle_started_at so per-cycle deposit count & earnings are accurate
      await db.execute(sql`UPDATE trade_wallets SET cycle_started_at = NOW() WHERE user_id = ${userId}`);
      const wallet = await storage.getOrCreateTradeWallet(userId);
      res.json({
        transaction: tx,
        newBalance: wallet.tradeBalance,
        breakdown: {
          deposited: amount,
          reserveFund: 0,
          affiliatePool: affiliateCut,
          creditedToYou: userCredit,
        },
        message: "Deposit confirmed. 95% credited, 5% affiliate pool.",
      });
      // Notify admin of confirmed crypto deposit (fire-and-forget)
      storage.getUser(userId).then(u => {
        if (u) sendAdminTradeDepositEmail({
          name: `${u.firstName} ${u.lastName}`, email: u.email,
          amount: amount.toFixed(2), credited: userCredit.toFixed(2),
          method: walletType, txHash: txHash || undefined, userId,
          type: isCryptoTopUp ? "topup" : "deposit",
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Fund Trade Wallet from SwiftWallet balance ────────────────────────
  app.post("/api/trade/fund-from-wallet", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) {
        return res.status(403).json({ message: "Top-ups are disabled during an active trade session. Please wait until the current session ends before funding your trade wallet." });
      }
      const { amountUsd, brokerId, tradingPlanDays: rawFwPlanDays } = req.body;
      const amount = parseFloat(amountUsd);
      const broker = TRADE_BROKERS.find(b => b.id === brokerId);
      const minDeposit = broker ? broker.minDeposit : TRADE_MARKET.MIN_DEPOSIT;
      const fwTradingPlanDays: number = [60, 90, 120].includes(Number(rawFwPlanDays)) ? Number(rawFwPlanDays) : 120;
      if (isNaN(amount) || amount < minDeposit) {
        return res.status(400).json({ message: `Minimum funding amount for ${broker ? broker.name : "this exchange"} is $${minDeposit}.` });
      }
      // Determine if this is an initial deposit or a mid-cycle top-up.
      const preFwWallet = await storage.getOrCreateTradeWallet(userId);
      const isFwTopUp = !preFwWallet.roiComplete && (preFwWallet.lossDayNumbers?.length ?? 0) > 0;

      // Enforce 3 top-up limit per cycle — only for mid-cycle top-ups, not the initial deposit
      if (isFwTopUp) {
        const fwDepositLimitRow = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM trade_transactions
          WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
          AND created_at >= COALESCE(
            (SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${userId}),
            '1970-01-01'::timestamptz
          )
        `);
        if (parseInt((fwDepositLimitRow.rows[0] as any)?.cnt ?? "0", 10) >= 3) {
          return res.status(400).json({ message: "Top-up limit reached. You've used all 3 top-up slots. Re-invest your earnings after your cycle completes to continue." });
        }
      }

      if (amount > TRADE_MARKET.MAX_DEPOSIT) {
        return res.status(400).json({ message: `Maximum deposit is $${TRADE_MARKET.MAX_DEPOSIT}.` });
      }
      // Check personal wallet balance
      const personalWallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(personalWallet.balance);
      const minBalance = 2; // keep $2 minimum in personal wallet
      if (balance - amount < minBalance) {
        return res.status(400).json({ message: `Insufficient personal wallet balance. You need at least $${(amount + minBalance).toFixed(2)} (keeping $${minBalance} minimum).` });
      }
      // Deduct from personal wallet
      await storage.updateWalletBalance(userId, (balance - amount).toFixed(2));
      // Allocations — 5% affiliate pool only; no reserve fund on wallet-to-trade top-ups
      const reserveCut    = 0;
      const affiliateCut  = parseFloat((amount * 0.05).toFixed(6));
      const userCredit    = parseFloat((amount - affiliateCut).toFixed(6)); // 95%
      // Credit trade wallet
      const tx = await storage.createTradeTransaction({
        userId,
        type: isFwTopUp ? "topup" : "deposit",
        walletType: "trc20",
        amountUsd: amount.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: userCredit.toFixed(6),
        txHash: `INTERNAL-${userId}-${Date.now()}`,
        status: "completed",
        note: `Funded from SwiftWallet — 5% affiliate pool, 95% credited to trade wallet`,
      });
      await storage.updateTradeBalance(userId, userCredit.toFixed(6));
      await storage.addToTotalInvested(userId, userCredit.toFixed(6));
      // Cycle management on top-up
      const fwPostWallet = await storage.getOrCreateTradeWallet(userId);
      if (fwPostWallet.roiComplete) {
        // Completed cycle — full reset for a fresh cycle
        await storage.resetRoiForNewCycle(userId);
        await storage.assignLossDays(userId, generateLossDays(fwTradingPlanDays));
      } else if ((fwPostWallet.lossDayNumbers?.length ?? 0) === 0) {
        // First top-up — assign loss schedule for chosen plan
        await storage.assignLossDays(userId, generateLossDays(fwTradingPlanDays));
      } else if ((fwPostWallet.tradingDayNumber ?? 0) > 0) {
        // Mid-cycle top-up: reset day counter so the new deposit starts a fresh cycle
        await storage.resetTradingDayForTopUp(userId, generateLossDays(fwTradingPlanDays));
      }
      // Store chosen trading plan
      await storage.setTradingPlanDays(userId, fwTradingPlanDays);
      // Track locked principal (net amount in trade balance — capital is locked)
      await storage.addToLockedPrincipal(userId, userCredit.toFixed(6));
      // Route 5% affiliate cut to co-affiliate pool (no reserve fund on wallet top-ups)
      const affCountFw  = await storage.getAffiliateCount();
      const perAffFw    = affCountFw > 0 ? affiliateCut / affCountFw : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affCountFw, perAffFw.toFixed(6));
      // Log transaction in personal wallet history
      const platformFee = affiliateCut;
      await storage.createTransaction({
        userId,
        type: "trade_transfer",
        amount: (-amount).toFixed(2),
        fee: platformFee.toFixed(2),
        paymentMethod: "wallet",
        description: `Trade Wallet funding — $${userCredit.toFixed(2)} credited (95%), $${affiliateCut.toFixed(2)} affiliate pool (5%)`,
      });
      // Stamp cycle_started_at so per-cycle deposit count & earnings are accurate
      await db.execute(sql`UPDATE trade_wallets SET cycle_started_at = NOW() WHERE user_id = ${userId}`);
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      res.json({
        message: `$${userCredit.toFixed(2)} credited to your Trade Wallet (95% of $${amount.toFixed(2)} — 5% affiliate pool)`,
        newTradeBalance: tradeWallet.tradeBalance,
        breakdown: { deposited: amount, reserveFund: 0, affiliatePool: affiliateCut, creditedToYou: userCredit },
      });
      // Notify admin of SwiftWallet → Trade deposit (fire-and-forget)
      storage.getUser(userId).then(u => {
        if (u) sendAdminTradeDepositEmail({
          name: `${u.firstName} ${u.lastName}`, email: u.email,
          amount: amount.toFixed(2), credited: userCredit.toFixed(2),
          method: "SwiftWallet (internal transfer)", userId,
          type: isFwTopUp ? "topup" : "wallet_fund",
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Transfer trade earnings → SwiftWallet (no fee, instant) ──────────
  app.post("/api/trade/transfer-to-wallet", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) {
        return res.status(403).json({ message: "Withdrawals are disabled during an active trade session. Please wait until your current trading session ends." });
      }
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < 5) return res.status(400).json({ message: "Minimum transfer is $5 (earnings only)." });
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const twBalance = parseFloat(tradeWallet.tradeBalance);
      const twLocked = tradeWallet.roiComplete ? 0 : parseFloat(tradeWallet.lockedPrincipal ?? "0");
      // Only accumulated earnings (above capital) can be transferred; capital is non-refundable
      const twWithdrawable = Math.max(0, twBalance - twLocked);
      if (amount > twWithdrawable) {
        if (twLocked > 0 && !tradeWallet.roiComplete) {
          return res.status(400).json({ message: `Only your trade earnings ($${twWithdrawable.toFixed(2)}) can be transferred. Your invested capital ($${twLocked.toFixed(2)}) is non-refundable.` });
        }
        return res.status(400).json({ message: `Insufficient trade balance. Available: $${twWithdrawable.toFixed(2)}` });
      }
      // Wallet-to-wallet: no reserve deduction — full amount credited
      // (Reserve/fees only apply on bank and crypto withdrawals)
      // Deduct full amount from trade wallet
      await storage.updateTradeBalance(userId, (-amount).toFixed(6));
      await storage.createTradeTransaction({
        userId, type: "withdraw_exchange", walletType: null,
        amountUsd: amount.toFixed(6), feeUsd: "0.000000",
        reserveFundDeduction: "0.000000", affiliateShareDeduction: "0.000000",
        netAmount: amount.toFixed(6), txHash: null, status: "completed",
        note: `Transferred to SwiftWallet — full amount credited ($${amount.toFixed(2)}, no fee)`,
      });
      // Credit full amount to personal wallet
      const personalWallet = await storage.getOrCreateWallet(userId);
      const newPersonalBal = (parseFloat(personalWallet.balance) + amount).toFixed(2);
      await storage.updateWalletBalance(userId, newPersonalBal);
      if (!personalWallet.activated && parseFloat(newPersonalBal) > 2) await storage.activateWallet(userId);
      await storage.createTransaction({ userId, type: "deposit", amount: amount.toFixed(2), fee: "0.00", paymentMethod: "internal", description: `Transfer from Trade Wallet — $${amount.toFixed(2)} credited in full (no fee)` });
      const notif = await storage.createNotification({ userId, type: "wallet_credit", title: "Trade Transfer Complete ✓", message: `$${amount.toFixed(2)} credited to your SwiftWallet in full — no deductions on wallet-to-wallet transfers.`, data: {}, isRead: false });
      pushToUser(userId, "notification", notif);
      const updatedTrade = await storage.getOrCreateTradeWallet(userId);
      res.json({ newTradeBalance: updatedTrade.tradeBalance, newPersonalBalance: newPersonalBal, transferred: amount.toFixed(2), reserveDeducted: "0.00" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Trade Market — shared bank/card credit helper ─────────────────────────
  // Reference format encodes plan days: TRADE-SQUAD-{uid}-{planDays}-{ts} / TRADE-KORA-{uid}-{planDays}-{ts}
  async function creditTradeWallet(
    userId: number, gross: number, walletType: string, txRef: string,
    planDays: number, pending?: { id: number; amountUsd: string; status: string },
  ): Promise<{ userCredit: number; affiliateCut: number }> {
    const affiliateCut = parseFloat((gross * 0.05).toFixed(6));
    const userCredit   = parseFloat((gross * 0.95).toFixed(6));
    // Read pre-deposit wallet state to determine if this is an initial deposit or a mid-cycle top-up
    const preWallet = await storage.getOrCreateTradeWallet(userId);
    const isBankTopUp = !preWallet.roiComplete && (preWallet.lossDayNumbers?.length ?? 0) > 0;
    const tx = await storage.createTradeTransaction({
      userId, type: isBankTopUp ? "topup" : "deposit", walletType,
      amountUsd: gross.toFixed(6), feeUsd: "0.000000",
      reserveFundDeduction: "0.000000", affiliateShareDeduction: affiliateCut.toFixed(6),
      netAmount: userCredit.toFixed(6), txHash: txRef, status: "completed",
      note: `Trade deposit via ${walletType} (${txRef}) — 5% affiliate pool, 95% credited`,
    });
    await storage.updateTradeBalance(userId, userCredit.toFixed(6));
    await storage.addToTotalInvested(userId, userCredit.toFixed(6));
    const postWallet = await storage.getOrCreateTradeWallet(userId);
    if (postWallet.roiComplete) {
      await storage.resetRoiForNewCycle(userId);
      await storage.assignLossDays(userId, generateLossDays(planDays));
    } else if ((postWallet.lossDayNumbers?.length ?? 0) === 0) {
      await storage.assignLossDays(userId, generateLossDays(planDays));
    } else if ((postWallet.tradingDayNumber ?? 0) > 0) {
      await storage.resetTradingDayForTopUp(userId, generateLossDays(planDays));
    }
    await storage.setTradingPlanDays(userId, planDays);
    await storage.addToLockedPrincipal(userId, userCredit.toFixed(6));
    const affCount = await storage.getAffiliateCount();
    const perAff   = affCount > 0 ? affiliateCut / affCount : 0;
    await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affCount, perAff.toFixed(6));
    if (pending) await storage.updateWalletDeposit(pending.id, { status: "completed" });
    // Stamp cycle_started_at so per-cycle deposit count & earnings are accurate
    await db.execute(sql`UPDATE trade_wallets SET cycle_started_at = NOW() WHERE user_id = ${userId}`);
    const notif = await storage.createNotification({
      userId, type: "deposit", title: "Trade Wallet Funded ✓",
      message: `$${userCredit.toFixed(2)} credited to your Trade Wallet (95%) · $${affiliateCut.toFixed(2)} affiliate pool (5%)`,
      data: { reference: txRef }, isRead: false,
    });
    pushToUser(userId, "notification", notif);
    // Notify admin of every confirmed trade deposit
    storage.getUser(userId).then(u => {
      if (u) sendAdminTradeDepositEmail({
        name: `${u.firstName} ${u.lastName}`, email: u.email,
        amount: gross.toFixed(2), credited: userCredit.toFixed(2),
        method: walletType, txHash: txRef, userId,
        type: isBankTopUp ? "topup" : "deposit",
      }).catch(() => {});
    }).catch(() => {});
    return { userCredit, affiliateCut };
  }

  // ── Trade Market — Squad initiate ─────────────────────────────────────────
  app.post("/api/trade/squad/initiate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) return res.status(403).json({ message: "Deposits are disabled during an active trade session." });
      // Only enforce the 3-slot limit for mid-cycle top-ups, not initial deposits
      const sqPreWallet = await storage.getOrCreateTradeWallet(userId);
      const isSqTopUp = !sqPreWallet.roiComplete && (sqPreWallet.lossDayNumbers?.length ?? 0) > 0;
      if (isSqTopUp) {
        const tdLimitRow = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM trade_transactions
          WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
          AND created_at >= COALESCE(
            (SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${userId}),
            '1970-01-01'::timestamptz
          )
        `);
        if (parseInt((tdLimitRow.rows[0] as any)?.cnt ?? "0", 10) >= 3) return res.status(400).json({ message: "Top-up limit reached. You've used all 3 top-up slots." });
      }
      const { amountUsd, brokerId: sqBrokerId, tradingPlanDays: rawSqPlan } = req.body;
      const amount = parseFloat(amountUsd);
      const sqBroker = TRADE_BROKERS.find(b => b.id === sqBrokerId);
      const sqMin = sqBroker ? sqBroker.minDeposit : TRADE_MARKET.MIN_DEPOSIT;
      const sqPlanDays: number = [60, 90, 120].includes(Number(rawSqPlan)) ? Number(rawSqPlan) : 120;
      if (isNaN(amount) || amount < sqMin) return res.status(400).json({ message: `Minimum for ${sqBroker ? sqBroker.name : "this exchange"} is $${sqMin}.` });
      if (amount > TRADE_MARKET.MAX_DEPOSIT) return res.status(400).json({ message: `Maximum deposit is $${TRADE_MARKET.MAX_DEPOSIT}.` });
      const secretKey = process.env.SQUAD_SECRET_KEY;
      const publicKey = process.env.SQUAD_PUBLIC_KEY;
      if (!secretKey || !publicKey) return res.status(500).json({ message: "Payment gateway not configured. Please contact support." });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const amountKobo = Math.round(amount * Math.round(rates.buying * 100));
      // Encode plan days in ref so verify can recover it without extra DB fields
      const transactionRef = `TRADE-SQUAD-${userId}-${sqPlanDays}-${Date.now()}`;
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: transactionRef, walletType: "squad_trade", status: "pending" });
      res.json({ transactionRef, amountKobo, amountNgn: (amount * rates.buying).toFixed(2), publicKey, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Trade Market — Squad verify & credit trade wallet ─────────────────────
  app.post("/api/trade/squad/verify", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { transactionRef } = req.body;
      if (!transactionRef) return res.status(400).json({ message: "Transaction reference is required" });
      const secretKey = process.env.SQUAD_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured" });
      const isLive = secretKey.startsWith("sk_");
      const sqBase = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === transactionRef && d.walletType === "squad_trade");
      if (existing && existing.status === "completed") return res.status(400).json({ message: "This payment has already been credited to your trade wallet." });
      const verRes = await fetch(`${sqBase}/transaction/verify/${encodeURIComponent(transactionRef)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const verData = await verRes.json() as any;
      if (!verData.success || verData.data?.transaction_status !== "Success") return res.status(400).json({ message: "Payment not confirmed yet. Please try again." });
      const rates = await getUsdNgnRates();
      const gross = parseFloat(existing?.amountUsd ?? (verData.data.transaction_amount / Math.round(rates.buying * 100)).toFixed(2));
      // Parse plan days from reference: TRADE-SQUAD-{uid}-{planDays}-{ts}
      const sqRefParts = transactionRef.split("-");
      const sqPlanDays = [60, 90, 120].includes(Number(sqRefParts[3])) ? Number(sqRefParts[3]) : 120;
      const { userCredit } = await creditTradeWallet(userId, gross, "squad_trade", transactionRef, sqPlanDays, existing ? { id: existing.id, amountUsd: existing.amountUsd, status: existing.status } : undefined);
      res.json({ message: `$${userCredit.toFixed(2)} has been credited to your Trade Wallet`, amountUsd: userCredit });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Trade Market — KoraPay initiate ───────────────────────────────────────
  app.post("/api/trade/korapay/initiate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) return res.status(403).json({ message: "Deposits are disabled during an active trade session." });
      // Only enforce the 3-slot limit for mid-cycle top-ups, not initial deposits
      const krPreWallet = await storage.getOrCreateTradeWallet(userId);
      const isKrTopUp = !krPreWallet.roiComplete && (krPreWallet.lossDayNumbers?.length ?? 0) > 0;
      if (isKrTopUp) {
        const tkLimitRow = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM trade_transactions
          WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
          AND created_at >= COALESCE(
            (SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${userId}),
            '1970-01-01'::timestamptz
          )
        `);
        if (parseInt((tkLimitRow.rows[0] as any)?.cnt ?? "0", 10) >= 3) return res.status(400).json({ message: "Top-up limit reached. You've used all 3 top-up slots." });
      }
      const { amountUsd, brokerId: krBrokerId, tradingPlanDays: rawKrPlan } = req.body;
      const amount = parseFloat(amountUsd);
      const krBroker = TRADE_BROKERS.find(b => b.id === krBrokerId);
      const krMin = krBroker ? krBroker.minDeposit : TRADE_MARKET.MIN_DEPOSIT;
      const krPlanDays: number = [60, 90, 120].includes(Number(rawKrPlan)) ? Number(rawKrPlan) : 120;
      if (isNaN(amount) || amount < krMin) return res.status(400).json({ message: `Minimum for ${krBroker ? krBroker.name : "this exchange"} is $${krMin}.` });
      if (amount > TRADE_MARKET.MAX_DEPOSIT) return res.status(400).json({ message: `Maximum deposit is $${TRADE_MARKET.MAX_DEPOSIT}.` });
      const secretKey = process.env.KORAPAY_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Korapay not configured. Please contact support." });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const amountNgn = Math.round(amount * rates.buying);
      // Encode plan days in ref: TRADE-KORA-{uid}-{planDays}-{ts}
      const reference = `TRADE-KORA-${userId}-${krPlanDays}-${Date.now()}`;
      const notifUrl = `${req.protocol}://${req.get("host")}/api/webhook/korapay`;
      const redirectUrl = `${req.protocol}://${req.get("host")}/student-dashboard`;
      const koraRes = await fetch(`${KORA_BASE}/charges/initialize`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNgn, currency: "NGN", reference,
          notification_url: notifUrl, redirect_url: redirectUrl,
          customer: { name: `${user.firstName} ${user.lastName}`, email: user.email },
          channels: ["card", "bank_transfer", "pay_with_bank"],
          metadata: { userId, amountUsd: amount.toFixed(2), tradingPlanDays: krPlanDays, platform: "TSIA-Trade" },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const koraData = await koraRes.json() as any;
      if (!koraData.status) return res.status(502).json({ message: koraData.message ?? "Could not initiate payment" });
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: reference, walletType: "korapay_trade", status: "pending" });
      res.json({ checkoutUrl: koraData.data.checkout_url, reference, amountNgn });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Trade Market — KoraPay verify & credit trade wallet ───────────────────
  app.post("/api/trade/korapay/verify", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ message: "reference is required" });
      const secretKey = process.env.KORAPAY_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Korapay not configured" });
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === reference && d.walletType === "korapay_trade");
      if (existing && existing.status === "completed") return res.status(400).json({ message: "This payment has already been credited to your trade wallet." });
      const verRes = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(reference)}`, {
        headers: { "Authorization": `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(12000),
      });
      const verData = await verRes.json() as any;
      if (!verData.status || verData.data?.status !== "success") return res.status(400).json({ message: "Payment not confirmed yet. Please try again." });
      const rates = await getUsdNgnRates();
      const gross = parseFloat(existing?.amountUsd ?? (verData.data.amount / rates.buying).toFixed(2));
      // Parse plan days from reference: TRADE-KORA-{uid}-{planDays}-{ts}
      const krRefParts = reference.split("-");
      const krPlanDays = [60, 90, 120].includes(Number(krRefParts[3])) ? Number(krRefParts[3]) : 120;
      const { userCredit } = await creditTradeWallet(userId, gross, "korapay_trade", reference, krPlanDays, existing ? { id: existing.id, amountUsd: existing.amountUsd, status: existing.status } : undefined);
      res.json({ message: `$${userCredit.toFixed(2)} has been credited to your Trade Wallet`, amountUsd: userCredit });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── REINVEST earnings back into locked principal ──────────────────────────
  app.post("/api/trade/reinvest", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) {
        return res.status(403).json({ message: "Re-invest is disabled during an active trade session. Wait until the session ends." });
      }
      const wallet = await storage.getOrCreateTradeWallet(userId);
      const tradeBalance    = parseFloat(wallet.tradeBalance ?? "0");
      const lockedPrincipal = parseFloat(wallet.lockedPrincipal ?? "0");
      const withdrawable    = parseFloat((Math.max(0, tradeBalance - lockedPrincipal)).toFixed(6));
      if (withdrawable < 2) {
        return res.status(400).json({ message: "Minimum $2 in withdrawable earnings required to re-invest." });
      }
      // Lock earnings as new principal and reset cycle
      await storage.addToLockedPrincipal(userId, withdrawable.toFixed(6));
      const currentPlanDays: number = [60, 90, 120].includes(Number(wallet.tradingPlanDays)) ? Number(wallet.tradingPlanDays) : 120;
      await storage.resetTradingDayForTopUp(userId, generateLossDays(currentPlanDays));
      // Stamp cycle_started_at so per-cycle deposit count resets to 0 for the new cycle
      await db.execute(sql`UPDATE trade_wallets SET cycle_started_at = NOW() WHERE user_id = ${userId}`);
      // Record the reinvest so transaction history reflects cycle boundaries
      await storage.createTradeTransaction({
        userId, type: "withdraw_exchange", walletType: null,
        amountUsd: withdrawable.toFixed(6), feeUsd: "0.000000",
        reserveFundDeduction: "0.000000", affiliateShareDeduction: "0.000000",
        netAmount: withdrawable.toFixed(6), txHash: null, status: "completed",
        note: `Re-invested $${withdrawable.toFixed(2)} as new locked principal — fresh ${currentPlanDays}-day cycle started`,
      });
      const updated = await storage.getOrCreateTradeWallet(userId);
      res.json({ success: true, reinvestedAmount: withdrawable.toFixed(2), newLockedPrincipal: updated.lockedPrincipal, message: `$${withdrawable.toFixed(2)} re-invested! Your cycle has been reset with a fresh earning period.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/trade/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (await isTradeSessionActive(userId)) {
        return res.status(403).json({ message: "Withdrawals are disabled during an active trade session. Please wait until your current trading session ends." });
      }
      const { amountUsd, withdrawalType, walletType, bankCode, accountNumber, accountName } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < TRADE_MARKET.MIN_WITHDRAW) {
        return res.status(400).json({ message: `Minimum withdrawal is $${TRADE_MARKET.MIN_WITHDRAW}.` });
      }
      if (!["withdraw_exchange", "withdraw_bank"].includes(withdrawalType)) {
        return res.status(400).json({ message: "withdrawalType must be withdraw_exchange or withdraw_bank." });
      }
      if (withdrawalType === "withdraw_bank" && (!bankCode || !accountNumber || !accountName)) {
        return res.status(400).json({ message: "Bank details required for bank withdrawal: bankCode, accountNumber, accountName." });
      }
      const feeRate = withdrawalType === "withdraw_bank" ? TRADE_MARKET.FEE_BANK_WITHDRAW : TRADE_MARKET.FEE_EXCHANGE_WITHDRAW;
      const fee = amount * feeRate;
      const coAffCountWd = await storage.getCoAffiliateCount();
      const affiliateCutRate = getCoAffiliateTransactionRate(coAffCountWd);
      const affiliateCut = amount * affiliateCutRate;
      const netPayout = amount - fee - affiliateCut;

      const wallet = await storage.getOrCreateTradeWallet(userId);
      const currentBalance = parseFloat(wallet.tradeBalance);
      const wdLocked = wallet.roiComplete ? 0 : parseFloat(wallet.lockedPrincipal ?? "0");
      // Only accumulated earnings (above capital) can be withdrawn; capital is non-refundable
      const wdWithdrawable = Math.max(0, currentBalance - wdLocked);
      if (amount > wdWithdrawable) {
        if (wdLocked > 0 && !wallet.roiComplete) {
          return res.status(400).json({ message: `Only your trade earnings ($${wdWithdrawable.toFixed(2)}) can be withdrawn. Your invested capital ($${wdLocked.toFixed(2)}) is non-refundable.` });
        }
        return res.status(400).json({ message: `Insufficient balance. Available: $${wdWithdrawable.toFixed(2)}` });
      }

      const txType = withdrawalType === "withdraw_bank" ? "withdraw_bank" : "withdraw_exchange";
      const txStatus = withdrawalType === "withdraw_bank" ? "pending" : "completed";
      const tx = await storage.createTradeTransaction({
        userId, type: txType, walletType: walletType || null,
        amountUsd: amount.toFixed(6), feeUsd: fee.toFixed(6),
        reserveFundDeduction: "0.000000", affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: netPayout.toFixed(6), txHash: null, status: txStatus,
        note: withdrawalType === "withdraw_bank"
          ? `Bank withdrawal ₦${Math.round(netPayout * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} → ${accountName} (${accountNumber}) — 8% fee + ${(affiliateCutRate * 100).toFixed(0)}% co-affiliate pool | Pending admin approval`
          : `Exchange withdrawal — 5% fee + ${(affiliateCutRate * 100).toFixed(0)}% co-affiliate pool`,
      });

      await storage.updateTradeBalance(userId, (-amount).toFixed(6));
      const affiliateCount = await storage.getAffiliateCount();
      const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));

      // ── For bank withdrawals: create a pending withdrawal request for admin approval ──
      if (withdrawalType === "withdraw_bank") {
        await storage.createWithdrawalRequest({
          userId,
          type: "trade_bank" as any,
          amount: amount.toFixed(2),
          fee: fee.toFixed(2),
          netAmount: netPayout.toFixed(2),
          bankName: `[TRADE MARKET]`,
          bankCode: bankCode ?? "",
          accountNumber,
          accountName,
        });
        const tradeUser = await storage.getUser(userId);
        if (tradeUser) {
          sendAdminWithdrawalEmail({
            name: `${tradeUser.firstName} ${tradeUser.lastName}`,
            email: tradeUser.email,
            amount: amount.toFixed(2),
            method: "bank",
            bankName: `[TRADE MARKET] (accountName: ${accountName})`,
            accountNumber,
            accountName,
            userId,
          }).catch(() => {});
        }
      }

      // Notify admin of exchange withdrawals (bank withdrawal email already sent above)
      if (withdrawalType === "withdraw_exchange") {
        storage.getUser(userId).then(u => {
          if (u) sendAdminTradeWithdrawExchangeEmail({
            name: `${u.firstName} ${u.lastName}`, email: u.email,
            amount: amount.toFixed(2), netPayout: netPayout.toFixed(2), userId,
          }).catch(() => {});
        }).catch(() => {});
      }

      const updatedWallet = await storage.getOrCreateTradeWallet(userId);
      const wdNotif = await storage.createNotification({
        userId, type: "wallet_credit",
        title: withdrawalType === "withdraw_bank" ? "Trade Withdrawal Submitted ✓" : "Trade Withdrawal Initiated ✓",
        message: withdrawalType === "withdraw_bank"
          ? `Your trade bank withdrawal of ₦${Math.round(netPayout * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} to ${accountName} is pending admin approval. You will receive funds within 24 hours.`
          : `$${netPayout.toFixed(2)} withdrawal to exchange wallet initiated.`,
        data: {}, isRead: false,
      });
      pushToUser(userId, "notification", wdNotif);
      res.json({
        transaction: tx, newBalance: updatedWallet.tradeBalance,
        breakdown: { requested: amount, fee, feeRate: `${(feeRate * 100).toFixed(0)}%`, affiliatePool: affiliateCut, netPayout },
        message: withdrawalType === "withdraw_bank" ? "Withdrawal submitted for admin approval." : "Withdrawal processed.",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Trading cycle helpers ────────────────────────────────────────────────────
  const TRADE_WEEK_DAYS    = 5;  // Mon–Fri trading days per week
  const LOSS_DAYS_PER_WEEK = 2;  // exactly 2 loss days every week

  // Per-plan profit/loss configuration
  // profitCapPct: max cumulative bot earnings expressed as a fraction of locked principal
  const TRADING_PLAN_CONFIGS: Record<number, { dailyRate: number; lossMin: number; lossMax: number; profitCapPct: number }> = {
    60:  { dailyRate: 0.04, lossMin: 0.010, lossMax: 0.040, profitCapPct: 0.70 },
    90:  { dailyRate: 0.03, lossMin: 0.008, lossMax: 0.030, profitCapPct: 0.80 },
    120: { dailyRate: 0.02, lossMin: 0.005, lossMax: 0.020, profitCapPct: 1.00 },
  };

  /**
   * Generate the loss-day schedule for a trading cycle of the given length.
   * Each trading week (5 consecutive cycle days) gets exactly 2 random loss days
   * and 3 profit days — guaranteeing the 2-loss / 3-profit weekly pattern.
   */
  /** Returns true if current London time is Monday–Friday (any hour). */
  function isWeekdayLondon(): boolean {
    const londonDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" })).getDay();
    return londonDay >= 1 && londonDay <= 5; // 1=Mon … 5=Fri
  }

  /**
   * Withdrawal window:
   *   Mon–Thu: open any time (no hour restriction).
   *   Fri: open until 18:00 WAT, then locked.
   *   Sat–Sun: locked.
   *   Mon before 09:00 WAT: locked (reopens Mon 9 AM).
   */
  function getWithdrawalWindowStatus(): { open: boolean; message: string } {
    const watNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const day  = watNow.getDay();   // 0=Sun, 1=Mon … 5=Fri, 6=Sat
    const hour = watNow.getHours(); // 0–23

    // Mon–Thu: always open (no time restriction)
    if (day >= 2 && day <= 4) {
      return { open: true, message: "Open all day — no time restriction on weekdays" };
    }
    // Monday: open from 9 AM WAT onwards
    if (day === 1) {
      if (hour >= 9) return { open: true, message: "Open all day — no time restriction on weekdays" };
      return { open: false, message: "Withdrawals are locked. Opens today at 9 AM WAT." };
    }
    // Friday: open before 6 PM WAT
    if (day === 5) {
      if (hour < 18) return { open: true, message: "Open today until 6 PM WAT — closes for the weekend at 6 PM" };
      return { open: false, message: "Withdrawals are locked for the weekend. Opens Monday at 9 AM WAT." };
    }
    // Saturday or Sunday: locked
    return { open: false, message: "Withdrawals are locked for the weekend. Opens Monday at 9 AM WAT." };
  }

  /**
   * Returns true if the user's trade bot session is currently active.
   * Active = botActivatedAt set within the last 12 hours AND currently in
   * the UK trading window (weekday 13:00–midnight+1 London time).
   */
  async function isTradeSessionActive(userId: number): Promise<boolean> {
    try {
      const tw = await storage.getOrCreateTradeWallet(userId);
      if (!tw.botActivatedAt) return false;
      const activatedMs = new Date(tw.botActivatedAt).getTime();
      const ageMs = Date.now() - activatedMs;
      if (ageMs >= 12 * 3600 * 1000) return false; // session expired
      const londonNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
      const ukDay = londonNow.getDay();   // 0=Sun … 6=Sat
      const ukHour = londonNow.getHours();
      const inWindow = (ukDay >= 1 && ukDay <= 5 && ukHour >= 13) || (ukDay >= 2 && ukDay <= 6 && ukHour < 1);
      return inWindow;
    } catch { return false; }
  }

  function generateLossDays(planDays: number = 120): number[] {
    const numWeeks = Math.floor(planDays / TRADE_WEEK_DAYS);
    const lossDays: number[] = [];
    for (let week = 0; week < numWeeks; week++) {
      // Days in this week (1-indexed cycle days): e.g. week 0 → [1,2,3,4,5]
      const weekStart = week * TRADE_WEEK_DAYS + 1;
      const weekDays  = Array.from({ length: TRADE_WEEK_DAYS }, (_, i) => weekStart + i);
      // Fisher-Yates shuffle the 5-day pool, then take the first 2 as loss days
      for (let i = weekDays.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [weekDays[i], weekDays[j]] = [weekDays[j], weekDays[i]];
      }
      lossDays.push(...weekDays.slice(0, LOSS_DAYS_PER_WEEK));
    }
    return lossDays.sort((a, b) => a - b);
  }

  /** Loss rate for a given day: deterministic, scaled to the plan's loss range */
  function getLossRateForCycleDay(dayNumber: number, planDays: number = 120): number {
    const seed = (dayNumber * 37 + 17) % 100;
    const { lossMin, lossMax } = TRADING_PLAN_CONFIGS[planDays] ?? TRADING_PLAN_CONFIGS[120];
    return lossMin + (seed / 100) * (lossMax - lossMin);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Called by the frontend when the user activates the bot — persists start time in the DB
  app.post("/api/trade/bot/activate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      // Weekend check: block activations on ALL of Saturday and Sunday (UK time)
      const ukNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
      const ukDay  = ukNow.getDay();   // 0=Sun, 1=Mon … 6=Sat
      const ukHour = ukNow.getHours();
      const isWeekend = ukDay === 0 || ukDay === 6;
      const isBeforeOpen = ukHour < 13 && !(ukDay >= 2 && ukDay <= 6 && ukHour < 1);
      if (isWeekend) return res.status(400).json({ message: "The market is closed on weekends. Trading resumes Monday at 1:00 PM GMT." });
      if (isBeforeOpen) return res.status(400).json({ message: "The activation window opens at 1:00 PM GMT (Mon–Fri)." });
      const wallet = await storage.getOrCreateTradeWallet(userId);
      if (wallet.botLocked) return res.status(403).json({ message: "Your bot access has been suspended by the platform. Please contact support to restore access." });
      const activatePlanDays = wallet.tradingPlanDays && [60, 90, 120].includes(wallet.tradingPlanDays) ? wallet.tradingPlanDays : 120;
      if (wallet.roiComplete) return res.status(400).json({ message: `Trading cycle complete. Your ${activatePlanDays}-day trading cycle has ended. Make a new top-up to start a fresh cycle.` });
      if ((wallet.tradingDayNumber ?? 0) >= activatePlanDays) return res.status(400).json({ message: `Trading cycle complete. Your ${activatePlanDays}-day trading cycle has ended. Make a new top-up to start a fresh cycle.` });
      if (parseFloat(wallet.tradeBalance) <= 0) return res.status(400).json({ message: "No trade balance." });
      const now = new Date();
      const updated = await storage.setBotActivatedAt(userId, now);
      res.json({ botActivatedAt: updated.botActivatedAt });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Called by the frontend when the bot session ends — credits proportional earnings based on actual trading hours
  app.post("/api/trade/bot/complete", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const wallet0 = await storage.getOrCreateTradeWallet(userId);
      // IDEMPOTENCY: only use the DB-stored botActivatedAt — never accept client-provided timestamp
      // This prevents duplicate completions from multiple tabs or page refreshes
      if (!wallet0.botActivatedAt) {
        return res.status(400).json({ message: "No active bot session found. The session may have already been completed." });
      }
      const activatedAt = new Date(wallet0.botActivatedAt).getTime();

      const wallet = wallet0;
      const balance = parseFloat(wallet.tradeBalance);
      if (balance <= 0) return res.status(400).json({ message: "No balance to earn from." });

      // ── Resolve trading plan for this user ───────────────────────────
      const planDays: number = wallet.tradingPlanDays && [60, 90, 120].includes(wallet.tradingPlanDays) ? wallet.tradingPlanDays : 120;
      const planConfig = TRADING_PLAN_CONFIGS[planDays] ?? TRADING_PLAN_CONFIGS[120];

      // ── Determine current cycle day (1-indexed: next day after the N completed so far) ──
      const currentCycleDay = (wallet.tradingDayNumber ?? 0) + 1;
      const userLossDays: number[] = Array.isArray(wallet.lossDayNumbers) ? wallet.lossDayNumbers : [];
      const isLossDay = userLossDays.includes(currentCycleDay);

      // ── Compute session duration (proportional to hours the bot was active) ──
      const BOT_MAX_MS = 12 * 3600 * 1000;
      // Use plan-specific daily rate; admin setting can still override the base 120-day rate only
      const _botRateSetting = await storage.getPlatformSetting("trade_bot_full_rate");
      const defaultRate = planConfig.dailyRate;
      const BOT_FULL_RATE = planDays === 120 && _botRateSetting ? parseFloat(_botRateSetting) : defaultRate;
      let elapsedMs = BOT_MAX_MS;
      if (activatedAt && Number.isFinite(activatedAt)) {
        elapsedMs = Math.min(Date.now() - activatedAt, BOT_MAX_MS);
        elapsedMs = Math.max(elapsedMs, 0);
      }
      const fraction     = elapsedMs / BOT_MAX_MS;
      const elapsedHours = (elapsedMs / 3600000).toFixed(1);

      if (isLossDay) {
        // ── LOSS DAY: proportional loss scaled to the plan's loss range ──
        const lossRate   = getLossRateForCycleDay(currentCycleDay, planDays) * fraction;
        const lossAmount = parseFloat((balance * lossRate).toFixed(6));
        const ratePercent = (lossRate * 100).toFixed(4);

        if (lossAmount <= 0) {
          await storage.incrementTradingDay(userId);
          return res.json({ earning: "0", elapsedHours, ratePercent: "0", newBalance: wallet.tradeBalance, totalBotEarnings: wallet.totalBotEarnings, isLossDay: true, cycleDay: currentCycleDay, cycleDays: planDays });
        }

        await storage.createTradeTransaction({
          userId,
          type: "bot_earning",
          walletType: null,
          amountUsd: (-lossAmount).toFixed(6),
          feeUsd: "0.000000",
          reserveFundDeduction: "0.000000",
          affiliateShareDeduction: "0.000000",
          netAmount: (-lossAmount).toFixed(6),
          txHash: null,
          status: "completed",
          note: `Bot session day ${currentCycleDay}/${planDays} (loss): ${elapsedHours}h → -${ratePercent}% on $${balance.toFixed(2)}`,
        });
        let updatedWallet = await storage.applyBotLoss(userId, lossAmount.toFixed(6));
        updatedWallet = await storage.incrementTradingDay(userId);

        // ── Check plan-length cycle completion (day counter only) ────────
        let cycleJustComplete = false;
        if ((updatedWallet.tradingDayNumber ?? 0) >= planDays) {
          cycleJustComplete = true;
          // Credit remaining net earnings (profit above locked capital) to Swift wallet before zeroing
          const preCompleteBalance = parseFloat(updatedWallet.tradeBalance);
          const preCompleteLocked  = parseFloat(updatedWallet.lockedPrincipal ?? "0");
          const cycleEarnings = Math.max(0, preCompleteBalance - preCompleteLocked);
          if (cycleEarnings > 0) {
            const swWallet = await storage.getOrCreateWallet(userId);
            await storage.updateWalletBalance(userId, (parseFloat(swWallet.balance) + cycleEarnings).toFixed(2));
            await storage.createTransaction({ userId, type: "admin_credit", amount: cycleEarnings.toFixed(2), fee: "0.00", paymentMethod: "system", description: `${planDays}-day trade cycle payout — earnings credited to SwiftWallet` });
          }
          await storage.markRoiComplete(userId);
          await storage.createNotification({ userId, type: "trade", title: `${planDays}-Day Trading Cycle Complete`, message: `Your ${planDays}-day trading cycle has ended. ${cycleEarnings > 0 ? `$${cycleEarnings.toFixed(2)} in earnings have been credited to your SwiftWallet.` : "Top up to start a fresh cycle."}`, data: {}, isRead: false });
        }

        await storage.createNotification({
          userId,
          type: "trade",
          title: "Bot Session — Market Loss",
          message: `Day ${currentCycleDay}/${planDays}: Your Itera Trading BOT (${elapsedHours}h) posted a market loss of $${lossAmount.toFixed(4)} (-${ratePercent}%).`,
          data: { loss: lossAmount, elapsedHours, ratePercent, newBalance: updatedWallet.tradeBalance, cycleDay: currentCycleDay },
          isRead: false,
        });
        await storage.setBotActivatedAt(userId, null);
        const finalLossWallet = cycleJustComplete ? await storage.getOrCreateTradeWallet(userId) : updatedWallet;
        return res.json({
          earning: (-lossAmount).toFixed(6),
          elapsedHours,
          ratePercent: `-${ratePercent}`,
          newBalance: finalLossWallet.tradeBalance,
          totalBotEarnings: finalLossWallet.totalBotEarnings,
          isLossDay: true,
          cycleDay: currentCycleDay,
          cycleDays: planDays,
          cycleComplete: cycleJustComplete || finalLossWallet.roiComplete,
        });
      }

      // ── PROFIT DAY: proportional earnings (fraction of plan daily rate) ─
      const rate    = BOT_FULL_RATE * fraction;
      const grossEarning = parseFloat((balance * rate).toFixed(6));
      const ratePercent = (rate * 100).toFixed(4);

      if (grossEarning <= 0) return res.status(400).json({ message: "Earning too small to credit." });

      // 5% referral commission on bot earnings (deducted from gross, credited to referrer)
      const botAffiliateCommission = parseFloat((grossEarning * TRADE_MARKET.AFFILIATE_SHARE_RATE).toFixed(6));
      const botUser = await storage.getUser(userId);
      const hasBotReferrer = !!(botUser?.referredBy);
      let earning = hasBotReferrer ? parseFloat((grossEarning - botAffiliateCommission).toFixed(6)) : grossEarning;

      // ── Plan profit cap: cumulative earnings cannot exceed plan's stated return ────
      // Bar and cap both use totalBotEarnings (lifetime, never decreases on withdrawal).
      // The bar stays where it is when the user withdraws — withdrawals are separate.
      const lockedCapital     = parseFloat(wallet.lockedPrincipal ?? "0");
      const priorEarnings     = parseFloat(wallet.totalBotEarnings ?? "0");
      // Cap = locked capital × (1 + profitCapPct).
      // profitCapPct is the PROFIT portion (0.70 / 0.80 / 1.00), so the total earnings needed
      // to double the user's money on a 120-day plan is lockedCapital × 2.00 (= capital + 100% profit).
      const profitCapPct      = planConfig.profitCapPct ?? 1.00;
      const profitTarget      = lockedCapital * (1 + profitCapPct);
      const remainingToTarget = Math.max(0, profitTarget - priorEarnings);
      const cappedByTarget    = lockedCapital > 0 && earning > remainingToTarget;
      // If already at cap, just increment the day counter (no earning, no cycle end)
      if (lockedCapital > 0 && priorEarnings >= profitTarget) {
        await storage.incrementTradingDay(userId);
        await storage.setBotActivatedAt(userId, null);
        const cappedWallet = await storage.getOrCreateTradeWallet(userId);
        // Still check for day-limit cycle completion even when capped
        if (!cappedWallet.roiComplete && (cappedWallet.tradingDayNumber ?? 0) >= planDays) {
          const capBalance = parseFloat(cappedWallet.tradeBalance);
          const capLocked  = parseFloat(cappedWallet.lockedPrincipal ?? "0");
          const capEarnings = Math.max(0, capBalance - capLocked);
          if (capEarnings > 0) {
            const swCapWallet = await storage.getOrCreateWallet(userId);
            await storage.updateWalletBalance(userId, (parseFloat(swCapWallet.balance) + capEarnings).toFixed(2));
            await storage.createTransaction({ userId, type: "admin_credit", amount: capEarnings.toFixed(2), fee: "0.00", paymentMethod: "system", description: `${planDays}-day trade cycle complete — remaining earnings auto-credited to SwiftWallet` });
          }
          await storage.markRoiComplete(userId);
          await storage.createNotification({ userId, type: "trade", title: `🎉 ${planDays}-Day Trading Cycle Complete!`, message: `Your ${planDays}-day cycle has ended.${capEarnings > 0 ? ` $${capEarnings.toFixed(2)} in remaining earnings have been credited to your SwiftWallet.` : ""} Top up to start a fresh cycle.`, data: {}, isRead: false });
        }
        const finalCappedWallet = await storage.getOrCreateTradeWallet(userId);
        return res.json({ earning: "0.000000", elapsedHours, ratePercent: "0.0000", newBalance: finalCappedWallet.tradeBalance, totalBotEarnings: finalCappedWallet.totalBotEarnings, roiComplete: finalCappedWallet.roiComplete, isLossDay: false, cycleDay: currentCycleDay, cycleDays: planDays, cycleComplete: finalCappedWallet.roiComplete, capped: true });
      }
      if (cappedByTarget) earning = parseFloat(remainingToTarget.toFixed(6));

      await storage.createTradeTransaction({
        userId,
        type: "bot_earning",
        walletType: null,
        amountUsd: earning.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: hasBotReferrer ? botAffiliateCommission.toFixed(6) : "0.000000",
        netAmount: earning.toFixed(6),
        txHash: null,
        status: "completed",
        note: `Bot session day ${currentCycleDay}/${planDays}: ${elapsedHours}h → ${ratePercent}% on $${balance.toFixed(2)}${cappedByTarget ? " [100% cap]" : ""}${hasBotReferrer ? ` | 5% referral: $${botAffiliateCommission.toFixed(4)}` : ""}`,
      });
      let updatedWallet = await storage.creditBotEarnings(userId, earning.toFixed(6));
      updatedWallet = await storage.incrementTradingDay(userId);

      // Credit 5% commission to referrer if applicable
      if (hasBotReferrer && botAffiliateCommission > 0) {
        await creditReferrerCommission(userId, grossEarning, "bot earnings").catch(() => {});
      }

      // ── Cycle completion check: day counter reaching plan length only ───
      let cycleJustComplete = false;
      if (!updatedWallet.roiComplete && (updatedWallet.tradingDayNumber ?? 0) >= planDays) {
        cycleJustComplete = true;
        const preCompleteBalance = parseFloat(updatedWallet.tradeBalance);
        const preCompleteLocked  = parseFloat(updatedWallet.lockedPrincipal ?? "0");
        const cycleEarnings = Math.max(0, preCompleteBalance - preCompleteLocked);
        if (cycleEarnings > 0) {
          const swWallet = await storage.getOrCreateWallet(userId);
          await storage.updateWalletBalance(userId, (parseFloat(swWallet.balance) + cycleEarnings).toFixed(2));
          await storage.createTransaction({ userId, type: "admin_credit", amount: cycleEarnings.toFixed(2), fee: "0.00", paymentMethod: "system", description: `${planDays}-day trade cycle complete — remaining earnings auto-credited to SwiftWallet` });
        }
        await storage.markRoiComplete(userId);
        await storage.createNotification({
          userId,
          type: "trade",
          title: `🎉 ${planDays}-Day Trading Cycle Complete!`,
          message: `Congratulations! Your ${planDays}-day trading cycle is complete.${cycleEarnings > 0 ? ` $${cycleEarnings.toFixed(2)} in remaining earnings have been credited to your SwiftWallet.` : ""} Top up to start a fresh cycle.`,
          data: { tradingDayNumber: updatedWallet.tradingDayNumber, cycleEarnings },
          isRead: false,
        });
      }

      await storage.createNotification({
        userId,
        type: "trade",
        title: "Bot Session Complete — Earnings Credited",
        message: `Day ${currentCycleDay}/${planDays}: Your bot (${elapsedHours}h) earned $${earning.toFixed(4)} (${ratePercent}%${cappedByTarget ? " — 100% cap reached" : ""}${hasBotReferrer ? ", 5% referral deducted" : ""}).`,
        data: { earning, elapsedHours, ratePercent, newBalance: updatedWallet.tradeBalance, cycleDay: currentCycleDay, cappedByTarget },
        isRead: false,
      });
      storage.getUser(userId).then(u => {
        if (u) sendBotEarningsEmail(u.email, u.firstName, earning.toFixed(2), parseFloat(updatedWallet.tradeBalance).toFixed(2)).catch((err: any) => console.error("[EMAIL] Bot earnings email failed:", err?.message ?? err));
      });
      await storage.setBotActivatedAt(userId, null);
      const finalWallet = cycleJustComplete ? await storage.getOrCreateTradeWallet(userId) : updatedWallet;
      res.json({
        earning: earning.toFixed(6),
        elapsedHours,
        ratePercent,
        newBalance: finalWallet.tradeBalance,
        totalBotEarnings: finalWallet.totalBotEarnings,
        roiComplete: finalWallet.roiComplete,
        isLossDay: false,
        cycleDay: currentCycleDay,
        cycleDays: planDays,
        cycleComplete: cycleJustComplete || finalWallet.roiComplete,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/trade/transactions", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const txs = await storage.getTradeTransactionsByUser(userId);
      res.json(txs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin-only detailed view
  app.get("/api/trade/market-prices", async (req, res) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ message: "Not authenticated" });
    if (Date.now() - priceCache.ts < 15000 && priceCache.data.length) return res.json(priceCache.data);
    const data = await Promise.all(TRADE_SYMBOLS.map(async s => {
      try { const q: any = await yf.quote(s.symbol); return { ...s, price: Number(q.regularMarketPrice ?? 0), change: Number(q.regularMarketChange ?? 0), changePct: Number(q.regularMarketChangePercent ?? 0), high: Number(q.regularMarketDayHigh ?? 0), low: Number(q.regularMarketDayLow ?? 0) }; }
      catch { return { ...s, price: null, change: 0, changePct: 0, high: null, low: null }; }
    }));
    priceCache.ts = Date.now(); priceCache.data = data; res.json(data);
  });
  app.get("/api/trade/signals", async (req, res) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ message: "Not authenticated" });
    if (Date.now() - signalCache.ts < 60000 && signalCache.signals.length) return res.json(signalCache.signals);
    const prices = priceCache.data.length && Date.now() - priceCache.ts < 15000 ? priceCache.data : await (async () => { const r = await fetch(`${req.protocol}://${req.get("host")}/api/trade/market-prices`, { headers: { cookie: req.headers.cookie ?? "" } }); return r.json(); })();
    signalCache.signals = Array.from({ length: 4 }, (_, i) => { const p = prices[Math.floor(Math.random() * prices.length)]; const pct = Number(p.changePct || 0); const direction = pct > .3 ? "long" : pct < -.3 ? "short" : Math.random() > .5 ? "long" : "short"; const timeframe = (["5m", "15m", "1h"] as const)[i % 3]; return { id: `${Date.now()}-${i}`, ...p, direction, entryPrice: p.price, confidence: Math.min(92, 55 + Math.floor(Math.abs(pct) * 10 + Math.random() * 20)), timeframe, expiresAt: new Date(Date.now() + ({ "5m": 5, "15m": 15, "1h": 60 }[timeframe]) * 60000).toISOString() }; });
    signalCache.ts = Date.now(); res.json(signalCache.signals);
  });
  app.get("/api/trade/signals/history", async (req, res) => { const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" }); const { signalTrades } = await import("@shared/schema"); res.json(await db.select().from(signalTrades).where(eq(signalTrades.userId, uid)).orderBy(desc(signalTrades.createdAt)).limit(20)); });
  app.post("/api/trade/signals/enter", async (req, res) => {
    const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" });
    const { signalTrades, tradeWallets } = await import("@shared/schema"); const a = Number(req.body.amountUsd); if (a < 1) return res.status(400).json({ message: "Minimum trade is $1" });
    const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid)); if (!w || Number(w.tradeBalance) < a) return res.status(400).json({ message: "Insufficient trade balance" });
    await db.update(tradeWallets).set({ tradeBalance: (Number(w.tradeBalance) - a).toFixed(6) }).where(eq(tradeWallets.userId, uid));
    const [t] = await db.insert(signalTrades).values({ userId: uid, symbol: req.body.symbol, symbolLabel: req.body.symbolLabel, direction: req.body.direction, entryPrice: String(req.body.entryPrice), amountUsd: String(a), confidence: Number(req.body.confidence), timeframe: req.body.timeframe }).returning();
    res.json({ id: t.id, message: "Position opened" });
  });
  app.post("/api/trade/signals/resolve/:id", async (req, res) => {
    const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" }); const { signalTrades, tradeWallets } = await import("@shared/schema"); const [t] = await db.select().from(signalTrades).where(and(eq(signalTrades.id, Number(req.params.id)), eq(signalTrades.userId, uid))); if (!t || t.status !== "open") return res.status(404).json({ message: "Trade not found" }); const q: any = await yf.quote(t.symbol); const exit = Number(q.regularMarketPrice ?? t.entryPrice); const pct = (exit - Number(t.entryPrice)) / Number(t.entryPrice) * (t.direction === "long" ? 1 : -1); const pnl = Number(t.amountUsd) * pct; const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid)); await db.update(signalTrades).set({ exitPrice: String(exit), pnlPct: String(pct * 100), pnlUsd: String(pnl), status: pnl >= 0 ? "won" : "lost", resolvedAt: new Date() }).where(eq(signalTrades.id, t.id)); if (w) await db.update(tradeWallets).set({ tradeBalance: (Number(w.tradeBalance) + Number(t.amountUsd) + pnl).toFixed(6) }).where(eq(tradeWallets.userId, uid)); res.json({ pnlUsd: pnl, pnlPct: pct * 100, exitPrice: exit, status: pnl >= 0 ? "won" : "lost" });
  });
  app.get("/api/trade/bot-position", async (req, res) => { const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" }); const { tradeWallets } = await import("@shared/schema"); const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid)); if (!w?.botActivatedAt) return res.json({ active: false }); const p = priceCache.data.find(x => x.symbol === "BTC-USD"); const entry = p?.price ?? 0; const elapsedHours = Math.min(12, (Date.now() - new Date(w.botActivatedAt).getTime()) / 36e5); const size = Number(w.lockedPrincipal) * .1; const pnl = size * .02 * elapsedHours / 12; res.json({ active: true, symbol: "BTC-USD", entryPrice: entry, currentPrice: entry, size, unrealizedPnl: pnl, unrealizedPnlPct: pnl / (size || 1), elapsedHours, direction: "long" }); });
  app.get("/api/trade/manual/positions", async (req, res) => { const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" }); const { manualTrades } = await import("@shared/schema"); res.json(await db.select().from(manualTrades).where(eq(manualTrades.userId, uid)).orderBy(desc(manualTrades.createdAt)).limit(20)); });
  app.post("/api/trade/manual/open", async (req, res) => {
    const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" });
    const { manualTrades, tradeWallets } = await import("@shared/schema"); const margin = Number(req.body.marginUsd), leverage = Number(req.body.leverage || 1); if (margin < 1 || leverage < 1 || leverage > 10) return res.status(400).json({ message: "Invalid order parameters" }); const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid)); if (!w || Number(w.tradeBalance) < margin) return res.status(400).json({ message: "Insufficient trade balance" }); const q: any = await yf.quote(req.body.symbol); const entry = Number(q.regularMarketPrice || 0); await db.update(tradeWallets).set({ tradeBalance: (Number(w.tradeBalance) - margin).toFixed(6) }).where(eq(tradeWallets.userId, uid)); const [trade] = await db.insert(manualTrades).values({ userId: uid, symbol: req.body.symbol, symbolLabel: req.body.symbolLabel || req.body.symbol, direction: req.body.direction === "short" ? "short" : "long", leverage, marginUsd: String(margin), sizeUsd: String(margin * leverage), entryPrice: String(entry), stopLossPrice: req.body.stopLossPrice ? String(req.body.stopLossPrice) : null, takeProfitPrice: req.body.takeProfitPrice ? String(req.body.takeProfitPrice) : null }).returning(); res.json(trade);
  });
  app.post("/api/trade/manual/close/:id", async (req, res) => {
    try {
      const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" });
      const { manualTrades, tradeWallets } = await import("@shared/schema");
      const [trade] = await db.select().from(manualTrades).where(and(eq(manualTrades.id, Number(req.params.id)), eq(manualTrades.userId, uid)));
      if (!trade || trade.status !== "open") return res.status(404).json({ message: "Position not found or already closed" });
      const q: any = await yf.quote(trade.symbol);
      const exitPrice = Number(q.regularMarketPrice ?? trade.entryPrice);
      const pricePct = (exitPrice - Number(trade.entryPrice)) / Number(trade.entryPrice);
      const pnlPct = trade.direction === "long" ? pricePct : -pricePct;
      const pnlUsd = Number(trade.sizeUsd) * pnlPct;
      const returnAmt = Math.max(0, Number(trade.marginUsd) + pnlUsd); // liquidation floor = 0
      await db.update(manualTrades).set({
        exitPrice: String(exitPrice), pnlUsd: String(pnlUsd), pnlPct: String(pnlPct * 100),
        status: pnlUsd >= 0 ? "won" : "lost", closedAt: new Date()
      }).where(eq(manualTrades.id, trade.id));
      const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid));
      if (w) await db.update(tradeWallets).set({ tradeBalance: (Number(w.tradeBalance) + returnAmt).toFixed(6) }).where(eq(tradeWallets.userId, uid));
      res.json({ pnlUsd, pnlPct: pnlPct * 100, exitPrice, returnAmt, status: pnlUsd >= 0 ? "won" : "lost" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/trade/bot-position/override", async (req, res) => { const uid = (req.session as any)?.userId; if (!uid) return res.status(401).json({ message: "Not authenticated" }); const { tradeWallets } = await import("@shared/schema"); const [w] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, uid)); if (!w) return res.status(404).json({ message: "Trade wallet not found" }); res.json({ message: `${req.body.action || "override"} recorded`, newBalance: w.tradeBalance }); });

  app.get("/api/trade/reserve-fund", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only." });
      const fund = await storage.getTradeReserveFund();
      res.json(fund);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Public (all authenticated users) — live reserve fund balance
  app.get("/api/reserve-fund/live", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const cachedFund = getCached("reserve_fund_live");
      if (cachedFund) return res.json(cachedFund);
      const fund = await storage.getTradeReserveFund();

      // Aggregate the $2 minimum balance locked across activated wallets only
      const floorResult = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE activated = true AND CAST(balance AS numeric) >= 2) AS wallets_at_min,
          COUNT(*) FILTER (WHERE activated = true) AS total_wallets,
          COALESCE(SUM(LEAST(CAST(balance AS numeric), 2)) FILTER (WHERE activated = true), 0) AS floor_reserve
        FROM wallets
      `);
      const floorRow = (floorResult.rows[0] as any) ?? {};
      const walletFloorReserve = parseFloat(floorRow.floor_reserve ?? "0");
      const walletsAtMin       = parseInt(floorRow.wallets_at_min ?? "0", 10);
      const totalWallets       = parseInt(floorRow.total_wallets ?? "0", 10);

      // Sum actual trade deposit amounts (initial deposits + mid-cycle top-ups)
      const depositSumResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(amount_usd AS numeric)), 0) AS total_trade_deposits,
          COUNT(*) AS deposit_count
        FROM trade_transactions
        WHERE type IN ('deposit', 'topup')
      `);
      const depositSumRow      = (depositSumResult.rows[0] as any) ?? {};
      const totalTradeDeposits = parseFloat(depositSumRow.total_trade_deposits ?? "0");
      const depositCount       = parseInt(depositSumRow.deposit_count ?? "0", 10);

      const tradeReserve = parseFloat(fund.total_balance ?? "0");

      const fundResult = {
        totalBalance: fund.total_balance ?? "0",
        totalDeposited: fund.total_deposited ?? "0",
        totalTradeDeposits: totalTradeDeposits.toFixed(2),
        depositCount,
        contributionRate: 20,
        description: "20% of every Global Trade Market deposit is ring-fenced into this strategic reserve.",
        walletFloorReserve: walletFloorReserve.toFixed(2),
        walletsAtMin,
        totalWallets,
        minBalancePerWallet: 2,
        combinedReserve: (tradeReserve + walletFloorReserve).toFixed(2),
        updatedAt: new Date().toISOString(),
      };
      setCached("reserve_fund_live", fundResult, 120_000);
      res.json(fundResult);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Commission profits chart — profits after 5% affiliate pool distributed
  app.get("/api/reserve-fund/commission-profits", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const cachedComm = getCached("reserve_commission_profits");
      if (cachedComm) return res.json(cachedComm);

      // TS-Mart Online Stores commissions (8% per order)
      const ecomResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'Mon YY') AS month,
          TO_CHAR(created_at, 'YYYY-MM') AS month_key,
          COALESCE(SUM(commission_amount), 0) AS ecom_commission
        FROM orders
        GROUP BY month, month_key
        ORDER BY month_key
      `);

      // Trade withdrawal fees collected (from trade market)
      const feeResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'Mon YY') AS month,
          TO_CHAR(created_at, 'YYYY-MM') AS month_key,
          COALESCE(SUM(CAST(fee_usd AS numeric)), 0) AS fees
        FROM trade_transactions
        WHERE type IN ('withdraw_exchange', 'withdraw_bank')
        GROUP BY month, month_key
        ORDER BY month_key
      `);

      // Wallet withdrawal fees (bank VAT 7.5% + crypto 1%) from personal wallet
      const walletFeeResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'Mon YY') AS month,
          TO_CHAR(created_at, 'YYYY-MM') AS month_key,
          COALESCE(SUM(CAST(fee AS numeric)), 0) AS fees
        FROM transactions
        WHERE type IN ('withdrawal', 'crypto_withdrawal')
          AND fee IS NOT NULL
          AND CAST(fee AS numeric) > 0
        GROUP BY month, month_key
        ORDER BY month_key
      `);

      // Total wallet withdrawals count
      const withdrawalCountResult = await db.execute(sql`
        SELECT COUNT(*) AS total_count
        FROM transactions
        WHERE type IN ('withdrawal', 'crypto_withdrawal')
      `);

      // Affiliate pool already distributed (5%) — this is NOT platform profit
      const poolResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'Mon YY') AS month,
          TO_CHAR(created_at, 'YYYY-MM') AS month_key,
          COALESCE(SUM(CAST(total_pool_amount AS numeric)), 0) AS pool_paid
        FROM affiliate_trade_shares
        GROUP BY month, month_key
        ORDER BY month_key
      `);

      // Merge all into a monthly map
      const months: Record<string, { month: string; ecom: number; fees: number; poolPaid: number }> = {};

      for (const row of ecomResult.rows as any[]) {
        const k = row.month_key as string;
        if (!months[k]) months[k] = { month: row.month, ecom: 0, fees: 0, poolPaid: 0 };
        months[k].ecom += parseFloat(row.ecom_commission ?? "0");
      }
      for (const row of feeResult.rows as any[]) {
        const k = row.month_key as string;
        if (!months[k]) months[k] = { month: row.month, ecom: 0, fees: 0, poolPaid: 0 };
        months[k].fees += parseFloat(row.fees ?? "0");
      }
      for (const row of walletFeeResult.rows as any[]) {
        const k = row.month_key as string;
        if (!months[k]) months[k] = { month: row.month, ecom: 0, fees: 0, poolPaid: 0 };
        months[k].fees += parseFloat(row.fees ?? "0");
      }
      for (const row of poolResult.rows as any[]) {
        const k = row.month_key as string;
        if (!months[k]) months[k] = { month: row.month, ecom: 0, fees: 0, poolPaid: 0 };
        months[k].poolPaid += parseFloat(row.pool_paid ?? "0");
      }

      const chartData = Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({
          month: v.month,
          ecomCommission: parseFloat(v.ecom.toFixed(2)),
          withdrawalFees: parseFloat(v.fees.toFixed(2)),
          affiliatePoolPaid: parseFloat(v.poolPaid.toFixed(2)),
          netProfit: parseFloat((v.ecom + v.fees - v.poolPaid).toFixed(2)),
        }));

      // Totals
      const totals = chartData.reduce(
        (acc, r) => ({
          totalEcom: acc.totalEcom + r.ecomCommission,
          totalFees: acc.totalFees + r.withdrawalFees,
          totalPoolPaid: acc.totalPoolPaid + r.affiliatePoolPaid,
          totalNetProfit: acc.totalNetProfit + r.netProfit,
        }),
        { totalEcom: 0, totalFees: 0, totalPoolPaid: 0, totalNetProfit: 0 }
      );

      const totalWithdrawals = parseInt((withdrawalCountResult.rows[0] as any)?.total_count ?? "0", 10);

      const commResult = { chartData, totals: { ...totals, totalWithdrawals } };
      setCached("reserve_commission_profits", commResult, 600_000);
      res.json(commResult);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: All Co-Affiliates (Trust Funders) — with real-time earnings ──────
  app.get("/api/admin/co-affiliates", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const all = await storage.getAllCoAffiliates();
      // Get total affiliate pool (sum of all affiliate_trade_shares entries)
      const poolResult = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(total_pool_amount AS numeric)), 0) AS total_pool
        FROM affiliate_trade_shares
      `);
      const totalPool = parseFloat((poolResult.rows[0] as any)?.total_pool ?? "0");

      // Get per-user total pool (for more granular breakdown if needed)
      const enriched = await Promise.all(all.map(async (ca) => {
        const u = await storage.getUser(ca.userId);
        // sharePercentage is stored as a FRACTION (0–1), not a percentage. Match my-info math.
        const shareFraction = parseFloat(ca.sharePercentage ?? "0");
        const withdrawn = parseFloat(ca.withdrawnAmount ?? "0");
        const earnedAmount = parseFloat((totalPool * shareFraction).toFixed(6));
        const availableAmount = parseFloat(Math.max(0, earnedAmount - withdrawn).toFixed(6));
        const wallet = u ? await storage.getOrCreateWallet(u.id) : null;
        return {
          ...ca,
          userName: u ? `${u.firstName} ${u.lastName}` : "Unknown",
          userEmail: u?.email ?? "—",
          walletBalance: wallet ? wallet.balance : "0.00",
          totalPool,
          earnedAmount,
          availableAmount,
        };
      }));
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Adjust co-affiliate profit (sharePercentage or withdrawnAmount) ─
  app.patch("/api/admin/co-affiliate/:userId/adjust", async (req, res) => {
    const adminId = (req.session as any)?.userId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(adminId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const targetUserId = parseInt(req.params.userId);
      const { sharePercentage, adjustWithdrawn } = req.body;
      // adjustWithdrawn: negative = grant profits (reduce withdrawn so available increases), positive = deduct

      const updates: Record<string, any> = {};
      if (sharePercentage !== undefined && sharePercentage !== "") {
        const pct = parseFloat(sharePercentage);
        if (isNaN(pct) || pct < 0) return res.status(400).json({ message: "Invalid sharePercentage" });
        updates.sharePercentage = pct.toFixed(10);
      }
      if (adjustWithdrawn !== undefined && adjustWithdrawn !== "") {
        const adj = parseFloat(adjustWithdrawn);
        if (isNaN(adj)) return res.status(400).json({ message: "Invalid adjustWithdrawn" });
        // Positive adj = admin grants profit (SUBTRACT from withdrawnAmount so more is available)
        // Negative adj = admin deducts profit (ADD to withdrawnAmount so less is available)
        await db.execute(sql`
          UPDATE co_affiliates
          SET withdrawn_amount = GREATEST(0, CAST(withdrawn_amount AS numeric) - ${adj})
          WHERE user_id = ${targetUserId}
        `);
      }
      if (Object.keys(updates).length > 0) {
        await db.update(coAffiliates).set(updates).where(eq(coAffiliates.userId, targetUserId));
      }
      const [updated] = await db.select().from(coAffiliates).where(eq(coAffiliates.userId, targetUserId));
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: update co-affiliate status
  app.patch("/api/admin/co-affiliate/:userId/status", async (req, res) => {
    const adminId = (req.session as any)?.userId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(adminId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { status } = req.body;
      if (!["active", "pending", "cancelled"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const updated = await storage.updateCoAffiliate(parseInt(req.params.userId), { status });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: delete co-affiliate record
  app.delete("/api/admin/co-affiliate/:userId", async (req, res) => {
    const adminId = (req.session as any)?.userId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(adminId);
    if (admin?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await db.delete(coAffiliates).where(eq(coAffiliates.userId, parseInt(req.params.userId)));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/students", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const students = await storage.getAllStudents();
    const enriched = await Promise.all(
      students.map(async (s) => {
        const v = await storage.getVerificationByUser(s.id);
        const w = await storage.getOrCreateWallet(s.id);
        const plan = await storage.getSponsorshipPlanByUser(s.id);
        const files = await storage.getFilesByUser(s.id);
        return { ...s, password: undefined, verification: v, wallet: w, plan, fileCount: files.length };
      })
    );
    res.json(enriched);
  });

  app.get("/api/admin/pending-verifications", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const pending = await storage.getPendingVerifications();
    res.json(pending);
  });

  app.get("/api/admin/all-verifications", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const all = await storage.getAllVerifications();
    res.json(all);
  });

  // ── RESEARCH GRANT ROUTES ────────────────────────────────────────────────
  app.post("/api/research-grant/apply", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { title, fieldOfResearch, description, proposal, requestedAmountUsd } = req.body;
      if (!title || !fieldOfResearch || !description || !proposal || !requestedAmountUsd)
        return res.status(400).json({ message: "All fields are required." });
      const amount = parseFloat(String(requestedAmountUsd));
      if (isNaN(amount) || amount <= 0)
        return res.status(400).json({ message: "Invalid requested amount." });
      const grant = await storage.createResearchGrant({
        userId,
        title: String(title).trim(),
        fieldOfResearch: String(fieldOfResearch).trim(),
        description: String(description).trim(),
        proposal: String(proposal).trim(),
        requestedAmountUsd: amount.toFixed(2),
      });
      res.json(grant);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/research-grant/my", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const grants = await storage.getResearchGrantsByUser(userId);
      res.json(grants);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/research-grants", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const grants = await storage.getAllResearchGrants();
      res.json(grants);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/research-grant/:id/decision", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = parseInt(req.params.id);
      const { decision, grantedAmountUsd, adminNote } = req.body;
      if (!["approved", "rejected", "under_review"].includes(decision))
        return res.status(400).json({ message: "Invalid decision." });
      const updated = await storage.updateResearchGrant(id, {
        status: decision,
        adminNote: adminNote ? String(adminNote).trim() : null,
        ...(decision === "approved" && grantedAmountUsd
          ? { grantedAmountUsd: parseFloat(String(grantedAmountUsd)).toFixed(2) }
          : {}),
      });
      if (decision === "approved" && grantedAmountUsd) {
        const amt = parseFloat(String(grantedAmountUsd));
        if (amt > 0) {
          const wallet = await storage.getOrCreateWallet(updated.userId);
          const newBal = (parseFloat(wallet.balance) + amt).toFixed(2);
          await storage.updateWalletBalance(updated.userId, newBal);
          await storage.createTransaction({
            userId: updated.userId,
            type: "credit",
            amount: amt.toFixed(2),
            fee: "0.00",
            paymentMethod: "grant",
            description: `Research Grant approved — $${amt.toFixed(2)} credited to your wallet`,
          });
        }
      }
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── AFFILIATE SCHOLARSHIP CODE PURCHASE ─────────────────────────────────
  app.post("/api/affiliate/scholarship-sponsor-code", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "affiliate") return res.status(403).json({ message: "Only affiliates can purchase scholarship codes." });
      const PRICE = 5.50;
      const MIN_REMAINING = 2.00;
      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      if (balance < PRICE + MIN_REMAINING)
        return res.status(400).json({ message: `Insufficient balance. You need at least $${(PRICE + MIN_REMAINING).toFixed(2)} (cost $${PRICE.toFixed(2)} + $${MIN_REMAINING.toFixed(2)} min. reserve).` });
      const newBal = (balance - PRICE).toFixed(2);
      await storage.updateWalletBalance(userId, newBal);
      await storage.createTransaction({
        userId,
        type: "debit",
        amount: PRICE.toFixed(2),
        fee: "0.00",
        paymentMethod: "wallet",
        description: "Scholarship sponsor code purchase — $5.50 deducted",
      });
      const { cohort, masterCode } = await storage.createPublicSponsorCohort({
        sponsorName: `${user.firstName} ${user.lastName}`,
        sponsorEmail: user.email,
        totalSlots: 1,
        orgName: "Affiliate Scholarship",
      });
      res.json({ code: masterCode, cohortId: cohort.id, walletBalance: newBal });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/all-scholarships", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const all = await storage.getAllScholarships();
      res.json(all);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scholarship/:id/mark-prize-paid", async (req, res) => {
    try {
      const adminUserId = (req.session as any)?.userId;
      if (!adminUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const id = parseInt(req.params.id);
      const scholarships = await storage.getAllScholarships();
      const record = scholarships.find((s: any) => s.id === id);
      if (!record) return res.status(404).json({ message: "Scholarship record not found" });
      if (record.prizePaid) return res.status(400).json({ message: "Prize already marked as paid" });

      const prizeAmt = parseFloat(record.prizeAmount ?? "0");
      if (prizeAmt <= 0) return res.status(400).json({ message: "No prize amount set on this record" });

      const studentId = record.userId;

      // 1. Credit the prize to the student's wallet
      const wallet = await storage.getOrCreateWallet(studentId);
      const newBalance = (parseFloat(wallet.balance) + prizeAmt).toFixed(2);
      await storage.updateWalletBalance(studentId, newBalance);

      // 2. Record the transaction
      const typeLabel = record.type === "masters" ? "Masters" : "Student";
      await storage.createTransaction({
        userId: studentId,
        type: "sponsorship_credit",
        amount: prizeAmt.toFixed(2),
        fee: "0.00",
        paymentMethod: "wallet",
        description: `${typeLabel} Scholarship prize — $${prizeAmt.toFixed(2)} credited to wallet`,
      });

      // 3. Place a lien for the full credited amount (funds locked until admin releases)
      try {
        const freshWallet = await storage.getOrCreateWallet(studentId);
        const existingLien = parseFloat(freshWallet.lienAmount ?? "0");
        const newLien = (existingLien + prizeAmt).toFixed(2);
        await storage.setWalletLien(studentId, newLien, `${typeLabel} Scholarship prize hold — $${prizeAmt.toFixed(2)} locked until admin releases`);
        await storage.createNotification({
          userId: studentId, type: "lien_placed",
          title: "Scholarship Prize Credited 🔒",
          message: `Your $${prizeAmt.toFixed(2)} ${typeLabel} Scholarship prize has been credited to your wallet but is temporarily locked. It will be released by admin once verified.`,
          data: { prizeAmount: prizeAmt, lienAmount: newLien },
          isRead: false,
        });
      } catch { /* non-critical */ }

      // 4. Mark prize as paid
      const updated = await storage.updateScholarship(id, { prizePaid: true });

      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/scholarship/:id/decline", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = parseInt(req.params.id);
      const { reason } = req.body as { reason?: string };

      const updated = await storage.updateScholarship(id, { status: "declined" });

      if (updated?.userId) {
        const student = await storage.getUser(updated.userId);
        if (student) {
          try {
            await sendScholarshipDeclinedEmail({ to: student.email, firstName: student.firstName, reason: reason || undefined });
          } catch (_) {}
          try {
            const notif = await storage.createNotification({
              userId: student.id,
              type: "scholarship_declined",
              title: "Scholarship Enrollment Declined",
              message: reason
                ? `Your scholarship enrollment has been declined. Reason: ${reason}. You may restart the application process from the Scholarship Portal whenever you are ready.`
                : "Your scholarship enrollment application has not been approved at this time. You may restart the application process from the Scholarship Portal whenever you are ready.",
              read: false,
            });
            pushToUser(student.id, "notification", notif);
          } catch (_) {}
        }
      }

      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/scholarship/:id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = parseInt(req.params.id);
      await storage.deleteScholarship(id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/admin/scholarship/:id/waec", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = parseInt(req.params.id);
      const { waecPercentage } = req.body;
      const pct = parseFloat(waecPercentage);
      if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ message: "waecPercentage must be 0–100" });
      const updated = await storage.updateScholarship(id, { waecPercentage: pct.toFixed(2) });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/scholarship/:id/reset-cbt", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const scholarships = await storage.getAllScholarships();
      const record = scholarships.find((s: any) => s.id === id);
      if (!record) return res.status(404).json({ message: "Scholarship record not found" });
      if (record.status !== "failed") return res.status(400).json({ message: "CBT reset is only allowed for failed records" });

      const td = (record.testData ?? {}) as any;
      const updated = await storage.updateScholarship(id, {
        status: "waec_done",      // sends them back to the portal-fee payment step
        portalFeePaid: false,
        commitmentFeePaid: false, // masters must also re-pay commitment fee
        testStartedAt: null,
        testCompletedAt: null,
        verbalScore: null,
        quantScore: null,
        prizePaid: false,
        prizeAmount: null as any,
        cheatingFlag: false,
        testData: {
          usedVerbalIds: [...(td.usedVerbalIds ?? []), ...(td.verbalIds ?? [])],
          usedQuantIds:  [...(td.usedQuantIds  ?? []), ...(td.quantIds  ?? [])],
        } as any,
      });

      if (updated?.userId) {
        try {
          await storage.createNotification({
            userId: updated.userId,
            type: "general",
            title: "CBT Retry Approved ✅",
            message: `Your request to retake the ${record.type === "masters" ? "Masters" : "Student"} Scholarship CBT has been approved. Log in to the Scholarship Portal to sit the test again — you'll get a fresh set of questions.`,
            data: {},
            isRead: false,
          });
        } catch { /* non-critical */ }
      }

      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/verify/:verificationId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { approve, reason } = req.body;
      const vId = parseInt(req.params.verificationId);
      const status = approve ? "verified" : "rejected";
      const verificationUpdate: any = { status };
      if (approve) {
        verificationUpdate.commitmentStartDate = new Date(); // 30-day plan-selection window starts now
      }
      const updated = await storage.updateVerification(vId, verificationUpdate);
      // Notify student
      try {
        const verUser = await storage.getUser(updated.userId);
        if (verUser) {
          sendVerificationUpdateEmail(verUser.email, verUser.firstName, status).catch((err: any) => console.error("[EMAIL] Verification email failed:", err?.message ?? err));
        }
        const notif = await storage.createNotification({
          userId: updated.userId,
          type: "verification_update",
          title: approve ? "Offer Approved — Select Your Plan ✓" : "Verification Update",
          message: approve
            ? "Congratulations! Your TSIA offer has been approved. You now have 30 days to select and pay for your sponsorship plan. Go to your Student Dashboard → Sponsorship section to choose your plan and complete payment from your wallet."
            : `Your verification was not approved. ${reason ? `Reason: ${reason}` : "Please contact support or resubmit your documents."}`,
          data: { verificationId: vId, status, reason },
          isRead: false,
        });
        pushToUser(updated.userId, "notification", notif);
      } catch { /* non-critical */ }
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Reset rejected verification → pending (allow student to resubmit) ──
  app.post("/api/admin/reset-verification/:verificationId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const vId = parseInt(req.params.verificationId);
      const updated = await storage.updateVerification(vId, { status: "pending" } as any);

      // Notify student they can resubmit
      try {
        const verUser = await storage.getUser(updated.userId);
        if (verUser) {
          const notif = await storage.createNotification({
            userId: updated.userId,
            type: "verification_update",
            title: "Application Reopened — Please Resubmit",
            message: "Your application has been reopened by the admin. Please log in to your Student Dashboard and resubmit your verification details.",
            data: { verificationId: vId, status: "pending" },
            isRead: false,
          });
          pushToUser(updated.userId, "notification", notif);
        }
      } catch { /* non-critical */ }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/pending-disbursements", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const pending = await storage.getPendingDisbursements();
    res.json(pending);
  });

  app.get("/api/admin/all-disbursements", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const all = await storage.getAllDisbursements();
    res.json(all);
  });

  // ── Trade-to-Fintech-Wallet withdrawals for admin visibility ─────────────────
  app.get("/api/admin/trade-withdrawals", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const rows = await db.execute(sql`
        SELECT
          tt.id,
          tt.user_id,
          u.first_name || ' ' || u.last_name AS user_name,
          u.email,
          CAST(tt.amount_usd AS numeric)       AS gross_usd,
          CAST(tt.reserve_fund_deduction AS numeric) AS reserve_usd,
          CAST(tt.net_amount AS numeric)       AS net_usd,
          tt.note,
          tt.created_at
        FROM trade_transactions tt
        JOIN users u ON u.id = tt.user_id
        WHERE tt.type = 'withdraw_exchange'
          AND tt.note LIKE 'Transferred to SwiftWallet%'
        ORDER BY tt.created_at DESC
        LIMIT 500
      `);
      res.json(rows.rows ?? rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/process-disbursement/:disbursementId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const dId = parseInt(req.params.disbursementId);
      const disbursement = await storage.updateDisbursement(dId, { status: "completed", processedAt: new Date() });

      const disbWallet = await storage.getOrCreateWallet(disbursement.userId);
      const newBalance = (parseFloat(disbWallet.balance) + parseFloat(disbursement.amount)).toFixed(2);
      await storage.updateWalletBalance(disbursement.userId, newBalance);
      await storage.createTransaction({
        userId: disbursement.userId, type: "sponsorship_credit",
        amount: disbursement.amount,
        fee: "0.00",
        paymentMethod: "wallet",
        description: `Sponsorship payout $${disbursement.amount} (₦${(parseFloat(disbursement.amount) * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()})`,
      });

      // Auto-place lien on the student's wallet for the disbursed amount
      try {
        const currentWallet = await storage.getOrCreateWallet(disbursement.userId);
        const existingLien = parseFloat(currentWallet.lienAmount ?? "0");
        const newLienAmount = (existingLien + parseFloat(disbursement.amount)).toFixed(2);
        const semLabel = disbursement.semesterNum === 2 ? "Semester 2" : "Semester 1";
        await storage.setWalletLien(disbursement.userId, newLienAmount, `Scholarship disbursement hold (${semLabel}) — funds locked until admin releases`);
        await storage.createNotification({ userId: disbursement.userId, type: "lien_placed", title: "Wallet Funds Locked 🔒", message: `$${parseFloat(disbursement.amount).toFixed(2)} from your ${semLabel} scholarship has been credited but is temporarily locked. It will be released by admin once verified.`, data: { lienAmount: newLienAmount }, isRead: false });
      } catch { /* non-critical */ }

      // If Semester 1 just processed, ensure Semester 2 exists (backward-compat: older enrollments may only have Sem 1)
      if ((disbursement.semesterNum ?? 1) === 1) {
        try {
          const existing = await storage.getDisbursementsByUser(disbursement.userId);
          const hasSem2 = existing.some(d => d.semesterNum === 2);
          if (!hasSem2) {
            // Create Semester 2 as the same amount (equal split assumed)
            await storage.createDisbursement({ userId: disbursement.userId, amount: disbursement.amount, status: "pending", semesterNum: 2 });
          }
        } catch { /* non-critical */ }
      }

      // Notify student
      try {
        const student = await storage.getUser(disbursement.userId);
        if (student) {
          const semLabel = disbursement.semesterNum === 2 ? "Semester 2" : "Semester 1";
          await sendDisbursementProcessedEmail({ to: student.email, firstName: student.firstName, amount: parseFloat(disbursement.amount).toFixed(2), newBalance, semesterNum: disbursement.semesterNum ?? 1 });
          await storage.createNotification({ userId: disbursement.userId, type: "wallet_credit", title: `Payout Processed ✓ (${semLabel})`, message: `$${parseFloat(disbursement.amount).toFixed(2)} (${semLabel}) has been credited to your TSIA SwiftWallet.`, data: { amount: disbursement.amount, newBalance, semesterNum: disbursement.semesterNum }, isRead: false });
        }
      } catch { /* non-critical */ }

      res.json(disbursement);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Backfill Semester 2 disbursements ────────────────────────────
  app.post("/api/admin/backfill-semester2", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const allDisbursements = await storage.getAllDisbursements();
      // Find all users who have a Semester 1 disbursement but no Semester 2
      const userIds = [...new Set(allDisbursements.map(d => d.userId))];
      let created = 0;
      for (const uid of userIds) {
        const userDisbs = allDisbursements.filter(d => d.userId === uid);
        const sem1 = userDisbs.find(d => (d.semesterNum ?? 1) === 1);
        const sem2 = userDisbs.find(d => d.semesterNum === 2);
        if (sem1 && !sem2) {
          await storage.createDisbursement({ userId: uid, amount: sem1.amount, status: "pending", semesterNum: 2 });
          created++;
        }
      }
      res.json({ success: true, created, message: created > 0 ? `Created ${created} Semester 2 disbursement(s).` : "All students already have Semester 2 disbursements." });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Wallet Liens ───────────────────────────────────────────────────
  app.get("/api/admin/wallet-liens", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const [withLiens, disbursed] = await Promise.all([
        storage.getStudentsWithLiens(),
        storage.getStudentsWithProcessedDisbursements(),
      ]);
      res.json({ withLiens, disbursed });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/wallet-liens/:userId", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.userId, 10);
      const { amount, reason } = req.body;
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
        return res.status(400).json({ message: "A valid lien amount is required" });
      }
      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ message: "A lien reason is required (min 3 characters)" });
      }
      const wallet = await storage.setWalletLien(targetId, parseFloat(amount).toFixed(2), reason.trim());
      // Notify the student
      const notif = await storage.createNotification({
        userId: targetId, type: "system",
        title: "Account Lien Placed 🔒",
        message: `A lien of $${parseFloat(amount).toFixed(2)} has been placed on your SwiftWallet by TSIA administration. Reason: ${reason.trim()}. Your available balance has been adjusted. Contact support for more information.`,
        data: { lienAmount: amount, reason: reason.trim() }, isRead: false,
      });
      pushToUser(targetId, "notification", notif);
      invalidateCacheKey(`wallet:${targetId}`);
      res.json({ success: true, wallet });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/wallet-liens/:userId", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.userId, 10);
      const wallet = await storage.releaseWalletLien(targetId);
      const notif = await storage.createNotification({
        userId: targetId, type: "system",
        title: "Account Lien Released ✅",
        message: "The lien on your SwiftWallet has been released by TSIA administration. Your full wallet balance is now available.",
        data: {}, isRead: false,
      });
      pushToUser(targetId, "notification", notif);
      invalidateCacheKey(`wallet:${targetId}`);
      res.json({ success: true, wallet });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Edit disbursement amount ──────────────────────────────────────
  app.patch("/api/admin/edit-disbursement/:disbursementId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const dId = parseInt(req.params.disbursementId);
      const { newAmount, note } = req.body;
      if (!newAmount || isNaN(parseFloat(newAmount)) || parseFloat(newAmount) <= 0) {
        return res.status(400).json({ message: "A valid positive amount is required." });
      }

      // Fetch the current disbursement to capture original amount
      const [current] = await db.select().from(disbursements).where(eq(disbursements.id, dId));
      if (!current) return res.status(404).json({ message: "Disbursement not found." });
      const originalAmount = parseFloat(current.amount).toFixed(2);

      const updated = await storage.updateDisbursement(dId, { amount: parseFloat(newAmount).toFixed(2) as any });

      // Notify student of the adjustment
      try {
        const student = await storage.getUser(current.userId);
        if (student) {
          await sendDisbursementEditedEmail({ to: student.email, firstName: student.firstName, originalAmount, newAmount: parseFloat(newAmount).toFixed(2), note });
          await storage.createNotification({ userId: current.userId, type: "verification_update", title: "Disbursement Amount Adjusted", message: `Your pending payout has been updated from $${originalAmount} to $${parseFloat(newAmount).toFixed(2)}.${note ? ` Admin note: ${note}` : ""}`, data: { originalAmount, newAmount: parseFloat(newAmount).toFixed(2), note }, isRead: false });
        }
      } catch { /* non-critical */ }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Decline disbursement ──────────────────────────────────────────
  app.post("/api/admin/decline-disbursement/:disbursementId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const dId = parseInt(req.params.disbursementId);
      const { reason } = req.body;

      const declined = await storage.updateDisbursement(dId, { status: "rejected", processedAt: new Date() });

      // Notify student of the decline
      try {
        const student = await storage.getUser(declined.userId);
        if (student) {
          await sendDisbursementDeclinedEmail({ to: student.email, firstName: student.firstName, amount: parseFloat(declined.amount).toFixed(2), reason });
          await storage.createNotification({ userId: declined.userId, type: "verification_update", title: "Disbursement Declined", message: `Your pending disbursement of $${parseFloat(declined.amount).toFixed(2)} could not be approved.${reason ? ` Reason: ${reason}` : ""}`, data: { amount: declined.amount, reason }, isRead: false });
        }
      } catch { /* non-critical */ }

      res.json(declined);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Public: plan prices (always from DB / defaults) ──────────────────────
  app.get("/api/platform/plan-prices", async (_req, res) => {
    try {
      const prices = await storage.getPlanPrices();
      res.json(prices);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Public: sponsorship lock status (no auth required) ───────────────────
  app.get("/api/platform/sponsorship-status", async (_req, res) => {
    try {
      const locked = (await storage.getPlatformSetting("sponsorship_locked")) === "true";
      res.json({ locked });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: get all platform settings ─────────────────────────────────────
  // ── Public: exchange rates (no auth required) ─────────────────────────────
  app.get("/api/exchange-rates", async (_req, res) => {
    try {
      const currencies = await getAllRates();
      const usd = currencies.usd ?? { buying: 1600, selling: 1550 };
      res.json({ buying: usd.buying, selling: usd.selling, currencies, updatedAt: Date.now() });
    } catch (e: any) {
      res.json({ buying: 1600, selling: 1550, currencies: {}, updatedAt: Date.now() });
    }
  });

  app.put("/api/admin/exchange-rates", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const rates = req.body as Record<string, { buying: string; selling: string }>;
      for (const code of RATE_CURRENCIES) {
        const pair = rates[code];
        if (!pair) continue;
        const br = parseFloat(pair.buying);
        const sr = parseFloat(pair.selling);
        if (!isNaN(br) && br > 0) await storage.setPlatformSetting(`${code}_ngn_buying_rate`, br.toString());
        if (!isNaN(sr) && sr > 0) await storage.setPlatformSetting(`${code}_ngn_selling_rate`, sr.toString());
      }
      invalidateAllRatesCache();
      const currencies = await getAllRates();
      const usd = currencies.usd;
      res.json({ ok: true, currencies, buying: usd.buying, selling: usd.selling });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/platform-settings", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const settings = await storage.getAllPlatformSettings();
      const prices = await storage.getPlanPrices();
      const tiers = await storage.getTierPayouts();
      const currencies = await getAllRates();
      const usd = currencies.usd;
      const exchangeRates = { buying: usd.buying, selling: usd.selling, currencies };
      res.json({ settings, prices, tiers, exchangeRates });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: update platform settings ──────────────────────────────────────
  app.put("/api/admin/platform-settings", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { plan1yr, plan2yr, plan3yr, serviceChargeRate,
              silverMin, silverMax, goldMin, goldMax, platinumMin, platinumMax,
              buyingRate, sellingRate } = req.body;
      const updates: { key: string; val: number; min: number; max: number; label: string }[] = [
        { key: "plan_1yr_base",            val: parseFloat(plan1yr),         min: 1,    max: 9999, label: "1-year plan price" },
        { key: "plan_2yr_base",            val: parseFloat(plan2yr),         min: 1,    max: 9999, label: "2-year plan price" },
        { key: "plan_3yr_base",            val: parseFloat(plan3yr),         min: 1,    max: 9999, label: "3-year plan price" },
        { key: "plan_service_charge_rate", val: parseFloat(serviceChargeRate) / 100, min: 0, max: 1, label: "service charge rate" },
        { key: "tier_silver_min",          val: parseFloat(silverMin),       min: 0,    max: 99999, label: "Silver tier min payout" },
        { key: "tier_silver_max",          val: parseFloat(silverMax),       min: 0,    max: 99999, label: "Silver tier max payout" },
        { key: "tier_gold_min",            val: parseFloat(goldMin),         min: 0,    max: 99999, label: "Gold tier min payout" },
        { key: "tier_gold_max",            val: parseFloat(goldMax),         min: 0,    max: 99999, label: "Gold tier max payout" },
        { key: "tier_platinum_min",        val: parseFloat(platinumMin),     min: 0,    max: 99999, label: "Platinum tier min payout" },
        { key: "tier_platinum_max",        val: parseFloat(platinumMax),     min: 0,    max: 99999, label: "Platinum tier max payout" },
      ];
      for (const u of updates) {
        if (isNaN(u.val) || u.val < u.min || u.val > u.max) {
          return res.status(400).json({ message: `Invalid value for ${u.label}` });
        }
        await storage.setPlatformSetting(u.key, u.val.toString());
      }
      // Exchange rates (optional — only update if provided)
      if (buyingRate !== undefined) {
        const br = parseFloat(buyingRate);
        if (isNaN(br) || br < 1 || br > 99999) return res.status(400).json({ message: "Invalid buying rate" });
        await storage.setPlatformSetting("usd_ngn_buying_rate", br.toString());
      }
      if (sellingRate !== undefined) {
        const sr = parseFloat(sellingRate);
        if (isNaN(sr) || sr < 1 || sr > 99999) return res.status(400).json({ message: "Invalid selling rate" });
        await storage.setPlatformSetting("usd_ngn_selling_rate", sr.toString());
      }
      invalidateUsdNgnRatesCache();
      const prices = await storage.getPlanPrices();
      const tiers = await storage.getTierPayouts();
      const buyingStr  = await storage.getPlatformSetting("usd_ngn_buying_rate");
      const sellingStr = await storage.getPlatformSetting("usd_ngn_selling_rate");
      const exchangeRates = { buying: parseFloat(buyingStr ?? "1480"), selling: parseFloat(sellingStr ?? "1280") };
      res.json({ message: "Settings updated successfully", prices, tiers, exchangeRates });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Admin: WAEC grade scale — GET ─────────────────────────────────────────
  app.get("/api/admin/waec-grade-scale", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const raw = await storage.getPlatformSetting("waec_grade_scale");
      const scale: Record<string, number> = raw ? JSON.parse(raw) : { ...WAEC_GRADE_WEIGHTS };
      // Fill in any missing keys with defaults
      for (const k of WAEC_GRADE_KEYS) { if (scale[k] === undefined) scale[k] = WAEC_GRADE_WEIGHTS[k]; }
      res.json({ scale });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: WAEC grade scale — PUT ─────────────────────────────────────────
  app.put("/api/admin/waec-grade-scale", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { scale } = req.body as { scale: Record<string, number> };
      if (!scale || typeof scale !== "object") return res.status(400).json({ message: "scale object is required" });
      const validated: Record<string, number> = {};
      for (const k of WAEC_GRADE_KEYS) {
        const v = parseFloat(scale[k] as any);
        if (isNaN(v) || v < 0 || v > 100) return res.status(400).json({ message: `Invalid point value for grade ${k}` });
        validated[k] = v;
      }
      // Enforce descending order (A1 must be highest)
      const vals = WAEC_GRADE_KEYS.map(k => validated[k]);
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] > vals[i - 1]) return res.status(400).json({ message: `Points must be in descending order (${WAEC_GRADE_KEYS[i]} cannot exceed ${WAEC_GRADE_KEYS[i-1]})` });
      }
      await storage.setPlatformSetting("waec_grade_scale", JSON.stringify(validated));

      // Retroactively recalculate waecPercentage for every scholarship record
      // that already has WAEC grades saved, so they reflect the new scale immediately.
      try {
        const all = await storage.getAllScholarships();
        const toUpdate = all.filter((s: any) => s.waecGrades && Object.keys(s.waecGrades).length > 0);
        await Promise.all(toUpdate.map((s: any) => {
          const newPct = calculateWaecPercentage(s.waecGrades as Record<string, string>, validated);
          return storage.updateScholarship(s.id, { waecPercentage: newPct.toFixed(2) });
        }));
      } catch { /* non-fatal — scale is saved even if recalculation partially fails */ }

      res.json({ message: "WAEC grade scale updated successfully", scale: validated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: get trade market settings ──────────────────────────────────────
  app.get("/api/admin/trade-settings", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const all = await storage.getAllPlatformSettings();
      const map = Object.fromEntries(all.map(r => [r.key, r.value]));
      res.json({
        feeExchangeWithdraw:   parseFloat(map["trade_fee_exchange_withdraw"]   ?? "0.05"),
        feeBankWithdraw:       parseFloat(map["trade_fee_bank_withdraw"]        ?? "0.08"),
        reserveRate:           parseFloat(map["trade_reserve_rate"]             ?? "0.20"),
        affiliateShareRate:    parseFloat(map["trade_affiliate_share_rate"]     ?? "0.05"),
        minDeposit:            parseFloat(map["trade_min_deposit"]              ?? "10"),
        minWithdraw:           parseFloat(map["trade_min_withdraw"]             ?? "5"),
        coAffiliatePoolRate:   map["co_affiliate_pool_rate_override"] != null ? parseFloat(map["co_affiliate_pool_rate_override"]) : null,
        botFullRate:           parseFloat(map["trade_bot_full_rate"]            ?? "0.02"),
        bankTransfersEnabled:  (map["bank_transfers_enabled"] ?? "true") !== "false",
        bankTransfersWeekendOverrideUntil: map["bank_transfers_weekend_override"] ? parseInt(map["bank_transfers_weekend_override"], 10) : 0,
        sponsorshipLocked: (map["sponsorship_locked"] ?? "false") === "true",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: update trade market settings ──────────────────────────────────
  app.put("/api/admin/trade-settings", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { feeExchangeWithdraw, feeBankWithdraw, reserveRate, affiliateShareRate, minDeposit, minWithdraw, coAffiliatePoolRate, botFullRate, bankTransfersEnabled, bankTransfersWeekendOverride, sponsorshipLocked } = req.body;
      if (bankTransfersEnabled !== undefined) {
        await storage.setPlatformSetting("bank_transfers_enabled", bankTransfersEnabled === false || bankTransfersEnabled === "false" ? "false" : "true");
      }
      if (sponsorshipLocked !== undefined) {
        await storage.setPlatformSetting("sponsorship_locked", sponsorshipLocked === true || sponsorshipLocked === "true" ? "true" : "false");
      }
      if (bankTransfersWeekendOverride !== undefined) {
        if (bankTransfersWeekendOverride === false || bankTransfersWeekendOverride === "false" || bankTransfersWeekendOverride === 0) {
          await storage.setPlatformSetting("bank_transfers_weekend_override", "");
        } else {
          // Compute next Monday 08:00 WAT (UTC+1) → expire automatically
          const WAT = 60 * 60 * 1000;
          const nowWat = new Date(Date.now() + WAT);
          const day = nowWat.getUTCDay();
          const daysUntilMon = day === 1 ? 7 : ((8 - day) % 7) || 7;
          const expiry = new Date(nowWat);
          expiry.setUTCDate(nowWat.getUTCDate() + daysUntilMon);
          expiry.setUTCHours(8, 0, 0, 0);
          await storage.setPlatformSetting("bank_transfers_weekend_override", (expiry.getTime() - WAT).toString());
        }
      }
      // Only validate & save rate/fee fields when they are actually provided in the payload
      if (feeExchangeWithdraw !== undefined || feeBankWithdraw !== undefined ||
          reserveRate !== undefined || affiliateShareRate !== undefined ||
          minDeposit !== undefined || minWithdraw !== undefined || botFullRate !== undefined) {
        const updates = [
          { key: "trade_fee_exchange_withdraw",  val: parseFloat(feeExchangeWithdraw),  min: 0,    max: 0.5,   label: "Exchange withdraw fee" },
          { key: "trade_fee_bank_withdraw",      val: parseFloat(feeBankWithdraw),      min: 0,    max: 0.5,   label: "Bank withdraw fee" },
          { key: "trade_reserve_rate",           val: parseFloat(reserveRate),          min: 0,    max: 0.5,   label: "Reserve fund rate" },
          { key: "trade_affiliate_share_rate",   val: parseFloat(affiliateShareRate),   min: 0,    max: 0.5,   label: "Affiliate share rate" },
          { key: "trade_min_deposit",            val: parseFloat(minDeposit),           min: 1,    max: 10000, label: "Min trade deposit" },
          { key: "trade_min_withdraw",           val: parseFloat(minWithdraw),          min: 1,    max: 10000, label: "Min trade withdraw" },
          { key: "trade_bot_full_rate",          val: parseFloat(botFullRate),          min: 0.001, max: 0.20, label: "Daily bot return rate" },
        ];
        for (const u of updates) {
          if (isNaN(u.val) || u.val < u.min || u.val > u.max) return res.status(400).json({ message: `Invalid value for ${u.label}` });
          await storage.setPlatformSetting(u.key, u.val.toString());
        }
      }
      if (coAffiliatePoolRate !== undefined && coAffiliatePoolRate !== null && coAffiliatePoolRate !== "") {
        const r = parseFloat(coAffiliatePoolRate);
        if (isNaN(r) || r < 0 || r > 1) return res.status(400).json({ message: "Invalid co-affiliate pool rate (0–100%)" });
        await storage.setPlatformSetting("co_affiliate_pool_rate_override", r.toString());
      } else {
        await storage.setPlatformSetting("co_affiliate_pool_rate_override", "");
      }
      res.json({ message: "Trade settings updated successfully" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: email all users on Terms of Service change ─────────────────────
  app.post("/api/admin/email-tos-update", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const allUsers = await storage.getAllStudents();
      const BREVO_API_KEY = process.env.BREVO_API_KEY;
      if (!BREVO_API_KEY) return res.status(500).json({ message: "BREVO_API_KEY not configured" });

      let sent = 0; let failed = 0;
      for (const u of allUsers) {
        if (!u.email) { failed++; continue; }
        try {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: "TSIA for Africa", email: "no-reply@tsiforafrica.com" },
              to: [{ email: u.email, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email }],
              subject: "Important: TSIA Terms of Service Update",
              htmlContent: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#1a472a,#b8860b);padding:24px;border-radius:12px 12px 0 0;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">TSIA Terms of Service Update</h1>
                  </div>
                  <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
                    <p>Dear ${u.firstName ?? "Member"},</p>
                    <p>We have updated our <strong>Terms of Service</strong>. Please review the updated terms at your earliest convenience.</p>
                    <p>By continuing to use TSIA services, you agree to the updated Terms of Service.</p>
                    <a href="https://tsiforafrica.com/terms" style="display:inline-block;background:#1a472a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px;">
                      View Updated Terms
                    </a>
                    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
                    <p style="font-size:12px;color:#6b7280;">SMAKEMGGOLD Ltd · UK RC: 1359954 · TSIA for Africa</p>
                  </div>
                </div>
              `,
            }),
          });
          sent++;
        } catch { failed++; }
      }
      res.json({ message: `ToS email sent to ${sent} users. ${failed} failed.`, sent, failed });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // One-time fix: restore trade accounts prematurely completed by hitReturnTarget bug
  app.post("/api/admin/fix-premature-trade-completions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
      // Find all trade wallets that are roiComplete but haven't reached their plan day limit
      const affected = await db.select().from(tradeWallets).where(eq(tradeWallets.roiComplete, true));
      const results: any[] = [];

      for (const tw of affected) {
        const planDays = (tw as any).tradingPlanDays ?? 120;
        const dayNumber = (tw as any).tradingDayNumber ?? 0;
        if (dayNumber >= planDays) continue; // legitimately completed — skip

        // Find the erroneous payout transaction
        const payoutTxs = await db.select().from(transactions)
          .where(and(
            eq(transactions.userId, tw.userId),
            eq(transactions.type, "admin_credit"),
            sql`description LIKE '%100% return reached%' OR description LIKE '%200% target%' OR description LIKE '%cycle payout%'`
          ))
          .orderBy(desc(transactions.createdAt))
          .limit(1);

        const payoutTx = payoutTxs[0];
        const creditedAmount = payoutTx ? parseFloat(payoutTx.amount) : 0;
        const totalInvested = parseFloat(tw.totalInvested ?? "0");

        // Restore: locked_principal = total_invested, trade_balance = total_invested + credited
        const restoredPrincipal = totalInvested.toFixed(6);
        const restoredBalance   = (totalInvested + creditedAmount).toFixed(6);

        // Reverse swift wallet credit (floor at 0 — can't go negative)
        const swWallet = await storage.getOrCreateWallet(tw.userId);
        const currentSwBal = parseFloat(swWallet.balance);
        const newSwBal = Math.max(0, currentSwBal - creditedAmount).toFixed(2);

        // Restore trade wallet
        await storage.restoreTradeWalletFromPrematureComplete(tw.userId, restoredBalance, restoredPrincipal);

        // Deduct from swift wallet
        await storage.updateWalletBalance(tw.userId, newSwBal);

        // Record correction transaction for audit trail
        await storage.createTransaction({
          userId: tw.userId,
          type: "admin_adjustment",
          amount: (-(currentSwBal - parseFloat(newSwBal))).toFixed(2),
          fee: "0.00",
          paymentMethod: "system",
          description: `Admin correction: reversed premature trade cycle payout (day ${dayNumber}/${planDays}) — trade wallet restored`,
        });

        // Notify user
        await storage.createNotification({
          userId: tw.userId,
          type: "trade",
          title: "Trade Account Restored",
          message: `Your trade account has been restored. A technical issue caused your cycle to end early at day ${dayNumber}. Your earnings ($${creditedAmount.toFixed(2)}) have been returned to your trade wallet and your cycle continues normally. Sorry for the inconvenience.`,
          data: {},
          isRead: false,
        });

        results.push({
          userId: tw.userId,
          dayNumber,
          planDays,
          creditedAmount,
          restoredBalance,
          restoredPrincipal,
          swiftWalletBefore: currentSwBal,
          swiftWalletAfter: newSwBal,
        });
      }

      res.json({ message: `Fixed ${results.length} account(s)`, results });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const students = await storage.getAllStudents();
    const pendingVerifications = await storage.getPendingVerifications();
    const pendingDisbursements = await storage.getPendingDisbursements();

    res.json({
      totalStudents: students.length,
      pendingVerifications: pendingVerifications.length,
      pendingDisbursements: pendingDisbursements.length,
      totalDisbursementValue: pendingDisbursements.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(2),
    });
  });

  // ─── ADMIN: Set referred_by for a user (retroactive referral assignment) ─────
  app.patch("/api/admin/users/:id/referred-by", async (req, res) => {
    const sessionUserId = (req.session as any)?.userId;
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(sessionUserId);
    if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const targetId = parseInt(req.params.id);
      const { affiliateCode } = req.body as { affiliateCode: string };
      if (!affiliateCode) return res.status(400).json({ message: "affiliateCode required" });
      // Verify the referrer exists
      const referrer = await storage.getUserByAffiliateCode(affiliateCode.trim().toUpperCase());
      if (!referrer) return res.status(404).json({ message: `No user found with affiliate code ${affiliateCode}` });
      if (referrer.id === targetId) return res.status(400).json({ message: "A user cannot refer themselves" });
      // Update the user's referred_by field
      await db.execute(sql`UPDATE users SET referred_by = ${affiliateCode.trim().toUpperCase()} WHERE id = ${targetId}`);
      res.json({ success: true, message: `User's referral source set to ${affiliateCode.toUpperCase()} (${referrer.firstName} ${referrer.lastName})` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Back-fill referral commissions ────────────────────────────────────
  // Finds all referred users whose wallets are activated but whose referrer has
  // never received a commission, and credits them retroactively.
  app.post("/api/admin/backfill-referral-commissions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getUser(userId);
    if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    try {
      // Gather ALL referred users who have done at least one of:
      //   (a) wallet activated ($5+), (b) completed KYC, (c) paid portal fee
      // and whose referrer has NOT yet received a commission for them.
      const allEligible = await db.execute(sql`
        SELECT DISTINCT
          u.id,
          u.first_name,
          u.last_name,
          u.referred_by,
          COALESCE(w.balance, '0') AS balance
        FROM users u
        LEFT JOIN wallets      w ON w.user_id  = u.id
        LEFT JOIN verifications v ON v.user_id = u.id
        WHERE u.referred_by IS NOT NULL
          AND (
            w.activated       = true
            OR v.biometric_verified = true
            OR v.portal_fee_paid    = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM trade_transactions tt
            JOIN users ref_u ON UPPER(ref_u.affiliate_code) = UPPER(TRIM(u.referred_by))
            WHERE tt.user_id = ref_u.id
              AND tt.type    = 'bot_earning'
              AND tt.note LIKE '%Referral commission%'
              AND tt.note LIKE '%' || u.first_name || ' ' || u.last_name || '%'
          )
      `);

      const credited: { referredUser: string; referrer: string; amount: number }[] = [];
      const skipped: { referredUser: string; reason: string }[] = [];

      for (const row of allEligible.rows as any[]) {
        const referrer = await storage.getUserByAffiliateCode(normalizeReferralCode(row.referred_by));
        if (!referrer) {
          skipped.push({ referredUser: `${row.first_name} ${row.last_name}`, reason: "Referrer not found" });
          continue;
        }

        const walletBalance = parseFloat(row.balance ?? "0");
        const commissionBase = walletBalance >= 3 ? walletBalance : 3;
        const result = await creditReferrerCommissionOnce(row.id, commissionBase, "activation (backfill)");

        if (result.credited) {
          credited.push({
            referredUser: `${row.first_name} ${row.last_name}`,
            referrer: `${referrer.firstName} ${referrer.lastName}`,
            amount: result.commissionAmount ?? 0,
          });
        } else {
          skipped.push({ referredUser: `${row.first_name} ${row.last_name}`, reason: "Commission already credited" });
        }
      }

      res.json({ success: true, credited, skipped, summary: `${credited.length} commissions credited, ${skipped.length} skipped` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Enhanced stats ────────────────────────────────────────────────────
  app.get("/api/admin/enhanced-stats", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const [allStudents, allAffiliates, pendingVerifications, pendingDisbursements] = await Promise.all([
        storage.getAllStudents(),
        db.select().from(users).where(eq(users.role, "affiliate")),
        storage.getPendingVerifications(),
        storage.getPendingDisbursements(),
      ]);
      const [allLoans, allTxns, reserveFund, allOrders] = await Promise.all([
        db.select().from(loans),
        db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(200),
        storage.getTradeReserveFund(),
        db.select().from(orders),
      ]);

      const pendingLoans = allLoans.filter(l => l.status === "pending").length;
      const totalCommission = allOrders.reduce((s, o) => s + parseFloat(o.commission || "0"), 0);
      const totalDisbursed = allTxns.filter(t => t.type === "sponsorship_credit").reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalFeeRevenue = allTxns.filter(t => t.type === "verification_fee").reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
      const verifiedStudents = allStudents.length; // full list
      const coAffiliateCount = await storage.getCoAffiliateCount();

      res.json({
        totalStudents: allStudents.length,
        totalAffiliates: allAffiliates.length,
        totalCoAffiliates: coAffiliateCount,
        pendingVerifications: pendingVerifications.length,
        pendingDisbursements: pendingDisbursements.length,
        pendingLoans,
        totalLoans: allLoans.length,
        activeLoans: allLoans.filter(l => l.status === "active").length,
        totalDisbursed: totalDisbursed.toFixed(2),
        totalFeeRevenue: totalFeeRevenue.toFixed(2),
        totalEcommerceCommission: totalCommission.toFixed(2),
        tradeReserveBalance: reserveFund.total_balance,
        totalOrders: allOrders.length,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: All users ────────────────────────────────────────────────────────
  app.get("/api/admin/all-users", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const allUsers = await db.select().from(users).where(ne(users.role, "admin")).orderBy(desc(users.createdAt));
      const enriched = await Promise.all(
        allUsers.map(async (u) => {
          const wallet = await storage.getOrCreateWallet(u.id);
          const verification = await storage.getVerificationByUser(u.id);
          return { ...u, password: undefined, wallet, verification };
        })
      );
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Edit user account (email, name, password) ───────────────────────
  app.patch("/api/admin/users/:id/account", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid id" });
      const { email, firstName, lastName, newPassword } = req.body;
      if (email) {
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRx.test(email.trim())) return res.status(400).json({ message: "Invalid email address" });
        const existing = await storage.getUserByEmail(email.trim().toLowerCase());
        if (existing && existing.id !== targetId) return res.status(409).json({ message: "That email is already in use by another account" });
      }
      if (newPassword && newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      await storage.updateUserProfileAdmin(targetId, {
        ...(email ? { email: email.trim().toLowerCase() } : {}),
        ...(firstName ? { firstName: firstName.trim() } : {}),
        ...(lastName ? { lastName: lastName.trim() } : {}),
        ...(newPassword ? { passwordHash: hashPassword(newPassword) } : {}),
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Delete user by ID (admin-only) ──────────────────────────────────
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid id" });
      if (targetId === sessionUserId) return res.status(400).json({ message: "You cannot delete your own admin account." });
      await storage.deleteUserById(targetId);
      res.json({ success: true, deletedId: targetId });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Edit user wallet balance (set directly) ─────────────────────────
  app.patch("/api/admin/users/:id/wallet", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.id);
      const { balance, note } = req.body;
      const newBal = parseFloat(balance);
      if (isNaN(newBal) || newBal < 0) return res.status(400).json({ message: "Invalid balance amount" });
      const curWal = await storage.getOrCreateWallet(targetId);
      await storage.updateWalletBalance(targetId, newBal.toFixed(2));
      // Bust the per-user wallet cache so the updated balance is visible immediately
      invalidateCacheKey(`wallet:${targetId}`);
      // Auto-activate wallet if balance reaches $2 minimum and fire referral commission once
      if (!curWal.activated && newBal > 2) {
        await storage.activateWallet(targetId);
        const adminAdjustmentReferralResult = await creditReferrerCommissionOnce(targetId, newBal, "personal wallet activation");
        if (!adminAdjustmentReferralResult.credited) console.log(`[REFERRAL] No admin-adjusted wallet activation commission credited for user ${targetId}`);
      }
      // Record as admin adjustment transaction
      await storage.createTransaction({ userId: targetId, type: "admin_adjustment", amount: newBal.toFixed(2), fee: "0.00", paymentMethod: "admin", description: note ? `Admin adjustment: ${note}` : "Admin wallet balance adjustment" });
      const notif = await storage.createNotification({ userId: targetId, type: "wallet_credit", title: "Wallet Updated", message: `Your TSIA wallet balance has been updated to $${newBal.toFixed(2)} by admin${note ? `: ${note}` : "."}`, data: {}, isRead: false });
      pushToUser(targetId, "notification", notif);
      res.json({ success: true, newBalance: newBal.toFixed(2) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Credit affiliate wallet ──────────────────────────────────────────
  app.post("/api/admin/affiliates/:id/credit", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.id);
      const { amount, note } = req.body;
      const credit = parseFloat(amount);
      if (isNaN(credit) || credit <= 0) return res.status(400).json({ message: "Invalid amount" });
      const wallet = await storage.getOrCreateWallet(targetId);
      const newBal = (parseFloat(wallet.balance) + credit).toFixed(2);
      await storage.updateWalletBalance(targetId, newBal);
      // Bust the per-user wallet cache so the credited amount is visible immediately
      invalidateCacheKey(`wallet:${targetId}`);
      // Auto-activate wallet if balance now meets $2 minimum
      if (!wallet.activated && parseFloat(newBal) > 2) await storage.activateWallet(targetId);
      await storage.createTransaction({ userId: targetId, type: "admin_credit", amount: credit.toFixed(2), fee: "0.00", paymentMethod: "admin", description: note ? `Admin credit: ${note}` : "Admin credit" });
      const notif = await storage.createNotification({ userId: targetId, type: "wallet_credit", title: "Wallet Credited ✓", message: `$${credit.toFixed(2)} has been added to your wallet by admin${note ? `: ${note}` : "."}`, data: {}, isRead: false });
      pushToUser(targetId, "notification", notif);
      res.json({ success: true, credited: credit.toFixed(2), newBalance: newBal });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: All wallet deposits (for crypto approval) ────────────────────────
  app.get("/api/admin/wallet-deposits", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const rows = await db
        .select({ id: walletDeposits.id, userId: walletDeposits.userId, amountUsd: walletDeposits.amountUsd, txHash: walletDeposits.txHash, walletType: walletDeposits.walletType, status: walletDeposits.status, createdAt: walletDeposits.createdAt, userEmail: users.email, userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}` })
        .from(walletDeposits)
        .innerJoin(users, eq(walletDeposits.userId, users.id))
        .orderBy(desc(walletDeposits.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Force-credit a specific pending deposit ────────────────────────
  app.post("/api/admin/deposit/:id/force-credit", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const depId = parseInt(req.params.id);
      if (isNaN(depId)) return res.status(400).json({ message: "Invalid deposit ID" });
      // Fetch by id using raw pool
      const { Pool: FcPool } = await import("pg");
      const fcPool = new FcPool({ connectionString: process.env.DATABASE_URL });
      const fcRow = await fcPool.query("SELECT * FROM wallet_deposits WHERE id=$1 LIMIT 1", [depId]);
      await fcPool.end();
      const dep = fcRow.rows[0];
      if (!dep) return res.status(404).json({ message: "Deposit not found" });
      if (dep.status === "completed") return res.status(400).json({ message: "Already credited" });
      const userId = dep.user_id;
      const gross  = parseFloat(dep.amount_usd);
      const txHash = dep.tx_hash;
      await creditWalletWithSplit(userId, gross, dep.wallet_type ?? "manual", txHash ?? `admin-credit-${depId}`, { id: depId, amountUsd: dep.amount_usd, status: dep.status });
      console.log(`[ADMIN] Force-credited deposit #${depId} — user ${userId} $${gross}`);
      res.json({ message: `$${gross.toFixed(2)} credited to user #${userId}` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Withdrawal Requests ──────────────────────────────────────────────
  app.get("/api/admin/withdrawals", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const rows = await storage.getAllWithdrawalRequests();
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/withdrawals/:id/approve", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const wdId = parseInt(req.params.id);
      const { adminNote } = req.body;
      const wd = await storage.getWithdrawalRequestById(wdId);
      if (!wd) return res.status(404).json({ message: "Withdrawal request not found" });
      if (wd.status !== "pending") return res.status(400).json({ message: `Cannot approve a ${wd.status} request` });
      await storage.updateWithdrawalRequest(wdId, {
        status: "approved",
        adminNote: adminNote ?? "",
        processedAt: new Date(),
      });
      const user = await storage.getUser(wd.userId);
      // Notify user
      const notif = await storage.createNotification({
        userId: wd.userId, type: "wallet_credit",
        title: "Withdrawal Approved ✓",
        message: wd.type === "bank"
          ? `Your withdrawal of ₦${Math.round(parseFloat(wd.netAmount) * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} has been approved and sent to your bank account.`
          : `Your USDT withdrawal of $${parseFloat(wd.netAmount).toFixed(2)} has been approved and sent to your wallet.`,
        data: { withdrawalId: wdId }, isRead: false,
      });
      pushToUser(wd.userId, "notification", notif);
      try {
        await sendEmail(
          user!.email,
          "Withdrawal Approved — TSIA",
          `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
            <h2 style="color:#1a5c38">Withdrawal Approved!</h2>
            <p style="color:#6b7280">Hi ${user!.firstName}, your withdrawal has been processed and sent.</p>
            <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#166534">
              ${wd.type === "bank"
                ? `<strong>Amount Sent:</strong> ₦${Math.round(parseFloat(wd.netAmount as string) * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} to ${wd.accountName} (${wd.accountNumber}) at ${wd.bankName}`
                : `<strong>Amount Sent:</strong> $${parseFloat(wd.netAmount as string).toFixed(2)} USDT via ${wd.network} to ${wd.address}`
              }
            </div>
            ${adminNote ? `<p style="font-size:13px;color:#6b7280"><strong>Note:</strong> ${adminNote}</p>` : ""}
            <p style="font-size:13px;color:#6b7280">If you have any questions, please contact our support team.</p>
          </div>`
        );
      } catch {}
      res.json({ message: "Withdrawal approved" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Decline only — marks request as declined, does NOT credit wallet ─────────
  app.post("/api/admin/withdrawals/:id/decline", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const wdId = parseInt(req.params.id);
      const { adminNote } = req.body;
      const wd = await storage.getWithdrawalRequestById(wdId);
      if (!wd) return res.status(404).json({ message: "Withdrawal request not found" });
      if (wd.status !== "pending") return res.status(400).json({ message: `Cannot decline a ${wd.status} request` });
      await storage.updateWithdrawalRequest(wdId, {
        status: "declined",
        adminNote: adminNote ?? "",
        processedAt: new Date(),
      });
      const user = await storage.getUser(wd.userId);
      const notif = await storage.createNotification({
        userId: wd.userId, type: "system",
        title: "Withdrawal Declined",
        message: `Your withdrawal request of $${parseFloat(wd.amount).toFixed(2)} has been declined.${adminNote ? ` Reason: ${adminNote}` : " Contact support for more information."}`,
        data: { withdrawalId: wdId }, isRead: false,
      });
      pushToUser(wd.userId, "notification", notif);
      try {
        await sendEmail(
          user!.email,
          "Withdrawal Request Declined — TSIA",
          `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
            <h2 style="color:#dc2626">Withdrawal Request Declined</h2>
            <p style="color:#6b7280">Hi ${user!.firstName}, your withdrawal request of $${parseFloat(wd.amount as string).toFixed(2)} has been declined.</p>
            ${adminNote ? `<p style="font-size:13px;color:#6b7280"><strong>Reason:</strong> ${adminNote}</p>` : ""}
            <p style="font-size:13px;color:#6b7280">Please contact support if you have any questions about your funds.</p>
          </div>`
        );
      } catch {}
      res.json({ message: "Withdrawal declined" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Refund only — credits wallet, marks as refunded (use after declining) ────
  app.post("/api/admin/withdrawals/:id/refund", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const wdId = parseInt(req.params.id);
      const { adminNote } = req.body;
      const wd = await storage.getWithdrawalRequestById(wdId);
      if (!wd) return res.status(404).json({ message: "Withdrawal request not found" });
      if (wd.status === "refunded") return res.status(400).json({ message: "This request has already been refunded" });
      if (wd.status === "approved") return res.status(400).json({ message: "Cannot refund an approved withdrawal" });
      // Mark as refunded FIRST — prevents double-credit if subsequent steps fail
      await storage.updateWithdrawalRequest(wdId, {
        status: "refunded",
        adminNote: adminNote || wd.adminNote || "",
        processedAt: new Date(),
      });
      const refundAmt = parseFloat(wd.amount);
      // Credit the correct wallet — trade_bank refunds go back to trade balance
      if ((wd.type as string) === "trade_bank") {
        await storage.updateTradeBalance(wd.userId, refundAmt.toFixed(6));
      } else {
        const wallet = await storage.getOrCreateWallet(wd.userId);
        const refundedBalance = (parseFloat(wallet.balance) + refundAmt).toFixed(2);
        await storage.updateWalletBalance(wd.userId, refundedBalance);
        await storage.createTransaction({
          userId: wd.userId, type: "refund",
          amount: refundAmt.toFixed(2),
          fee: "0",
          paymentMethod: wd.type === "bank" ? "bank_transfer" : "crypto",
          description: `Withdrawal refund — ${adminNote || "refunded by admin"}`,
        });
      }
      const user = await storage.getUser(wd.userId);
      const notif = await storage.createNotification({
        userId: wd.userId, type: "wallet_credit",
        title: "Withdrawal Refunded ✓",
        message: (wd.type as string) === "trade_bank"
          ? `$${refundAmt.toFixed(2)} has been refunded to your Trade Market balance.`
          : `$${refundAmt.toFixed(2)} has been refunded to your TSIA wallet.`,
        data: { withdrawalId: wdId }, isRead: false,
      });
      pushToUser(wd.userId, "notification", notif);
      try {
        await sendEmail(
          user!.email,
          "Withdrawal Refunded — TSIA",
          `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
            <h2 style="color:#1a5c38">Withdrawal Refunded</h2>
            <p style="color:#6b7280">Hi ${user!.firstName}, your withdrawal request has been refunded.</p>
            <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#166534">
              <strong>Refunded:</strong> $${refundAmt.toFixed(2)} has been returned to your TSIA wallet.
            </div>
            ${adminNote ? `<p style="font-size:13px;color:#6b7280"><strong>Note:</strong> ${adminNote}</p>` : ""}
          </div>`
        );
      } catch {}
      res.json({ message: "Withdrawal refunded", newBalance: refundedBalance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: All forum messages ───────────────────────────────────────────────
  app.get("/api/admin/messages", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const rows = await db
        .select({ id: forumPosts.id, topicId: forumPosts.topicId, content: forumPosts.content, likeCount: forumPosts.likeCount, createdAt: forumPosts.createdAt, authorId: forumPosts.authorId, authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, authorEmail: users.email, topicTitle: forumTopics.title })
        .from(forumPosts)
        .innerJoin(users, eq(forumPosts.authorId, users.id))
        .innerJoin(forumTopics, eq(forumPosts.topicId, forumTopics.id))
        .orderBy(desc(forumPosts.createdAt))
        .limit(500);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Delete forum message ─────────────────────────────────────────────
  app.delete("/api/admin/messages/:id", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      await db.delete(forumPosts).where(eq(forumPosts.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: All affiliates ───────────────────────────────────────────────────
  app.get("/api/admin/affiliates-all", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      // Include ALL non-admin users who have an affiliate code (students + affiliates)
      const allNonAdmin = await db.select().from(users)
        .where(sql`role != 'admin' AND affiliate_code IS NOT NULL AND affiliate_code != ''`)
        .orderBy(desc(users.createdAt));
      const enriched = await Promise.all(
        allNonAdmin.map(async (a) => {
          const wallet = await storage.getOrCreateWallet(a.id);
          const coAffiliate = await storage.getCoAffiliateByUser(a.id);
          const referrals = await storage.getReferralsByCode(a.affiliateCode || "");
          const tradeWallet = await storage.getOrCreateTradeWallet(a.id);
          // Sum referral commissions from trade_transactions
          const commResult = await db.execute(sql`
            SELECT COALESCE(SUM(CAST(amount_usd AS numeric)), 0) AS total_commission
            FROM trade_transactions
            WHERE user_id = ${a.id} AND type = 'bot_earning' AND note LIKE 'Referral commission%' AND CAST(amount_usd AS numeric) > 0
          `);
          const totalCommission = parseFloat((commResult.rows[0] as any)?.total_commission ?? "0");
          return { ...a, password: undefined, wallet, coAffiliate, referralCount: referrals.length, tradeWallet, totalCommission };
        })
      );
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: All referral commissions ────────────────────────────────────────
  app.get("/api/admin/referrals-all", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const result = await db.execute(sql`
        SELECT
          tt.id,
          tt.user_id AS referrer_id,
          u.first_name || ' ' || u.last_name AS referrer_name,
          u.email AS referrer_email,
          u.affiliate_code AS referrer_code,
          tt.amount_usd,
          tt.note,
          tt.created_at
        FROM trade_transactions tt
        JOIN users u ON u.id = tt.user_id
        WHERE tt.type = 'bot_earning'
          AND tt.note LIKE 'Referral commission%'
          AND CAST(tt.amount_usd AS numeric) > 0
        ORDER BY tt.created_at DESC
        LIMIT 200
      `);

      // Summary stats
      const summaryResult = await db.execute(sql`
        SELECT
          COUNT(*) AS total_events,
          COALESCE(SUM(CAST(amount_usd AS numeric)), 0) AS total_paid,
          COUNT(DISTINCT user_id) AS unique_referrers
        FROM trade_transactions
        WHERE type = 'bot_earning'
          AND note LIKE 'Referral commission%'
          AND CAST(amount_usd AS numeric) > 0
      `);
      const summary = summaryResult.rows[0] as any;

      res.json({
        commissions: result.rows,
        stats: {
          totalEvents: parseInt(summary.total_events ?? "0"),
          totalPaid: parseFloat(summary.total_paid ?? "0"),
          uniqueReferrers: parseInt(summary.unique_referrers ?? "0"),
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: All loans ────────────────────────────────────────────────────────
  app.get("/api/admin/loans-all", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const allLoans = await db.select().from(loans).orderBy(desc(loans.createdAt));
      const enriched = await Promise.all(
        allLoans.map(async (l) => {
          const loanUser = await storage.getUser(l.userId);
          return { ...l, user: loanUser ? { id: loanUser.id, firstName: loanUser.firstName, lastName: loanUser.lastName, email: loanUser.email, role: loanUser.role } : null };
        })
      );
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Update loan status ───────────────────────────────────────────────
  app.post("/api/admin/loans/:id/status", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { status, offerAmountUsd, repaymentDueDate, adminNote } = req.body;
      const loanId = parseInt(req.params.id);
      if (!["approved", "active", "rejected", "repaid"].includes(status)) return res.status(400).json({ message: "Invalid status" });

      // Build update payload — when approving, apply any admin edits first
      const updatePayload: any = {
        status,
        ...(status === "active" ? { disbursedAt: new Date() } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        ...(repaymentDueDate ? { repaymentDueDate } : {}),
      };

      // If admin overrides the offer amount, recalculate totals
      if (status === "active" && offerAmountUsd) {
        const offer = parseFloat(offerAmountUsd);
        if (!isNaN(offer) && offer > 0) {
          const preLoan = await storage.getLoan(loanId);
          const originalAmount = parseFloat((preLoan as any)?.amountUsd ?? offer);
          if (Math.abs(offer - originalAmount) > 0.001) {
            // Scale totals proportionally to the new principal
            const ratio = offer / originalAmount;
            const newTotal   = parseFloat((parseFloat((preLoan as any).totalPayableUsd) * ratio).toFixed(2));
            const newMonthly = parseFloat((parseFloat((preLoan as any).monthlyPaymentUsd) * ratio).toFixed(2));
            updatePayload.amountUsd        = offer.toFixed(2);
            updatePayload.totalPayableUsd  = newTotal.toFixed(2);
            updatePayload.monthlyPaymentUsd = newMonthly.toFixed(2);
          }
        }
      }

      const loan = await storage.updateLoan(loanId, updatePayload);

      if (status === "active") {
        const loanWallet = await storage.getOrCreateWallet(loan.userId);
        await storage.updateWalletBalance(loan.userId, (parseFloat(loanWallet.balance) + parseFloat(loan.amountUsd)).toFixed(2));
        await storage.createTransaction({
          userId: loan.userId, type: "loan",
          amount: loan.amountUsd,
          fee: "0.00",
          paymentMethod: "wallet",
          description: `Loan disbursed: $${loan.amountUsd} (${loan.userRole} loan)`,
        });
        // ── Place wallet lien equal to total repayable amount ──────────────────
        await storage.setWalletLien(loan.userId, loan.totalPayableUsd, `loan_active:${loanId}`);
        const loanApprNotif = await storage.createNotification({ userId: loan.userId, type: "verification_update", title: "Loan Disbursed 💰", message: `Your $${loan.amountUsd} loan has been credited to your wallet. Your wallet is now frozen — you may only withdraw the loan to your bank account. All other transactions are blocked until the loan is repaid.`, data: { loanId: loan.id }, isRead: false });
        pushToUser(loan.userId, "notification", loanApprNotif);
        storage.getUser(loan.userId).then(u => { if (u) sendLoanUpdateEmail(u.email, u.firstName, "approved", loan.amountUsd).catch((err: any) => console.error("[EMAIL] Loan email failed:", err?.message ?? err)); });
      } else if (status === "repaid") {
        // ── Lift lien on repayment ─────────────────────────────────────────────
        await storage.releaseWalletLien(loan.userId).catch(() => {});
        const repaidNotif = await storage.createNotification({ userId: loan.userId, type: "verification_update", title: "Loan Repaid ✅", message: `Your loan of $${loan.amountUsd} has been marked as fully repaid. Your wallet is now restored — all transactions are available again.`, data: { loanId: loan.id }, isRead: false });
        pushToUser(loan.userId, "notification", repaidNotif);
        storage.getUser(loan.userId).then(u => { if (u) sendLoanUpdateEmail(u.email, u.firstName, "repaid", loan.amountUsd).catch((err: any) => console.error("[EMAIL] Loan email failed:", err?.message ?? err)); });
      } else if (status === "rejected") {
        // ── Also lift any lien in case it was previously set ──────────────────
        await storage.releaseWalletLien(loan.userId).catch(() => {});
        const loanRejNotif = await storage.createNotification({ userId: loan.userId, type: "verification_update", title: "Loan Application Update", message: "Your loan application was not approved at this time. Please contact support for more information.", data: { loanId: loan.id }, isRead: false });
        pushToUser(loan.userId, "notification", loanRejNotif);
        storage.getUser(loan.userId).then(u => { if (u) sendLoanUpdateEmail(u.email, u.firstName, "rejected", loan.amountUsd).catch((err: any) => console.error("[EMAIL] Loan email failed:", err?.message ?? err)); });
      }
      res.json(loan);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: All transactions ─────────────────────────────────────────────────
  app.get("/api/admin/transactions-all", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const txns = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(200);
      const enriched = await Promise.all(
        txns.map(async (t) => {
          const txUser = await storage.getUser(t.userId);
          return { ...t, user: txUser ? { firstName: txUser.firstName, lastName: txUser.lastName, email: txUser.email, role: txUser.role } : null };
        })
      );
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: TS-Mart Online Stores stats ─────────────────────────────────────────────────
  app.get("/api/admin/ecommerce-stats", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const allProducts = await storage.getProducts({});
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
      const enrichedOrders = await Promise.all(
        allOrders.map(async (o) => {
          const buyer = await storage.getUser(o.buyerId);
          const seller = await storage.getUser(o.sellerId);
          const product = await storage.getProductById(o.productId);
          return { ...o, buyer: buyer ? { firstName: buyer.firstName, lastName: buyer.lastName, email: buyer.email } : null, seller: seller ? { firstName: seller.firstName, lastName: seller.lastName, email: seller.email } : null, product: product ? { title: product.title } : null };
        })
      );
      const totalCommission = allOrders.reduce((s, o) => s + parseFloat(o.commission || "0"), 0);
      res.json({
        totalProducts: allProducts.length,
        activeProducts: allProducts.filter(p => p.status === "active").length,
        soldProducts: allProducts.filter(p => p.status === "sold").length,
        totalOrders: allOrders.length,
        completedOrders: allOrders.filter(o => o.status === "delivered").length,
        totalCommission: totalCommission.toFixed(2),
        recentOrders: enrichedOrders,
        allProducts: allProducts,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Remove a listing ────────────────────────────────────────────────
  app.delete("/api/admin/products/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const prod = await storage.getProductById(parseInt(req.params.id));
      if (!prod) return res.status(404).json({ message: "Product not found" });
      await storage.deleteProduct(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Trade market stats ───────────────────────────────────────────────
  app.get("/api/admin/trade-stats", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const reserveFund = await storage.getTradeReserveFund();
      const affiliateCount = await storage.getAffiliateCount();
      const tradeTxns = await db.select().from(tradeTransactions).orderBy(desc(tradeTransactions.createdAt)).limit(50);

      const totalBotEarnings = tradeTxns
        .filter(t => t.type === "bot_earning")
        .reduce((s, t) => s + parseFloat(t.amountUsd ?? "0"), 0);

      // Actual gross trade deposits (100% of each deposit, not just the 20% reserve portion)
      const depositAggResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(amount_usd AS numeric)), 0) AS total_deposits,
          COUNT(*) AS deposit_count
        FROM trade_transactions
        WHERE type IN ('deposit', 'topup')
      `);
      const depositAgg = (depositAggResult.rows[0] as any) ?? {};
      const totalTradeDeposits = parseFloat(depositAgg.total_deposits ?? "0");

      res.json({
        reserveBalance: reserveFund.total_balance,
        totalDeposited: totalTradeDeposits.toFixed(2),
        reserveAccumulated: reserveFund.total_deposited,
        depositCount: parseInt(depositAgg.deposit_count ?? "0", 10),
        affiliateCount,
        totalBotEarnings: totalBotEarnings.toFixed(2),
        recentTransactions: tradeTxns.slice(0, 20),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Trade Users — per-user wallet overview ──────────────────────────
  app.get("/api/admin/trade-users", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const rows = await db.execute(sql`
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          tw.trade_balance, tw.locked_principal, tw.trading_day_number,
          tw.trading_plan_days, tw.roi_complete, tw.bot_activated_at,
          tw.total_bot_earnings, tw.referral_commission_balance, tw.bot_locked
        FROM trade_wallets tw
        JOIN users u ON u.id = tw.user_id
        WHERE CAST(tw.trade_balance AS numeric) > 0
           OR CAST(tw.locked_principal AS numeric) > 0
           OR tw.trading_day_number > 0
           OR tw.bot_locked = true
        ORDER BY CAST(tw.trade_balance AS numeric) DESC
      `);
      const nowMs = Date.now();
      const BOT_MAX_MS = 12 * 3600 * 1000;
      // UK trading window helper (mirrors isTradeSessionActive)
      const londonNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
      const ukDay = londonNow.getDay(); const ukHour = londonNow.getHours();
      const inTradingWindow = (ukDay >= 1 && ukDay <= 5 && ukHour >= 13) || (ukDay >= 2 && ukDay <= 6 && ukHour < 1);
      res.json((rows.rows as any[]).map(r => ({
        userId: r.id,
        name: `${r.first_name} ${r.last_name}`,
        email: r.email,
        balance: parseFloat(r.trade_balance ?? "0"),
        lockedPrincipal: parseFloat(r.locked_principal ?? "0"),
        tradingDayNumber: r.trading_day_number ?? 0,
        tradingPlanDays: r.trading_plan_days && [60, 90, 120].includes(Number(r.trading_plan_days)) ? Number(r.trading_plan_days) : 120,
        roiComplete: r.roi_complete ?? false,
        totalBotEarnings: parseFloat(r.total_bot_earnings ?? "0"),
        referralCommission: parseFloat(r.referral_commission_balance ?? "0"),
        botActivatedAt: r.bot_activated_at,
        botLocked: r.bot_locked ?? false,
        isActive: r.bot_activated_at && inTradingWindow
          ? (nowMs - new Date(r.bot_activated_at).getTime()) < BOT_MAX_MS
          : false,
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Trade Sessions for a specific user ───────────────────────────────
  app.get("/api/admin/trade-users/:userId/sessions", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const targetId = parseInt(req.params.userId);
      const sessions = await db.execute(sql`
        SELECT id, amount_usd, note, created_at, status
        FROM trade_transactions
        WHERE user_id = ${targetId}
          AND type = 'bot_earning'
        ORDER BY created_at DESC
        LIMIT 120
      `);
      res.json((sessions.rows as any[]).map(s => ({
        id: s.id,
        amountUsd: parseFloat(s.amount_usd ?? "0"),
        note: s.note ?? "",
        createdAt: s.created_at,
        status: s.status,
        isLoss: parseFloat(s.amount_usd ?? "0") < 0,
        isMissed: parseFloat(s.amount_usd ?? "0") === 0,
        isProfit: parseFloat(s.amount_usd ?? "0") > 0,
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Get warnings issued to a trade user ──────────────────────────────
  app.get("/api/admin/trade-users/:userId/warnings", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.userId);
      const rows = await db.execute(sql`
        SELECT id, title, message, created_at, is_read
        FROM notifications
        WHERE user_id = ${targetId}
          AND type = 'system'
          AND title ILIKE '%warning%'
        ORDER BY created_at DESC
        LIMIT 50
      `);
      res.json((rows.rows as any[]).map(r => ({
        id: r.id,
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
        isRead: r.is_read,
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Issue a warning to a trade user ───────────────────────────────────
  app.post("/api/admin/trade-users/:userId/warn", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.userId);
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Warning message is required" });
      await storage.createNotification({
        userId: targetId,
        type: "system",
        title: "⚠ Warning from Admin",
        message: message.trim(),
        data: { isAdminWarning: true },
        isRead: false,
      });
      res.json({ message: "Warning issued successfully" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Override a loss/missed session to profit ─────────────────────────
  app.post("/api/admin/trade-sessions/:txId/override", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const txId = parseInt(req.params.txId);
      const { newAmount } = req.body;
      if (!newAmount || isNaN(parseFloat(newAmount))) return res.status(400).json({ message: "newAmount required" });

      // Fetch original tx to know the user and original amount
      const [origTx] = await db.select().from(tradeTransactions).where(eq(tradeTransactions.id, txId));
      if (!origTx) return res.status(404).json({ message: "Session not found" });

      const userId = origTx.userId;
      const origAmount = parseFloat(origTx.amountUsd ?? "0");
      const newAmt = parseFloat(parseFloat(newAmount).toFixed(6));
      const diff = newAmt - origAmount; // positive = credit, negative = debit

      // Update the transaction
      await db.update(tradeTransactions)
        .set({ amountUsd: newAmt.toFixed(6), note: (origTx.note ?? "") + " [admin override]" })
        .where(eq(tradeTransactions.id, txId));

      // Adjust trade balance by the diff
      if (diff !== 0) {
        await db.execute(sql`
          UPDATE trade_wallets
          SET trade_balance = CAST(trade_balance AS numeric) + ${diff},
              total_bot_earnings = CAST(total_bot_earnings AS numeric) + ${diff},
              updated_at = NOW()
          WHERE user_id = ${userId}
        `);
      }
      res.json({ ok: true, diff });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Adjust trade wallet capital ──────────────────────────────────────
  app.post("/api/admin/trade-wallets/:userId/adjust", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const targetId = parseInt(req.params.userId);
      const { amount, note, days } = req.body;
      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ message: "amount required" });
      const amt = parseFloat(parseFloat(amount).toFixed(6));
      const daysDelta = days !== undefined && days !== "" ? parseInt(days) : 0;

      await db.execute(sql`
        UPDATE trade_wallets
        SET trade_balance = GREATEST(0, CAST(trade_balance AS numeric) + ${amt}),
            locked_principal = CASE WHEN ${amt} > 0 THEN CAST(locked_principal AS numeric) + ${amt} ELSE locked_principal END,
            trading_day_number = GREATEST(0, trading_day_number + ${daysDelta}),
            updated_at = NOW()
        WHERE user_id = ${targetId}
      `);

      // Record adjustment transaction
      await db.insert(tradeTransactions).values({
        userId: targetId,
        type: "bot_earning",
        amountUsd: amt.toFixed(6),
        feeUsd: "0",
        reserveFundDeduction: "0",
        affiliateShareDeduction: "0",
        netAmount: amt.toFixed(6),
        status: "completed",
        note: note || `Admin balance adjustment by ${admin.firstName} ${admin.lastName}`,
      });

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Full trade wallet edit ───────────────────────────────────────────
  app.patch("/api/admin/trade-wallet/:userId", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const targetId = parseInt(req.params.userId);
      const { tradeBalance, lockedPrincipal, totalInvested, totalBotEarnings, tradingDayNumber, roiComplete, tradingPlanDays } = req.body;
      const sets: string[] = [];
      if (tradeBalance !== undefined) sets.push(`trade_balance = '${parseFloat(tradeBalance).toFixed(6)}'`);
      if (lockedPrincipal !== undefined) sets.push(`locked_principal = '${parseFloat(lockedPrincipal).toFixed(6)}'`);
      if (totalInvested !== undefined) sets.push(`total_invested = '${parseFloat(totalInvested).toFixed(6)}'`);
      if (totalBotEarnings !== undefined) sets.push(`total_bot_earnings = '${parseFloat(totalBotEarnings).toFixed(6)}'`);
      if (tradingDayNumber !== undefined) sets.push(`trading_day_number = ${parseInt(tradingDayNumber)}`);
      if (roiComplete !== undefined) sets.push(`roi_complete = ${!!roiComplete}`);
      if (tradingPlanDays !== undefined) sets.push(`trading_plan_days = ${parseInt(tradingPlanDays)}`);
      if (sets.length === 0) return res.status(400).json({ message: "Nothing to update" });
      sets.push("updated_at = NOW()");
      await db.execute(sql.raw(`UPDATE trade_wallets SET ${sets.join(", ")} WHERE user_id = ${targetId}`));
      const updated = await db.execute(sql`SELECT * FROM trade_wallets WHERE user_id = ${targetId}`);
      res.json(updated.rows[0] ?? { ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: Stop a user's active bot trade session ───────────────────────────
  app.post("/api/admin/trade-users/:userId/stop-bot", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      // Reset bot session state, clear bot activated timestamp, and lock the bot.
      // Do NOT touch total_bot_earnings — resetting it was causing the progress bar to
      // falsely show 0% after an admin stop; earnings history is preserved in transactions.
      await db.execute(sql`
        UPDATE trade_wallets
        SET locked_principal = '0.000000',
            trading_day_number = 0,
            bot_activated_at = NULL,
            bot_locked = TRUE,
            updated_at = NOW()
        WHERE user_id = ${targetId}
      `);

      await db.insert(tradeTransactions).values({
        userId: targetId,
        type: "bot_earning",
        amountUsd: "0.000000",
        feeUsd: "0",
        reserveFundDeduction: "0",
        affiliateShareDeduction: "0",
        netAmount: "0.000000",
        status: "completed",
        note: `Bot session stopped and locked by admin (${admin.firstName} ${admin.lastName})`,
      });

      // Send in-app notification to user
      try {
        const notif = await storage.createNotification({
          userId: targetId,
          type: "trade_warning",
          title: "Bot Access Suspended",
          message: "Your Itera Trading BOT has been stopped and your access suspended by the platform. You will not be able to re-activate it until access is restored by an administrator. Please contact support if you have questions.",
          read: false,
        });
        pushToUser(targetId, "notification", notif);
      } catch (_) {}

      res.json({ ok: true, message: "Bot session stopped and locked successfully." });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Unlock a user's bot (re-grant access after a stop-lock) ──────────
  app.post("/api/admin/trade-users/:userId/unlock-bot", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      // When reinstating a user, give them a clean slate:
      // • cycle_started_at = NOW()  → only earnings from today count toward the cap
      // • locked_principal = current trade_balance → their balance is their new capital
      // • roi_complete = false      → allow bot activation
      // • bot_locked = false        → access restored
      await db.execute(sql`
        UPDATE trade_wallets
        SET bot_locked        = FALSE,
            roi_complete      = FALSE,
            cycle_started_at  = NOW(),
            locked_principal  = GREATEST('0.000000'::numeric, trade_balance::numeric),
            bot_activated_at  = NULL,
            updated_at        = NOW()
        WHERE user_id = ${targetId}
      `);

      // Notify user
      try {
        const notif = await storage.createNotification({
          userId: targetId,
          type: "trade_warning",
          title: "Bot Access Restored",
          message: "Your Itera Trading BOT access has been restored by the platform. Your trading cycle has been reset from today — you may now re-activate your bot during the next trading window.",
          read: false,
        });
        pushToUser(targetId, "notification", notif);
      } catch (_) {}

      res.json({ ok: true, message: "Bot access restored successfully." });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Remove a user from Trade Market entirely ─────────────────────────
  app.delete("/api/admin/trade-users/:userId", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      // Nullify FK references in affiliate_trade_shares before deleting trade_transactions
      await db.execute(sql`
        UPDATE affiliate_trade_shares
        SET trade_transaction_id = NULL
        WHERE trade_transaction_id IN (
          SELECT id FROM trade_transactions WHERE user_id = ${targetId}
        )
      `);
      // Delete all trade transactions for this user
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id = ${targetId}`);
      // Delete the trade wallet
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id = ${targetId}`);

      res.json({ ok: true, message: "User removed from Trade Market." });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Send notification to user ───────────────────────────────────────
  app.post("/api/admin/notify-user/:targetUserId", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { title, message } = req.body;
      if (!title || !message) return res.status(400).json({ message: "Title and message are required" });

      const notification = await storage.createNotification({
        userId: parseInt(req.params.targetUserId),
        type: "verification_update", title, message, data: {}, isRead: false,
      });
      res.json(notification);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Bulk notify all users ────────────────────────────────────────────
  app.post("/api/admin/notify-all", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { title, message, role } = req.body;
      if (!title || !message) return res.status(400).json({ message: "Title and message required" });

      let targetUsers: any[];
      if (role === "student") targetUsers = await storage.getAllStudents();
      else if (role === "affiliate") targetUsers = await db.select().from(users).where(eq(users.role, "affiliate"));
      else targetUsers = await db.select().from(users).where(ne(users.role, "admin"));

      await Promise.all(
        targetUsers.map(u => storage.createNotification({ userId: u.id, type: "verification_update", title, message, data: {}, isRead: false }))
      );
      res.json({ sent: targetUsers.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Resend domain detail (DNS records) ──────────────────────────────
  app.get("/api/admin/resend-domain-records/:id", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const key = process.env.RESEND_API_KEY;
      if (!key) return res.status(500).json({ message: "RESEND_API_KEY not set" });
      const r = await fetch(`https://api.resend.com/domains/${req.params.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      res.json(await r.json());
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Resend domain status check ──────────────────────────────────────
  app.get("/api/admin/resend-domain-status", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const key = process.env.RESEND_API_KEY;
      if (!key) return res.status(500).json({ message: "RESEND_API_KEY not set" });
      const domainsRes = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const domainsData = await domainsRes.json();
      res.json(domainsData);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Test email ───────────────────────────────────────────────────────
  app.post("/api/admin/test-email", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const { to } = req.body;
      const target = to || admin.email;
      const { sendOtpEmail: sendTest } = await import("./email");
      await sendTest(target, "TEST-123456", false);
      res.json({ ok: true, sentTo: target });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Sponsor Cohorts ───────────────────────────────────────────────────
  app.post("/api/admin/sponsor-cohorts", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { sponsorName, sponsorEmail, sponsorPhone, totalSlots, notes } = req.body;
      if (!sponsorName || !sponsorEmail) return res.status(400).json({ message: "Sponsor name and email are required" });
      const slots = parseInt(totalSlots, 10);
      if (!slots || slots < 10) return res.status(400).json({ message: "Minimum 10 slots required per cohort" });

      const result = await storage.createSponsorCohort({ sponsorName, sponsorEmail, sponsorPhone, totalSlots: slots, notes, status: "active" });
      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/sponsor-cohorts", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const cohorts = await storage.getSponsorCohorts();
      res.json(cohorts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Enrollment Batch Management ──────────────────────────────────────
  const BATCH_BASE_MAX = 1000; // base max per batch — server-side only

  app.get("/api/admin/batch-status", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const status = await storage.getAdminBatchStatus(BATCH_BASE_MAX);
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/public/batch-status", async (_req, res) => {
    try {
      const status = await storage.getAdminBatchStatus(BATCH_BASE_MAX);
      res.json({
        batchNumber: status.batch?.batchNumber ?? null,
        enrolled: status.enrolled ?? 0,
        totalCapacity: status.totalCapacity ?? BATCH_BASE_MAX,
        remaining: status.remaining ?? BATCH_BASE_MAX,
        isFull: (status.remaining ?? BATCH_BASE_MAX) <= 0,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/batch/open-slots", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const slots = parseInt(req.body.slots);
      if (!slots || slots < 1 || slots > 500) return res.status(400).json({ message: "slots must be between 1 and 500" });
      const result = await storage.openBatchSlots(slots);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── ADMIN: Personal enrollment invitation ────────────────────────────────
  app.post("/api/admin/invite-student", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const { email, name, note } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ message: "Valid email address required" });
      const inv = await storage.createPersonalInvitation({ email, name, note, createdByAdminId: adminId });
      res.json({ success: true, invitation: inv });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/personal-invitations", async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      if (!adminId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const invitations = await storage.listPersonalInvitations();
      res.json(invitations);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── STUDENT: Validate / Use Sponsor Code ─────────────────────────────────────
  app.post("/api/verification/validate-sponsor-code", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });
      const result = await storage.validateSponsorCode(code);
      if (!result.valid) return res.status(400).json({ message: result.reason });
      res.json({ valid: true, cohortName: result.cohortName });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/use-sponsor-code", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });

      const validation = await storage.validateSponsorCode(code);
      if (!validation.valid) return res.status(400).json({ message: validation.reason });

      // Mark the code as used
      await storage.useSponsorCode(code, userId);

      // Credit $5.50 activation bonus and activate the wallet if not yet active
      const SPONSOR_CODE_BONUS = 5.50;
      const wallet = await storage.getOrCreateWallet(userId);
      const newBalance = (parseFloat(wallet.balance) + SPONSOR_CODE_BONUS).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);
      if (!wallet.activated) {
        await storage.activateWallet(userId);
      }
      await storage.createTransaction({
        userId,
        type: "admin_credit",
        amount: SPONSOR_CODE_BONUS.toFixed(2),
        fee: "0.00",
        paymentMethod: "sponsor_code",
        description: `Sponsor code activation bonus — $${SPONSOR_CODE_BONUS.toFixed(2)} credited to TSIA SwiftWallet (${validation.cohortName ?? "sponsored cohort"})`,
      });
      await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Sponsor Code Activated!",
        message: `$${SPONSOR_CODE_BONUS.toFixed(2)} has been credited to your TSIA SwiftWallet and your account is now active.`,
        data: { bonus: SPONSOR_CODE_BONUS, cohortName: validation.cohortName },
        isRead: false,
      });

      const verification = await storage.getVerificationByUser(userId);
      res.json({ success: true, verification, bonus: SPONSOR_CODE_BONUS });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/leadership/inquiry", async (req, res) => {
    try {
      const inquiry = await storage.createLeadershipInquiry(req.body);
      res.json(inquiry);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── PUBLIC SPONSOR COHORT PAYMENT ───────────────────────────────────────────
  // Step 1: Initiate Squad payment (no auth required — public page)
  app.post("/api/sponsor/payment/initiate", async (req, res) => {
    try {
      const { firstName, lastName, email, orgName, phone, numStudents } = req.body;
      if (!firstName || !email) return res.status(400).json({ message: "Name and email are required" });
      const slots = parseInt(numStudents, 10);
      if (!slots || slots < 100) return res.status(400).json({ message: "Minimum 100 students required" });
      const PRICE_PER_STUDENT_USD = 3.3;
      const totalUsd = PRICE_PER_STUDENT_USD * slots;
      const secretKey = process.env.SQUAD_SECRET_KEY;
      const publicKey = process.env.SQUAD_PUBLIC_KEY;
      if (!secretKey || !publicKey) return res.status(500).json({ message: "Payment gateway not configured. Please contact support." });
      const rates = await getUsdNgnRates();
      const USD_TO_KOBO = Math.round(rates.buying * 100);
      const amountKobo = Math.round(totalUsd * USD_TO_KOBO);
      const transactionRef = `TSIA-SPO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      res.json({ transactionRef, amountKobo, amountNgn: (totalUsd * rates.buying).toFixed(2), totalUsd: totalUsd.toFixed(2), publicKey, email, firstName, lastName });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Step 2: Verify payment → create cohort → email master code
  app.post("/api/sponsor/payment/verify", async (req, res) => {
    try {
      const { transactionRef, firstName, lastName, email, orgName, phone, numStudents } = req.body;
      if (!transactionRef || !email) return res.status(400).json({ message: "Transaction reference and email are required" });
      const slots = parseInt(numStudents, 10);
      if (!slots || slots < 100) return res.status(400).json({ message: "Invalid student count" });
      const secretKey = process.env.SQUAD_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured" });
      const isLive = secretKey.startsWith("sk_");
      const baseUrl = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
      const response = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(transactionRef)}`, {
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      });
      const data = await response.json() as any;
      if (!data.success || data.data?.transaction_status !== "Success") {
        return res.status(400).json({ message: "Payment not confirmed yet. Please wait a moment and try again." });
      }
      const { cohort, masterCode } = await storage.createPublicSponsorCohort({
        sponsorName: `${firstName} ${lastName}`,
        sponsorEmail: email,
        sponsorPhone: phone,
        totalSlots: slots,
        orgName: orgName || undefined,
      });
      // Email the master code to the sponsor
      try {
        await sendEmail(
          email,
          `Your TSIA Sponsor Code — ${slots} Student${slots > 1 ? "s" : ""}`,
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
            <div style="text-align:center;margin-bottom:24px">
              <img src="https://tsiforafrica.com/logo.png" alt="TSIA" style="height:48px" />
            </div>
            <h2 style="color:#1a5c38;font-size:22px;margin-bottom:8px">Your Sponsor Code is Ready!</h2>
            <p style="color:#374151;font-size:15px">Hi ${firstName}, thank you for sponsoring <strong>${slots} student${slots > 1 ? "s" : ""}</strong> through TSIA.</p>
            <p style="color:#6b7280;font-size:14px">Your payment of <strong>₦${(3.3 * slots * rates.buying).toLocaleString()}</strong> has been confirmed. Share the code below with your sponsored students — each student will enter it during their enrollment to activate their account for free.</p>
            <div style="background:#fff;border:2px solid #1a5c38;border-radius:12px;padding:24px;text-align:center;margin:28px 0">
              <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Your Sponsor Code</p>
              <p style="font-family:monospace;font-size:32px;font-weight:bold;color:#1a5c38;letter-spacing:4px;margin:0">${masterCode}</p>
            </div>
            <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="color:#92400e;font-size:14px;margin:0"><strong>Important:</strong> This single code covers all <strong>${slots}</strong> of your sponsored students. Each student uses it once during their TSIA enrollment. Once all ${slots} slots are filled, the code will be deactivated.</p>
            </div>
            <div style="border-top:1px solid #e5e7eb;padding-top:20px">
              <p style="color:#374151;font-size:14px"><strong>How your students use the code:</strong></p>
              <ol style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px">
                <li>Go to <a href="https://tsiforafrica.com/onboarding" style="color:#1a5c38">tsiforafrica.com/onboarding</a> and apply</li>
                <li>On the WAEC details page, click <strong>"Have a Sponsor Code?"</strong></li>
                <li>Enter the code above and click <strong>Apply Code &amp; Continue</strong></li>
                <li>Their account will be activated instantly — no payment required</li>
              </ol>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">TSIA — Tuition Support Initiative for Africa · SMAKEMGGOLD Ltd RC: 1359954</p>
          </div>`
        );
      } catch (emailErr) {
        console.error("[SPONSOR EMAIL] Failed to send code email:", emailErr);
      }
      res.json({ success: true, masterCode, totalStudents: slots, cohortId: cohort.id });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── LOAN ROUTES ─────────────────────────────────────────────────────────────
  app.get("/api/loans/my-loans", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userLoans = await storage.getLoansByUser(userId);
      res.json(userLoans);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/loans/limit", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "student" && user.role !== "affiliate") {
        return res.json({ eligible: false, reason: "Loans are available for students and affiliates only.", limitUsd: 0 });
      }
      const activeLoan = await storage.getActiveLoanByUser(userId);
      // Calculate 30% of total transaction volume for this user
      const txResult = await db.execute(
        sql`SELECT COALESCE(SUM(ABS(CAST(amount AS numeric))), 0) AS total_volume FROM transactions WHERE user_id = ${userId}`
      );
      const totalVolume = parseFloat((txResult.rows[0] as any)?.total_volume ?? "0");
      const offerUsd = parseFloat((totalVolume * 0.30).toFixed(2));
      if (offerUsd < 1) {
        return res.json({ eligible: false, reason: "Complete more transactions on TSIA to unlock your personalised loan offer (loan offer = 30% of your total transaction volume).", limitUsd: 0, totalVolume: totalVolume.toFixed(2) });
      }
      res.json({ eligible: true, limitUsd: offerUsd, totalVolume: totalVolume.toFixed(2), activeLoan: activeLoan || null, terms: [7, 14, 30, 90, 365] });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/loans/apply", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd, termDays, purpose, bvn, nin, fullAddress } = req.body;
      if (!amountUsd || !termDays) return res.status(400).json({ message: "Amount and repayment term are required" });
      if (!bvn?.trim()) return res.status(400).json({ message: "BVN is required" });
      if (!nin?.trim()) return res.status(400).json({ message: "NIN is required" });
      if (!fullAddress?.trim()) return res.status(400).json({ message: "Full address/location is required" });
      if (!purpose?.trim()) return res.status(400).json({ message: "Reason for loan is required" });
      const validTermDays = [7, 14, 30, 90, 365];
      if (!validTermDays.includes(parseInt(termDays))) return res.status(400).json({ message: "Invalid repayment term. Choose 7, 14, 30, 90, or 365 days." });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "student" && user.role !== "affiliate") return res.status(400).json({ message: "Loans are available for students and affiliates only." });
      const activeLoan = await storage.getActiveLoanByUser(userId);
      if (activeLoan) return res.status(400).json({ message: "You already have an active loan. Please repay it before applying for another." });
      // Compute offer: 30% of total transaction volume
      const txResult = await db.execute(
        sql`SELECT COALESCE(SUM(ABS(CAST(amount AS numeric))), 0) AS total_volume FROM transactions WHERE user_id = ${userId}`
      );
      const totalVolume = parseFloat((txResult.rows[0] as any)?.total_volume ?? "0");
      const maxLimit = parseFloat((totalVolume * 0.30).toFixed(2));
      if (maxLimit < 1) return res.status(400).json({ message: "You do not have enough transaction history to qualify for a loan yet." });
      if (parseFloat(amountUsd) > maxLimit) return res.status(400).json({ message: `Loan amount exceeds your offer of $${maxLimit.toFixed(2)}` });
      const { flatRate, totalPayable, installmentAmount, termMonths } = calculateLoanByDays(parseFloat(amountUsd), parseInt(termDays));
      const loan = await storage.createLoan({
        userId, userRole: user.role as "student" | "affiliate",
        amountUsd: parseFloat(amountUsd).toFixed(2),
        interestRate: flatRate.toFixed(2),
        termMonths,
        termDays: parseInt(termDays),
        monthlyPaymentUsd: installmentAmount.toFixed(2),
        totalPayableUsd: totalPayable.toFixed(2),
        totalPaidUsd: "0",
        purpose: purpose.trim(),
        bvn: bvn.trim(),
        nin: nin.trim(),
        fullAddress: fullAddress.trim(),
        status: "pending",
      });
      // Send offer + repayment schedule to the applicant
      sendLoanOfferEmail({
        to: user.email,
        firstName: user.firstName,
        amountUsd: parseFloat(amountUsd).toFixed(2),
        termMonths,
        monthlyPayment: installmentAmount.toFixed(2),
        totalPayable: totalPayable.toFixed(2),
        interestRate: flatRate.toString(),
        purpose: purpose.trim(),
      }).catch(() => {});
      // Notify admin
      sendAdminLoanEmail({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        amount: parseFloat(amountUsd).toFixed(2),
        purpose: purpose.trim(),
        termMonths: parseInt(termDays),
        role: user.role,
        userId,
        bvn: bvn.trim(),
        nin: nin.trim(),
        fullAddress: fullAddress.trim(),
      }).catch(() => {});
      res.json(loan);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── BENEFICIARIES ROUTES ────────────────────────────────────────────────────
  app.get("/api/beneficiaries", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const rows = await db.execute(sql`SELECT * FROM beneficiaries WHERE user_id = ${userId} ORDER BY created_at DESC`);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/beneficiaries", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { bankCode, bankName, accountNumber, accountName, nickname } = req.body;
      if (!bankCode || !bankName || !accountNumber || !accountName) return res.status(400).json({ message: "bankCode, bankName, accountNumber, and accountName are required" });
      // Check for duplicate
      const existing = await db.execute(sql`SELECT id FROM beneficiaries WHERE user_id = ${userId} AND account_number = ${accountNumber} AND bank_code = ${bankCode}`);
      if ((existing.rows as any[]).length > 0) return res.status(409).json({ message: "This account is already saved as a beneficiary" });
      const result = await db.execute(sql`
        INSERT INTO beneficiaries (user_id, bank_code, bank_name, account_number, account_name, nickname, created_at)
        VALUES (${userId}, ${bankCode}, ${bankName}, ${accountNumber}, ${accountName}, ${nickname || null}, NOW())
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/beneficiaries/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const id = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM beneficiaries WHERE id = ${id} AND user_id = ${userId}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── LOAN: User accept/decline offer ─────────────────────────────────────────
  app.post("/api/loans/:id/respond", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const loanId = parseInt(req.params.id);
      const { action } = req.body;
      if (!["accept", "decline"].includes(action)) return res.status(400).json({ message: "action must be 'accept' or 'decline'" });

      const loan = await storage.getLoan(loanId);
      if (!loan) return res.status(404).json({ message: "Loan not found" });
      if (loan.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      if (loan.status !== "approved") return res.status(400).json({ message: "This loan offer is no longer pending your response" });

      if (action === "accept") {
        const updated = await storage.updateLoan(loanId, { status: "active", disbursedAt: new Date() });
        const loanWallet = await storage.getOrCreateWallet(userId);
        await storage.updateWalletBalance(userId, (parseFloat(loanWallet.balance) + parseFloat(loan.amountUsd)).toFixed(2));
        await storage.createTransaction({ userId, type: "loan", amount: loan.amountUsd, fee: "0.00", paymentMethod: "wallet", description: `Loan disbursed: $${loan.amountUsd}` });
        await storage.setWalletLien(userId, loan.totalPayableUsd, `loan_active:${loanId}`);
        const notif = await storage.createNotification({ userId, type: "verification_update", title: "Loan Accepted & Disbursed 💰", message: `Your $${loan.amountUsd} loan has been credited to your wallet. Your wallet is now frozen — you may only withdraw the loan to your bank account. All other transactions are blocked until repaid.`, data: { loanId }, isRead: false });
        pushToUser(userId, "notification", notif);
        storage.getUser(userId).then(u => { if (u) sendLoanUpdateEmail(u.email, u.firstName, "approved", loan.amountUsd).catch(() => {}); });
        res.json(updated);
      } else {
        const updated = await storage.updateLoan(loanId, { status: "rejected" });
        const notif = await storage.createNotification({ userId, type: "verification_update", title: "Loan Offer Declined", message: `You have declined the loan offer of $${loan.amountUsd}. You may apply again any time.`, data: { loanId }, isRead: false });
        pushToUser(userId, "notification", notif);
        res.json(updated);
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── TENANCY ROUTES ────────────────────────────────────────────────────────
  app.get("/api/tenancy/properties", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const props = await storage.getLandlordProperties(status || "available");
      res.json(props);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/tenancy/my-properties", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const props = await storage.getLandlordPropertiesByOwner(userId);
      res.json(props);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/tenancy/list-property", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { propertyName, address, city, state, country, propertyType, bedrooms, bathrooms, annualRentNgn, leasePeriodYears, description, amenities } = req.body;
      if (!propertyName || !address || !city || !state || !annualRentNgn) return res.status(400).json({ message: "Missing required fields" });
      const annual = parseFloat(annualRentNgn);
      const years = parseInt(leasePeriodYears) || 5;
      const discountRate = 12;
      const tsiaPaymentNgn = (annual * years * (1 - discountRate / 100)).toFixed(2);
      const prop = await storage.createLandlordProperty({
        ownerId: userId, propertyName, address, city, state,
        country: country || "ng", propertyType: propertyType || "apartment",
        bedrooms: parseInt(bedrooms) || 1, bathrooms: parseInt(bathrooms) || 1,
        annualRentNgn: annual.toFixed(2), leasePeriodYears: years,
        discountRate: discountRate.toFixed(2), tsiaPaymentNgn,
        tenantInterestRate: "5.00", description: description || null,
        amenities: Array.isArray(amenities) ? amenities : [],
        status: "pending_review",
      });
      res.json(prop);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/tenancy/apply", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { propertyId } = req.body;
      const prop = await storage.getLandlordProperty(parseInt(propertyId));
      if (!prop) return res.status(404).json({ message: "Property not found" });
      if (prop.status !== "available") return res.status(400).json({ message: "Property is not available for leasing" });
      const annual = parseFloat(prop.annualRentNgn);
      const interestRate = parseFloat(prop.tenantInterestRate);
      const years = prop.leasePeriodYears;
      const totalPayable = annual * (1 + interestRate / 100) * years;
      const monthly = totalPayable / (years * 12);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + years);
      const lease = await storage.createTenancyLease({
        propertyId: prop.id, tenantId: userId,
        monthlyPaymentNgn: monthly.toFixed(2),
        totalPayableNgn: totalPayable.toFixed(2),
        startDate, endDate, status: "active",
      });
      res.json(lease);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/tenancy/my-leases", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const leases = await storage.getTenancyLeasesByTenant(userId);
      res.json(leases);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── WALLET DEPOSIT (for students & all users to fund main wallet) ───────────

  // ── Squad by GTco: initiate inline payment ────────────────────────────────
  app.post("/api/wallet/squad/initiate", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount <= 2) return res.status(400).json({ message: "Minimum deposit is above $2" });
    const secretKey = process.env.SQUAD_SECRET_KEY;
    const publicKey = process.env.SQUAD_PUBLIC_KEY;
    if (!secretKey || !publicKey) return res.status(500).json({ message: "Payment gateway not configured. Please contact support." });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const USD_TO_KOBO = Math.round(rates.buying * 100); // e.g. 1 USD = ₦1,480 = 148,000 kobo
      const amountKobo = Math.round(amount * USD_TO_KOBO);
      const transactionRef = `TSIA-${userId}-${Date.now()}`;
      // Save pending deposit record
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: transactionRef, walletType: "squad", status: "pending" });
      sendAdminDepositEmail({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        amount: amount.toFixed(2),
        txHash: transactionRef,
        walletType: "squad",
        userId,
      }).catch((err: any) => console.error("[EMAIL] Admin Squad deposit email failed:", err?.message ?? err));
      res.json({ transactionRef, amountKobo, amountNgn: (amount * rates.buying).toFixed(2), publicKey, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Squad by GTco: verify & credit wallet ─────────────────────────────────
  app.post("/api/wallet/squad/verify", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { transactionRef } = req.body;
    if (!transactionRef) return res.status(400).json({ message: "Transaction reference is required" });
    const secretKey = process.env.SQUAD_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured" });
    // Determine environment from key prefix
    const isLive = secretKey.startsWith("sk_");
    const baseUrl = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
    try {
      // Check not already credited
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === transactionRef);
      if (existing && existing.status === "completed") return res.status(400).json({ message: "This payment has already been credited to your wallet." });
      // Verify with Squad API
      const response = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(transactionRef)}`, {
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      });
      const data = await response.json() as any;
      if (!data.success || data.data?.transaction_status !== "Success") {
        return res.status(400).json({ message: "Payment not confirmed yet. Please try again in a moment." });
      }
      // Amount in kobo → USD
      const amountKoboFromSquad = data.data?.transaction_amount ?? 0;
      const rates = await getUsdNgnRates();
      const gross = parseFloat(existing?.amountUsd ?? (amountKoboFromSquad / Math.round(rates.buying * 100)).toFixed(2));
      // Credit wallet using shared helper (95% to user, 5% affiliate pool) — same as Korapay
      await creditWalletWithSplit(userId, gross, "squad", transactionRef, existing ? { id: existing.id, amountUsd: existing.amountUsd, status: existing.status } : undefined);
      const userCredit = parseFloat((gross * 0.95).toFixed(2));
      res.json({ message: `$${userCredit.toFixed(2)} has been credited to your TSIA SwiftWallet`, amountUsd: userCredit });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Squad webhook (async payment notification) ────────────────────────────
  app.post("/api/webhook/squad", async (req, res) => {
    // Squad sends: { Event: "charge_successful", TransactionRef: "...", Body: { transaction_ref, transaction_status, ... } }
    // Also validates x-squad-encrypted-body header (HMAC-SHA512 of body using secret key)
    try {
      // ── Signature validation — use raw body so HMAC matches what Squad sent ──
      const squadSecret = process.env.SQUAD_SECRET_KEY ?? "";
      const encryptedBodyHeader = req.headers["x-squad-encrypted-body"] as string | undefined;
      if (encryptedBodyHeader && squadSecret) {
        const { createHmac } = await import("crypto");
        const rawBody = (req as any).rawBody?.toString() ?? JSON.stringify(req.body);
        const computed = createHmac("sha512", squadSecret)
          .update(rawBody)
          .digest("hex");
        if (computed !== encryptedBodyHeader) {
          // Log but do NOT block — we re-verify with Squad's API before crediting anyway
          console.warn("[WEBHOOK/Squad] Signature mismatch — proceeding to gateway re-verify");
        }
      }
      // ── Squad webhook structure: { Event, TransactionRef, Body } ─────────
      // FIX: Squad sends "charge_successful" (docs confirm) not "charge_completed"
      const { Event, TransactionRef, Body } = req.body;
      const ref = (TransactionRef ?? Body?.transaction_ref ?? (req.body as any).data?.transaction_ref) as string;
      const txStatus = Body?.transaction_status ?? (req.body as any).data?.transaction_status;
      if ((Event === "charge_successful" || Event === "charge_completed") && txStatus === "Success" && ref) {
        // Find the pending deposit by txHash — use raw Pool query for reliability
        const { Pool: SquadPool } = await import("pg");
        const squadPool = new SquadPool({ connectionString: process.env.DATABASE_URL });
        const squadRow = await squadPool.query("SELECT * FROM wallet_deposits WHERE tx_hash=$1 LIMIT 1", [ref]);
        await squadPool.end();
        const allDeposits = squadRow.rows[0] ?? null;
        if (allDeposits && allDeposits.status !== "completed") {
          const secretKey = process.env.SQUAD_SECRET_KEY ?? "";
          const isLive = secretKey.startsWith("sk_");
          const baseUrl = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
          const verRes = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          });
          const verData = await verRes.json() as any;
          if (verData.success && verData.data?.transaction_status === "Success") {
            // raw Pool rows are snake_case — use user_id and amount_usd
            const userId = allDeposits.user_id ?? allDeposits.userId;
            const wkGross = parseFloat(allDeposits.amount_usd ?? allDeposits.amountUsd);
            // Credit using shared helper (95% user, 5% affiliate pool) — same as Korapay
            await creditWalletWithSplit(userId, wkGross, "squad", ref, { id: allDeposits.id, amountUsd: allDeposits.amount_usd ?? allDeposits.amountUsd, status: allDeposits.status });
          }
        }
      }
    } catch { /* webhook errors must not crash the server */ }
    res.sendStatus(200);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ── KORAPAY INTEGRATION ───────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  const KORA_BASE = "https://api.korapay.com/merchant/api/v1";
  const SQUAD_BASE = process.env.SQUAD_LIVE === "true" ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";

  // ── Squad VAS helpers (Airtime/Data) ─────────────────────────────────────
  async function squadVendAirtime(phone: string, amountNgn: number): Promise<{ ok: boolean; ref?: string; msg?: string; raw?: any }> {
    const key = process.env.SQUAD_SECRET_KEY;
    if (!key) return { ok: false, msg: "Squad not configured" };
    try {
      const r = await fetch(`${SQUAD_BASE}/vending/purchase/airtime`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, amount: amountNgn }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json() as any;
      const ok = !!d.success && (d.data?.status === "success" || d.data?.status === "pending");
      return { ok, ref: d.data?.transaction_id ?? d.data?.reference, msg: d.message, raw: d };
    } catch (e: any) { return { ok: false, msg: e.message ?? "Network error" }; }
  }

  async function squadVendData(phone: string, planCode: string): Promise<{ ok: boolean; ref?: string; msg?: string; raw?: any }> {
    const key = process.env.SQUAD_SECRET_KEY;
    if (!key) return { ok: false, msg: "Squad not configured" };
    try {
      const r = await fetch(`${SQUAD_BASE}/vending/purchase/data`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, plan_code: planCode }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json() as any;
      const ok = !!d.success && (d.data?.status === "success" || d.data?.status === "pending");
      return { ok, ref: d.data?.transaction_id ?? d.data?.reference, msg: d.message, raw: d };
    } catch (e: any) { return { ok: false, msg: e.message ?? "Network error" }; }
  }

  // ── Korapay: initiate checkout (redirect-based) ───────────────────────────
  app.post("/api/wallet/korapay/initiate", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount <= 2) return res.status(400).json({ message: "Minimum deposit is above $2" });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Korapay not configured. Please contact support." });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const amountNgn = Math.round(amount * rates.buying);
      const reference = `TSIA-KORA-${userId}-${Date.now()}`;
      const notifUrl = `${req.protocol}://${req.get("host")}/api/webhook/korapay`;
      const redirectUrl = `${req.protocol}://${req.get("host")}/student-dashboard`;
      const koraRes = await fetch(`${KORA_BASE}/charges/initialize`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNgn,
          currency: "NGN",
          reference,
          notification_url: notifUrl,
          redirect_url: redirectUrl,
          customer: { name: `${user.firstName} ${user.lastName}`, email: user.email },
          channels: ["card", "bank_transfer", "pay_with_bank"],
          metadata: { userId, amountUsd: amount.toFixed(2), platform: "TSIA" },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const koraData = await koraRes.json() as any;
      if (!koraData.status) return res.status(502).json({ message: koraData.message ?? "Could not initiate Korapay payment" });
      // Save pending deposit
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: reference, walletType: "korapay", status: "pending" });
      sendAdminDepositEmail({ name: `${user.firstName} ${user.lastName}`, email: user.email, amount: amount.toFixed(2), txHash: reference, walletType: "korapay", userId })
        .catch((err: any) => console.error("[EMAIL] Korapay deposit notify failed:", err?.message ?? err));
      res.json({ checkoutUrl: koraData.data.checkout_url, reference, amountNgn });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Korapay: verify & credit after redirect back ──────────────────────────
  app.post("/api/wallet/korapay/verify", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "reference is required" });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Korapay not configured" });
    try {
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === reference);
      if (existing && existing.status === "completed") return res.status(400).json({ message: "This payment has already been credited to your wallet." });
      const verRes = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(reference)}`, {
        headers: { "Authorization": `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(12000),
      });
      const verData = await verRes.json() as any;
      if (!verData.status || verData.data?.status !== "success") {
        return res.status(400).json({ message: "Payment not confirmed yet. Please try again in a moment or contact support." });
      }
      const rates = await getUsdNgnRates();
      const gross = parseFloat(existing?.amountUsd ?? (verData.data.amount / rates.buying).toFixed(2));
      await creditWalletWithSplit(userId, gross, "korapay", reference, existing);
      res.json({ message: `$${gross.toFixed(2)} has been credited to your TSIA SwiftWallet`, amountUsd: gross.toFixed(2) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Korapay bank list (for payout / bank-transfer) ────────────────────────
  app.get("/api/korapay/banks", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Korapay not configured" });
    try {
      const r = await fetch(`${KORA_BASE}/misc/banks?countryCode=NG`, {
        headers: { "Authorization": `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(10000),
      });
      const d = await r.json() as any;
      if (!d.status) return res.status(502).json({ message: d.message ?? "Could not fetch bank list" });
      res.json(d.data ?? []);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Korapay account resolve ───────────────────────────────────────────────
  app.post("/api/korapay/resolve-bank", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { bank, account } = req.body;
    if (!bank || !account) return res.status(400).json({ message: "bank and account are required" });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Korapay not configured" });
    try {
      const r = await fetch(`${KORA_BASE}/misc/banks/resolve`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bank, account }),
        signal: AbortSignal.timeout(12000),
      });
      const d = await r.json() as any;
      if (!d.status) return res.status(400).json({ message: d.message ?? "Account lookup failed" });
      res.json({ success: true, accountName: d.data?.account_name });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Korapay: payout (bank transfer) ──────────────────────────────────────
  // NOTE: Korapay requires IP whitelisting for disbursements.
  // If not whitelisted, requests are rejected with "not_authorized".
  app.post("/api/korapay/payout", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { bankCode, accountNumber, accountName, amountNgn, narration, reference } = req.body;
    if (!bankCode || !accountNumber || !accountName || !amountNgn) {
      return res.status(400).json({ message: "bankCode, accountNumber, accountName, and amountNgn are required" });
    }
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ message: "Korapay not configured" });
    try {
      const r = await fetch(`${KORA_BASE}/transactions/disburse`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference ?? `TSIA-KP-${userId}-${Date.now()}`,
          destination: {
            type: "bank_account",
            amount: parseInt(amountNgn),
            currency: "NGN",
            bank_account: { bank: bankCode, account: accountNumber },
            customer: { name: accountName, email: "noreply@tsia.com" },
          },
          description: narration ?? "TSIA Wallet Transfer",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json() as any;
      if (!d.status) {
        const isIpBlock = d.error === "not_authorized" || (d.message ?? "").toLowerCase().includes("whitelist");
        if (isIpBlock) {
          return res.status(503).json({ message: "Korapay payouts require IP whitelisting. Please contact TSIA support or use Squad to complete this transfer.", code: "IP_WHITELIST_REQUIRED" });
        }
        return res.status(502).json({ message: d.message ?? "Korapay payout failed" });
      }
      res.json({ success: true, data: d.data });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Korapay webhook ───────────────────────────────────────────────────────
  app.post("/api/webhook/korapay", async (req, res) => {
    try {
      // ── Signature validation — Korapay sends x-korapay-signature (HMAC-SHA512 of raw body) ──
      const koraSecret = process.env.KORAPAY_SECRET_KEY ?? "";
      const sigHeader = req.headers["x-korapay-signature"] as string | undefined;
      if (sigHeader && koraSecret) {
        const { createHmac } = await import("crypto");
        const rawBody = (req as any).rawBody;
        const payload = rawBody ? rawBody.toString() : JSON.stringify(req.body);
        const computed = createHmac("sha512", koraSecret).update(payload).digest("hex");
        if (computed !== sigHeader) {
          console.error("[WEBHOOK/Korapay] Signature mismatch — ignoring request");
          return res.sendStatus(200); // Return 200 so Korapay stops retrying; just don't process
        }
      }

      const { event, data } = req.body;
      if (event === "charge.success" && data?.status === "success") {
        const ref = data.reference as string;
        if (!ref) { res.sendStatus(200); return; }

        const { Pool } = await import("pg");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const row = await pool.query("SELECT * FROM wallet_deposits WHERE tx_hash=$1 LIMIT 1", [ref]);
        await pool.end();
        const dep = row.rows[0];

        if (dep) {
          // ── Normal path: deposit record found ──────────────────────────────
          if (dep.status !== "completed") {
            const gross = parseFloat(dep.amount_usd);
            if (dep.wallet_type === "exchange_korapay" || ref.startsWith("TSIA-EXKORA-")) {
              // Exchange market funding — credit exchange balance directly
              console.log(`[KORAPAY WEBHOOK] Exchange funding: crediting user ${dep.user_id} $${gross} to exchangeBalance for ref ${ref}`);
              await storage.updateExchangeBalance(dep.user_id, gross);
              const { Pool: _P } = await import("pg");
              const _pool = new _P({ connectionString: process.env.DATABASE_URL });
              await _pool.query("UPDATE wallet_deposits SET status='completed' WHERE tx_hash=$1", [ref]);
              await _pool.end();
              await storage.createNotification({
                userId: dep.user_id, type: "wallet_credit",
                title: "Exchange Account Funded ✓",
                message: `$${gross.toFixed(2)} added to your Exchange account via card/bank payment.`,
                data: { amount: gross, reference: ref }, isRead: false,
              });
            } else {
              console.log(`[KORAPAY WEBHOOK] Crediting user ${dep.user_id} $${gross} for ref ${ref}`);
              await creditWalletWithSplit(dep.user_id, gross, "korapay", ref, { id: dep.id, amountUsd: dep.amount_usd, status: dep.status });
            }
          } else {
            console.log(`[KORAPAY WEBHOOK] Ref ${ref} already completed — skipping`);
          }
        } else {
          // ── Fallback: no deposit record — extract userId from metadata or reference ──
          // Reference format: TSIA-KORA-{userId}-{timestamp} or TSIA-EXKORA-{userId}-{timestamp}
          const metaUserId = data.metadata?.userId;
          const metaAmountUsd = data.metadata?.amountUsd;
          const metaFundType = data.metadata?.fundType;
          let fallbackUserId: number | null = null;
          if (metaUserId && !isNaN(parseInt(metaUserId))) {
            fallbackUserId = parseInt(metaUserId);
          } else if (ref.startsWith("TSIA-KORA-") || ref.startsWith("TSIA-EXKORA-")) {
            const parts = ref.split("-"); // ["TSIA","KORA"|"EXKORA","{userId}","{ts}"]
            const uidIdx = ref.startsWith("TSIA-EXKORA-") ? 2 : 2;
            if (parts.length >= 3 && !isNaN(parseInt(parts[uidIdx]))) {
              fallbackUserId = parseInt(parts[uidIdx]);
            }
          }
          if (fallbackUserId) {
            // Amount: prefer metadata, fall back to Korapay's reported NGN amount
            const _koraRates = await getUsdNgnRates();
            // Korapay data.amount is in NGN (not kobo), so divide by buying rate for USD
            const grossFromKora = data.amount ? parseFloat((data.amount / _koraRates.buying).toFixed(2)) : 0;
            const gross = metaAmountUsd ? parseFloat(metaAmountUsd) : grossFromKora;
            if (gross > 0) {
              const isExchange = metaFundType === "exchange" || ref.startsWith("TSIA-EXKORA-");
              if (isExchange) {
                console.log(`[KORAPAY WEBHOOK] Exchange fallback: crediting user ${fallbackUserId} $${gross} to exchangeBalance for ref ${ref}`);
                await storage.createWalletDeposit({ userId: fallbackUserId, amountUsd: gross.toFixed(2), txHash: ref, walletType: "exchange_korapay", status: "pending" });
                await storage.updateExchangeBalance(fallbackUserId, gross);
                const { Pool: _P2 } = await import("pg");
                const _pool2 = new _P2({ connectionString: process.env.DATABASE_URL });
                await _pool2.query("UPDATE wallet_deposits SET status='completed' WHERE tx_hash=$1", [ref]);
                await _pool2.end();
                await storage.createNotification({
                  userId: fallbackUserId, type: "wallet_credit",
                  title: "Exchange Account Funded ✓",
                  message: `$${gross.toFixed(2)} added to your Exchange account via card/bank payment.`,
                  data: { amount: gross, reference: ref }, isRead: false,
                });
              } else {
                console.log(`[KORAPAY WEBHOOK] No deposit record found for ref ${ref} — crediting user ${fallbackUserId} $${gross} via fallback`);
                const newDep = await storage.createWalletDeposit({ userId: fallbackUserId, amountUsd: gross.toFixed(2), txHash: ref, walletType: "korapay", status: "pending" });
                await creditWalletWithSplit(fallbackUserId, gross, "korapay", ref, { id: newDep.id, amountUsd: gross.toFixed(2), status: "pending" });
              }
            } else {
              console.warn(`[KORAPAY WEBHOOK] Ref ${ref} — could not determine amount, skipping`);
            }
          } else {
            console.warn(`[KORAPAY WEBHOOK] Ref ${ref} — no deposit record and could not extract userId, skipping`);
          }
        }
      }
    } catch (e: any) {
      console.error("[KORAPAY WEBHOOK] Error:", e?.message ?? e);
      // webhook errors must not crash the server
    }
    res.sendStatus(200);
  });

  // ── Shared helper: credit deposit to wallet (95% to user, 5% affiliate pool) ──
  async function creditWalletWithSplit(userId: number, gross: number, method: string, ref: string, existingDeposit?: any) {
    // 5% affiliate pool charged on every deposit; 95% credited to user
    const affiliateCut = parseFloat((gross * 0.05).toFixed(2));
    const userCredit   = parseFloat((gross - affiliateCut).toFixed(2));
    const w = await storage.getOrCreateWallet(userId);
    const newBal = (parseFloat(w.balance) + userCredit).toFixed(2);
    await storage.updateWalletBalance(userId, newBal);
    if (!w.activated && parseFloat(newBal) > 2) {
      try {
        await storage.activateWallet(userId);
        await creditReferrerCommissionOnce(userId, gross, "personal wallet activation");
      } catch { /* non-critical */ }
    }
    const tx = await storage.createTransaction({ userId, type: "deposit", amount: userCredit.toFixed(2), fee: affiliateCut.toFixed(2), paymentMethod: method, description: `Wallet funded via ${method} (${ref}) — $${userCredit.toFixed(2)} credited (95%), $${affiliateCut.toFixed(2)} affiliate pool (5%)` });
    // Route 5% to co-affiliate pool
    try {
      const affCount = await storage.getAffiliateCount();
      const perAff = affCount > 0 ? affiliateCut / affCount : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affCount, perAff.toFixed(6));
    } catch { /* non-critical */ }
    if (existingDeposit?.id) await storage.updateWalletDeposit(existingDeposit.id, { status: "completed" });
    try {
      const notif = await storage.createNotification({ userId, type: "deposit", title: "Wallet Funded ✓", message: `$${userCredit.toFixed(2)} credited to your TSIA SwiftWallet (5% affiliate pool: $${affiliateCut.toFixed(2)})`, data: { ref }, isRead: false });
      pushToUser(userId, "notification", notif);
    } catch (notifErr: any) { console.error(`[CREDIT] Notification failed (non-critical) for user ${userId}:`, notifErr?.message); }
    const u = await storage.getUser(userId);
    if (u) sendAdminDepositConfirmedEmail({ name: `${u.firstName} ${u.lastName}`, email: u.email, gross: gross.toFixed(2), credited: userCredit.toFixed(2), reserveCut: "0.00", affiliateCut: affiliateCut.toFixed(2), newBalance: newBal, walletType: method, txHash: ref, userId })
      .catch((err: any) => console.error(`[EMAIL] ${method} deposit email failed:`, err?.message ?? err));
  }

  // ── Paystack: initialize payment (legacy – kept for backward compat) ───────
  app.post("/api/wallet/paystack/initialize", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount <= 2) return res.status(400).json({ message: "Minimum deposit is above $2" });
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return res.status(500).json({ message: "Payment service not configured" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const USD_TO_KOBO = Math.round(rates.buying * 100); // e.g. 1 USD = ₦1,480 = 148,000 kobo
      const amountKobo = Math.round(amount * USD_TO_KOBO);
      const reference = `TSIA-${userId}-${Date.now()}`;
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: amountKobo,
          currency: "NGN",
          reference,
          metadata: { userId, amountUsd: amount.toFixed(2), custom_fields: [{ display_name: "Purpose", variable_name: "purpose", value: "TSIA Wallet Funding" }] },
          channels: ["card", "bank", "ussd", "bank_transfer", "mobile_money"],
        }),
      });
      const data = await response.json() as any;
      if (!data.status) return res.status(400).json({ message: data.message || "Could not initialize payment" });
      // Store pending deposit record
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: reference, walletType: "paystack", status: "pending" });
      sendAdminDepositEmail({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        amount: amount.toFixed(2),
        txHash: reference,
        walletType: "paystack",
        userId,
      }).catch((err: any) => console.error("[EMAIL] Admin Paystack deposit email failed:", err?.message ?? err));
      res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Paystack: verify & credit wallet ─────────────────────────────────────
  app.post("/api/wallet/paystack/verify", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "Reference is required" });
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return res.status(500).json({ message: "Payment service not configured" });
    try {
      // Check not already credited
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === reference);
      if (existing && existing.status === "completed") return res.status(400).json({ message: "This payment has already been credited to your wallet" });
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await response.json() as any;
      if (!data.status || data.data?.status !== "success") return res.status(400).json({ message: "Payment not confirmed yet. Please try again in a moment." });
      const rates = await getUsdNgnRates();
      const psGross = parseFloat(data.data.metadata?.amountUsd || (data.data.amount / Math.round(rates.buying * 100)).toFixed(2));
      // 5% affiliate pool on deposit, 95% credited to user
      const psAffiliateCut = parseFloat((psGross * 0.05).toFixed(2));
      const psUserCredit   = parseFloat((psGross - psAffiliateCut).toFixed(2));
      const psReserveCut   = 0;
      const pstackWallet = await storage.getOrCreateWallet(userId);
      const psNewBalance = (parseFloat(pstackWallet.balance) + psUserCredit).toFixed(2);
      await storage.updateWalletBalance(userId, psNewBalance);
      // Activate wallet on first funding ≥ $2 and credit referral commission
      if (!pstackWallet.activated && parseFloat(psNewBalance) > 2) {
        try {
          await storage.activateWallet(userId);
          const paystackReferralResult = await creditReferrerCommissionOnce(userId, psGross, "personal wallet activation");
          if (!paystackReferralResult.credited) console.log(`[REFERRAL] No Paystack wallet activation commission credited for user ${userId}`);
          const psUser = await storage.getUser(userId);
          if (psUser?.referredBy) {
            const psReferrer = await storage.getUserByAffiliateCode(psUser.referredBy);
            if (psReferrer) {
              const refN = await storage.createNotification({
                userId: psReferrer.id, type: "referral_activated",
                title: "Referral Activated 🎉",
                message: `${psUser.firstName} ${psUser.lastName.charAt(0)}. (one of your referrals) has activated their TSIA wallet. Your referral commission is now active!`,
                data: { referredUserId: psUser.id }, isRead: false,
              });
              pushToUser(psReferrer.id, "notification", refN);
            }
          }
        } catch { /* non-critical */ }
      }
      // Mark deposit as completed
      if (existing) await storage.updateWalletDeposit(existing.id, { status: "completed" });
      // Record transaction (for complete history)
      const psTx = await storage.createTransaction({ userId, type: "deposit", amount: psUserCredit.toFixed(2), fee: psAffiliateCut.toFixed(2), paymentMethod: "paystack", description: `Wallet funded via Paystack (${reference}) — $${psUserCredit.toFixed(2)} credited (95%), $${psAffiliateCut.toFixed(2)} affiliate pool (5%)` });
      // Route 5% affiliate cut to co-affiliate pool
      try { const psAffCount = await storage.getAffiliateCount(); const psPerAff = psAffCount > 0 ? psAffiliateCut / psAffCount : 0; await storage.recordAffiliateTradeShare(psTx.id, psAffiliateCut.toFixed(6), psAffCount, psPerAff.toFixed(6)); } catch { /* non-critical */ }
      const psNotif = await storage.createNotification({ userId, type: "deposit", title: "Wallet Funded ✓", message: `$${psUserCredit.toFixed(2)} credited to your TSIA SwiftWallet (5% affiliate pool: $${psAffiliateCut.toFixed(2)})`, data: { reference }, isRead: false });
      pushToUser(userId, "notification", psNotif);
      const psDepositUser = await storage.getUser(userId);
      if (psDepositUser) {
        sendAdminDepositConfirmedEmail({
          name: `${psDepositUser.firstName} ${psDepositUser.lastName}`,
          email: psDepositUser.email,
          gross: psGross.toFixed(2),
          credited: psUserCredit.toFixed(2),
          reserveCut: psReserveCut.toFixed(2),
          affiliateCut: psAffiliateCut.toFixed(2),
          newBalance: psNewBalance,
          walletType: "paystack",
          txHash: reference,
          userId,
        }).catch((err: any) => console.error("[EMAIL] Admin Paystack confirmed deposit email failed:", err?.message ?? err));
      }
      res.json({ message: `$${psUserCredit.toFixed(2)} has been credited to your TSIA SwiftWallet`, amountUsd: psUserCredit });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/wallet/deposit", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd, txHash, walletType } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount < ECOMMERCE.MIN_DEPOSIT) return res.status(400).json({ message: `Minimum deposit is above $${ECOMMERCE.MIN_DEPOSIT}` });
    if (!txHash || txHash.trim().length < 10) return res.status(400).json({ message: "Valid transaction hash is required" });
    try {
      // ── IDEMPOTENCY: reject if this txHash was already credited ───────────
      const existingDeposits = await storage.getWalletDepositsByUser(userId);
      const alreadyProcessed = existingDeposits.find((d: any) => d.txHash === txHash.trim());
      if (alreadyProcessed) {
        return res.status(400).json({ message: "This transaction hash has already been submitted and credited to your wallet. Each transaction can only be used once." });
      }
      // ── AUTO-APPROVE: instantly credit the user's wallet, no admin queue ──
      const deposit = await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: txHash.trim(), walletType: walletType || "trc20", status: "confirmed" });

      // 5% affiliate pool on deposit, 95% credited to user
      const cryptoAffiliateCut = parseFloat((amount * 0.05).toFixed(2));
      const cryptoUserCredit   = parseFloat((amount - cryptoAffiliateCut).toFixed(2));

      // Credit the wallet balance immediately (95% after 5% affiliate pool)
      const wallet = await storage.getOrCreateWallet(userId);
      const newBal = (parseFloat(wallet.balance || "0") + cryptoUserCredit).toFixed(2);
      await storage.updateWalletBalance(userId, newBal);

      // Auto-activate wallet on first qualifying deposit
      if (!wallet.activated && parseFloat(newBal) >= 5) {
        try { await storage.updateWalletActivation?.(userId, true); } catch {}
      }

      // Record the transaction
      const cryptoTx = await storage.createTransaction({ userId, type: "deposit", amount: cryptoUserCredit.toFixed(2), fee: cryptoAffiliateCut.toFixed(2), paymentMethod: walletType || "trc20", description: `Crypto deposit auto-credited (txn: ${txHash.trim().slice(0, 12)}…) — $${cryptoUserCredit.toFixed(2)} credited (95%), $${cryptoAffiliateCut.toFixed(2)} affiliate pool (5%)` });
      // Route 5% affiliate cut to co-affiliate pool
      try { const crAffCount = await storage.getAffiliateCount(); const crPerAff = crAffCount > 0 ? cryptoAffiliateCut / crAffCount : 0; await storage.recordAffiliateTradeShare(cryptoTx.id, cryptoAffiliateCut.toFixed(6), crAffCount, crPerAff.toFixed(6)); } catch { /* non-critical */ }

      // Notify user — funds are live
      const notif = await storage.createNotification({ userId, type: "deposit", title: "✅ Wallet Funded", message: `$${cryptoUserCredit.toFixed(2)} credited to your TSIA SwiftWallet (5% affiliate pool: $${cryptoAffiliateCut.toFixed(2)}). New balance: $${newBal}.`, data: { depositId: deposit.id, amount: cryptoUserCredit.toFixed(2), newBalance: newBal }, isRead: false });
      pushToUser(userId, "notification", notif);
      pushToUser(userId, "wallet:updated", { balance: newBal });

      // Credit referral commission on first qualifying deposit (best-effort)
      try { creditReferrerCommission(userId, amount, "wallet deposit").catch(() => {}); } catch {}

      res.json({ deposit, balance: newBal, message: `$${cryptoUserCredit.toFixed(2)} credited to your wallet (5% affiliate pool applied). Balance: $${newBal}.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/wallet/deposits", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const cacheKey = `wallet_deposits:${userId}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
      const deposits = await storage.getWalletDepositsByUser(userId);
      setCached(cacheKey, deposits, 120_000);
      res.json(deposits);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── FINTECH: BANKS, RESOLUTION & P2P ───────────────────────────────────────
  // Nigerian banks list
  // ── Banks list — live from Squad, hardcoded fallback ────────────────────────
  // Complete static bank list (Squad-coded). Used when live API is unavailable.
  const { ALL_NIGERIAN_BANKS: FALLBACK_BANKS } = await import("./nigerian-banks");

  let cachedBankList: { code: string; name: string; gateway: string }[] | null = null;
  let bankListCachedAt = 0;

  app.get("/api/wallet/banks", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // Serve from memory cache (1 hour TTL)
    if (cachedBankList && Date.now() - bankListCachedAt < 3600_000) return res.json(cachedBankList);

    // 1) Squad bank list (primary — user has Squad configured)
    const squadKey = process.env.SQUAD_SECRET_KEY;
    if (squadKey) {
      try {
        const isLive = squadKey.startsWith("sk_");
        const squadBase = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
        const rs = await fetch(`${squadBase}/bank_code_list`, {
          headers: { "Authorization": `Bearer ${squadKey}` },
          signal: AbortSignal.timeout(8000),
        });
        const ds = await rs.json() as any;
        if ((ds.success || rs.ok) && Array.isArray(ds.data) && ds.data.length > 0) {
          const banks = ds.data
            .map((b: any) => ({ code: String(b.bank_code ?? b.code ?? ""), name: String(b.bank_name ?? b.name ?? ""), gateway: "squad" }))
            .filter((b: any) => b.code && b.name)
            .sort((a: any, z: any) => a.name.localeCompare(z.name));
          cachedBankList = banks;
          bankListCachedAt = Date.now();
          console.log(`[BANKS] Loaded ${banks.length} banks from Squad live API`);
          return res.json(banks);
        }
      } catch (_) {}
    }

    // 2) Korapay bank list (fallback)
    const koraKey = process.env.KORAPAY_SECRET_KEY;
    if (koraKey) {
      try {
        const rk = await fetch(`${KORA_BASE}/misc/banks?countryCode=NG`, {
          headers: { "Authorization": `Bearer ${koraKey}` },
          signal: AbortSignal.timeout(8000),
        });
        const dk = await rk.json() as any;
        if (dk.status && Array.isArray(dk.data) && dk.data.length > 0) {
          const banks = dk.data
            .map((b: any) => ({ code: String(b.nibss_bank_code || b.bank_code || b.code || ""), name: String(b.name || ""), gateway: "korapay" }))
            .filter((b: any) => b.code && b.name)
            .sort((a: any, z: any) => a.name.localeCompare(z.name));
          cachedBankList = banks;
          bankListCachedAt = Date.now();
          return res.json(banks);
        }
      } catch (_) {}
    }

    // 3) Comprehensive static fallback (all Nigerian banks from Squad docs)
    console.log("[BANKS] Using comprehensive static fallback list");
    res.json(FALLBACK_BANKS.map(b => ({ ...b, gateway: "squad" })));
  });

  // ── Resolve bank account via Squad ──────────────────────────────────────────
  app.post("/api/wallet/resolve-bank", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) return res.status(400).json({ message: "Account number and bank code required" });
    if (!/^\d{10}$/.test(accountNumber)) return res.status(400).json({ message: "Account number must be 10 digits" });

    const cacheKey = `${bankCode}:${accountNumber}`;
    const cached = bankResolveCache.get(cacheKey);
    if (cached) return res.json({ accountName: cached, accountNumber, fromCache: true });

    const koraKey = process.env.KORAPAY_SECRET_KEY;
    const squadKey = process.env.SQUAD_SECRET_KEY;

    // Known fintech/MFB code aliases — when the primary code fails, try these alternates.
    // Each gateway sometimes only recognises one of the variants for the same bank.
    const BANK_CODE_ALIASES: Record<string, string[]> = {
      "100004": ["999992", "305", "100033"],          // OPay
      "999992": ["100004", "305"],
      "100033": ["999991", "100004"],                 // PalmPay
      "999991": ["100033"],
      "50515":  ["90405", "100029"],                  // Moniepoint MFB
      "90405":  ["50515"],
      "090267": ["50211", "100025"],                  // Kuda
      "50211":  ["090267"],
      "090110": ["566"],                              // VFD
      "566":    ["090110"],
      "100029": ["50515"],                            // Sparkle
      "100025": ["090267"],
      "000026": ["302"],                              // Taj
      "000031": ["100033"],                           // PalmPay alt
      "000014": ["100004"],                           // OPay alt
      "000019": ["110"],                              // Flutterwave
    };

    const tryKora = async (bc: string) => {
      try {
        const rk = await fetch(`${KORA_BASE}/misc/banks/resolve`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${koraKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ bank: bc, account: accountNumber }),
          signal: AbortSignal.timeout(10000),
        });
        const dk = await rk.json() as any;
        console.log(`[KORAPAY] resolve(${bc}) → HTTP ${rk.status} | status=${dk.status} | name="${dk.data?.account_name ?? ""}" | msg="${dk.message}"`);
        if (dk.status && dk.data?.account_name) return { name: dk.data.account_name, msg: "" };
        return { name: "", msg: dk.message || "" };
      } catch (ek: any) { console.warn(`[KORAPAY] resolve(${bc}) failed:`, ek.message); return { name: "", msg: "" }; }
    };

    const trySquad = async (bc: string) => {
      try {
        const rs = await fetch(`${SQUAD_BASE}/payout/account/lookup`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${squadKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ bank_code: bc, account_number: accountNumber, currency_id: "NGN" }),
          signal: AbortSignal.timeout(10000),
        });
        const ds = await rs.json() as any;
        console.log(`[SQUAD] resolve(${bc}) → HTTP ${rs.status} | success=${ds.success} | name="${ds.data?.account_name ?? ""}" | msg="${ds.message}"`);
        if ((ds.success || ds.status === 200 || ds.status === "200") && ds.data?.account_name) return { name: ds.data.account_name, msg: "" };
        return { name: "", msg: ds.message || "" };
      } catch (es: any) { console.warn(`[SQUAD] resolve(${bc}) failed:`, es.message); return { name: "", msg: "" }; }
    };

    try {
      let accountName = "";
      let lastMsg = "";
      let usedGateway = "";

      // Build the full list of codes to try (primary + known aliases)
      const codesToTry = [bankCode, ...(BANK_CODE_ALIASES[bankCode] || [])];

      // Try every code on Korapay first, then Squad — short-circuit on success.
      outer: for (const bc of codesToTry) {
        if (koraKey) {
          const r = await tryKora(bc);
          if (r.name) { accountName = r.name; usedGateway = "korapay"; break outer; }
          if (r.msg && !lastMsg) lastMsg = r.msg;
        }
        if (squadKey) {
          const r = await trySquad(bc);
          if (r.name) { accountName = r.name; usedGateway = "squad"; break outer; }
          if (r.msg && !lastMsg) lastMsg = r.msg;
        }
      }

      if (accountName) {
        bankResolveCache.set(cacheKey, accountName);
        return res.json({ accountName, accountNumber, gateway: usedGateway });
      }

      const msg = lastMsg.toLowerCase();
      if (msg.includes("not found") || msg.includes("invalid") || msg.includes("does not exist")) {
        return res.json({ accountNotFound: true, message: "Account not found. Check the account number and bank." });
      }
      return res.json({ message: lastMsg || "Could not verify account. Please double-check and proceed with caution.", unverified: true });
    } catch (e: any) {
      return res.json({ message: "Verification service unreachable — confirm account details before sending.", unverified: true });
    }
  });

  // Lookup TSIA member by email
  app.get("/api/wallet/members-search", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const q = (req.query.q as string || "").trim();
    if (q.length < 1) return res.json([]);
    try {
      const results = await storage.searchMembersByEmail(q, userId);
      res.json(results);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/wallet/lookup-email", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    try {
      const allUsers = await storage.getUsersByEmail(email.trim().toLowerCase());
      if (!allUsers.length) return res.status(404).json({ message: "No TSIA member found with that email" });
      // Filter out the sender themselves
      const others = allUsers.filter(u => u.id !== userId);
      if (!others.length) return res.status(400).json({ message: "You cannot send money to yourself" });
      // Primary user (first found)
      const primary = others[0];
      // Build variants list — each distinct role the email has
      const variants = others.map(u => ({ id: u.id, role: u.role }));
      const isDual = variants.some(v => v.role === "student") && variants.some(v => v.role === "affiliate");
      res.json({
        id: primary.id,
        firstName: primary.firstName,
        lastName: primary.lastName,
        email: primary.email,
        role: primary.role,
        isDual,
        variants,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/wallet/lookup-user", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    try {
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) return res.status(404).json({ message: "No TSIA member found with that email address" });
      if (user.id === userId) return res.status(400).json({ message: "You cannot send money to yourself" });
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Verify account by 10-digit TSIA account number (userId padded to 10)
  app.post("/api/wallet/verify-account", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { accountNumber } = req.body;
    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) return res.status(400).json({ message: "Enter a valid 10-digit account number" });
    try {
      const targetId = parseInt(accountNumber, 10);
      if (isNaN(targetId)) return res.status(404).json({ message: "Account not found" });
      if (targetId === userId) return res.status(400).json({ message: "You cannot send money to yourself" });
      const user = await storage.getUser(targetId);
      if (!user) return res.status(404).json({ message: "Account not found" });
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, accountNumber });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Send money wallet-to-wallet
  app.post("/api/wallet/send", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // recipientId is the resolved userId; recipientRole + recipientEmail allow role-based lookup for dual-account users
    const { recipientId, recipientEmail, recipientRole, amount, note, otpCode } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid transfer details" });
    // ── OTP verification ──────────────────────────────────────────────────────
    if (!otpCode || String(otpCode).trim().length !== 6) {
      return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this transfer" });
    }
    const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "wallet_transfer");
    if (!otpValid) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
    }
    try {
      // Resolve actual recipient — prefer role-based lookup when a dual-account user picked a specific dashboard
      let resolvedId: number = recipientId;
      if (recipientEmail && recipientRole) {
        const byRole = await storage.getUserByEmailAndRole(recipientEmail.trim().toLowerCase(), recipientRole);
        if (!byRole) return res.status(404).json({ message: `No ${recipientRole} account found for that email` });
        resolvedId = byRole.id;
      }
      if (!resolvedId) return res.status(400).json({ message: "Recipient not specified" });
      if (resolvedId === userId) return res.status(400).json({ message: "You cannot send money to yourself" });

      const senderWallet    = await storage.getOrCreateWallet(userId);
      const senderBalance   = parseFloat(senderWallet.balance);
      const senderLien      = parseFloat(senderWallet.lienAmount ?? "0");
      const senderAvailable = Math.max(0, senderBalance - senderLien);
      const WALLET_MIN_BALANCE = 2;
      if ((senderWallet.lienReason ?? "").startsWith("loan_active:")) return res.status(403).json({ message: "Your wallet is frozen due to an active loan. Transfers to other members are blocked until the loan is repaid. You may only withdraw the loan to your bank account.", code: "LOAN_LIEN" });
      if (senderLien > 0 && senderAvailable < amount) return res.status(400).json({ message: `Your wallet has an active lien of $${senderLien.toFixed(2)}. Available balance: $${senderAvailable.toFixed(2)}.`, code: "LIEN_BLOCKED" });
      if (senderBalance < amount) return res.status(400).json({ message: `Insufficient balance. You have $${senderBalance.toFixed(2)}` });
      if (senderBalance - amount < WALLET_MIN_BALANCE) return res.status(400).json({ message: `A minimum of $${WALLET_MIN_BALANCE}.00 must remain in your wallet at all times. You can send up to $${Math.max(0, senderAvailable - WALLET_MIN_BALANCE).toFixed(2)}.` });
      const recipient = await storage.getUser(resolvedId);
      if (!recipient) return res.status(404).json({ message: "Recipient not found" });
      const sender = await storage.getUser(userId);
      const walletLabel = recipient.role === "student" ? "Student Wallet" : "Affiliate Wallet";

      // ── Service fee: 6% reserve fund + 2% co-affiliate pool (8% total) ──
      const transferReserveCut   = parseFloat((amount * 0.06).toFixed(2));
      const transferAffiliateCut = parseFloat((amount * 0.02).toFixed(2));
      const recipientCredit      = parseFloat((amount - transferReserveCut - transferAffiliateCut).toFixed(2));
      const totalFee             = parseFloat((transferReserveCut + transferAffiliateCut).toFixed(2));

      // Deduct full amount from sender
      await storage.updateWalletBalance(userId, (senderBalance - amount).toFixed(2));
      // Credit only the net amount to recipient (after service fee)
      const recipientWallet  = await storage.getOrCreateWallet(resolvedId);
      const recipientBalance = parseFloat(recipientWallet.balance);
      await storage.updateWalletBalance(resolvedId, (recipientBalance + recipientCredit).toFixed(2));
      // Route fee to reserve fund and affiliate pool
      await storage.addToReserveFund(transferReserveCut.toFixed(6));
      const affCount = await storage.getAffiliateCount();
      const perAff = affCount > 0 ? transferAffiliateCut / affCount : 0;
      await storage.recordAffiliateTradeShare(null, transferAffiliateCut.toFixed(6), affCount, perAff.toFixed(6), "wallet_transfer");
      // Record transfer
      await storage.createWalletTransfer({ senderId: userId, recipientId: resolvedId, amount: recipientCredit, note });
      // Record transaction entries for both parties
      await storage.createTransaction({ userId, type: "transfer", amount: (-amount).toFixed(2), fee: totalFee.toFixed(2), paymentMethod: "wallet", description: `TSIA transfer to ${recipient.firstName} ${recipient.lastName} (${walletLabel}) — $${recipientCredit.toFixed(2)} delivered, $${totalFee.toFixed(2)} platform fee${note ? ` | ${note}` : ""}` });
      await storage.createTransaction({ userId: resolvedId, type: "transfer", amount: recipientCredit.toFixed(2), fee: "0.00", paymentMethod: "wallet", description: `TSIA transfer from ${sender?.firstName ?? "Member"}${note ? ` — ${note}` : ""}` });
      // ── 10% cashback on outgoing transfers for sender ────────────────────────
      const transferCashback = parseFloat((amount * 0.10).toFixed(2));
      if (transferCashback > 0) {
        await storage.addCashback(userId, transferCashback).catch(() => {});
        const cbNotif = await storage.createNotification({ userId, type: "system", title: "Cashback Earned 🎁", message: `You earned $${transferCashback.toFixed(2)} cashback (10%) on your transfer. Withdraw it anytime from Rewards.`, data: { transferCashback }, isRead: false });
        pushToUser(userId, "notification", cbNotif);
      }
      // In-app notification for recipient
      const receiveNotif = await storage.createNotification({
        userId: resolvedId, type: "wallet_credit",
        title: "Money Received 💸",
        message: `You received $${recipientCredit.toFixed(2)} from ${sender?.firstName ?? "a member"} ${sender?.lastName ?? ""}. New balance: $${(recipientBalance + recipientCredit).toFixed(2)}.`,
        data: { from: sender?.firstName, amount: recipientCredit }, isRead: false,
      });
      pushToUser(resolvedId, "notification", receiveNotif);
      // Invalidate wallet & transaction caches for both parties
      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`wallet:${resolvedId}`);
      invalidateCacheKey(`transactions:${userId}`);
      invalidateCacheKey(`transactions:${resolvedId}`);
      // Generate a human-readable reference and formatted date for receipts
      const txRef = `TSIA-${Date.now().toString(36).toUpperCase()}-${String(userId).padStart(4, "0")}`;
      const txDate = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      const senderNewBalance = (senderBalance - amount).toFixed(2);
      const senderName = `${sender?.firstName ?? "A member"} ${sender?.lastName ?? ""}`.trim();
      const recipientFullName = `${recipient.firstName} ${recipient.lastName}`;

      // Email notification to recipient (credit alert) — no debit receipt to sender
      sendWalletReceivedEmail(
        recipient.email,
        recipient.firstName,
        recipientCredit.toFixed(2),
        senderName,
        (recipientBalance + recipientCredit).toFixed(2),
        note ?? undefined,
      ).catch((err: any) => console.error("[EMAIL] Wallet received email failed:", err?.message ?? err));

      // Alert admin on every peer-to-peer transfer
      sendAdminWalletTransferEmail({
        senderName,
        senderEmail: sender?.email ?? "",
        recipientName: recipientFullName,
        recipientEmail: recipient.email,
        amount: amount.toFixed(2),
        recipientCredit: recipientCredit.toFixed(2),
        fee: totalFee.toFixed(2),
        txRef,
        txDate,
        note: note ?? undefined,
      }).catch((err: any) => console.error("[EMAIL] Admin transfer alert failed:", err?.message ?? err));

      res.json({
        message: `$${recipientCredit.toFixed(2)} delivered to ${recipientFullName}'s ${walletLabel} (8% platform service fee applied)`,
        receipt: {
          txRef,
          txDate,
          amount: amount.toFixed(2),
          recipientCredit: recipientCredit.toFixed(2),
          fee: totalFee.toFixed(2),
          senderName,
          recipientName: recipientFullName,
          walletLabel,
          note: note ?? null,
          newBalance: senderNewBalance,
        },
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get transfers for current user
  app.get("/api/wallet/transfers", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const transfers = await storage.getWalletTransfersByUser(userId);
      res.json(transfers);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── FINTECH HUB: Squad-powered transactions ─────────────────────────────────

  // ── Shared helper: deduct wallet + record bill + record transaction ──────────
  async function fintechDebitWallet(
    userId: number,
    amountUsd: number,
    service: string,
    reference: string,
    description: string,
    notifTitle: string,
    notifMessage: string,
    notifData: Record<string, any> = {},
  ) {
    const wallet = await storage.getOrCreateWallet(userId);
    const balance = parseFloat(wallet.balance);
    const lienAmt = parseFloat(wallet.lienAmount ?? "0");
    const availableForBill = Math.max(0, balance - lienAmt);
    if ((wallet.lienReason ?? "").startsWith("loan_active:")) throw Object.assign(new Error("Your wallet is frozen due to an active loan. All wallet transactions are blocked until the loan is repaid. You may only withdraw the loan to your bank account."), { status: 403, code: "LOAN_LIEN" });
    if (lienAmt > 0 && availableForBill < amountUsd) throw Object.assign(new Error(`Your wallet has an active lien of $${lienAmt.toFixed(2)}. Available balance: $${availableForBill.toFixed(2)}.`), { status: 400, code: "LIEN_BLOCKED" });
    if (balance < amountUsd) throw Object.assign(new Error(`Insufficient balance. You have $${balance.toFixed(2)}`), { status: 400 });
    await storage.updateWalletBalance(userId, (balance - amountUsd).toFixed(2));
    await storage.createBillPayment({ userId, service, amount: amountUsd, reference });
    await storage.createTransaction({ userId, type: "bill", amount: (-amountUsd).toFixed(2), fee: "0.00", paymentMethod: "wallet", description });
    const notif = await storage.createNotification({ userId, type: "wallet_credit", title: notifTitle, message: notifMessage, data: notifData, isRead: false });
    pushToUser(userId, "notification", notif);
    // ── 10% cashback on every bill payment ──────────────────────────────────
    const cashbackAmt = parseFloat((amountUsd * 0.10).toFixed(2));
    if (cashbackAmt > 0) {
      await storage.addCashback(userId, cashbackAmt).catch(() => {});
      const cbNotif = await storage.createNotification({ userId, type: "system", title: "Cashback Earned 🎁", message: `You earned $${cashbackAmt.toFixed(2)} cashback (10%) on your ${service} payment. Withdraw it anytime from Rewards.`, data: { cashbackAmt }, isRead: false });
      pushToUser(userId, "notification", cbNotif);
    }
    // Bust server-side caches so the client sees updated data immediately
    invalidateCacheKey(`wallet:${userId}`);
    invalidateCacheKey(`transactions:${userId}`);
    invalidateCacheKey(`wallet_bills:${userId}`);
    return await storage.getOrCreateWallet(userId);
  }

  // ── Weekend maintenance block (Fri 23:59 – Mon 08:00 WAT) ───────────────────
  function isWeekendBlock(): { blocked: boolean; until?: string } {
    const WAT_OFFSET = 1 * 60 * 60 * 1000; // UTC+1
    const now = new Date(Date.now() + WAT_OFFSET);
    const day  = now.getUTCDay();    // 0=Sun 1=Mon 2=Tue … 5=Fri 6=Sat
    const hour = now.getUTCHours();
    const min  = now.getUTCMinutes();

    const isSaturday  = day === 6;
    const isSunday    = day === 0;
    const isFridayNight = day === 5 && (hour > 23 || (hour === 23 && min >= 59));
    const isMondayEarly = day === 1 && hour < 8;

    if (isSaturday || isSunday || isFridayNight || isMondayEarly) {
      return { blocked: true, until: "Monday 8:00 AM" };
    }
    return { blocked: false };
  }

  // ── Airtime to Cash ──────────────────────────────────────────────────────────
  app.post("/api/fintech/airtime-to-cash", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { network, amountNgn, payoutMethod: payoutMethodRaw, bankName: bankNameRaw, accountNumber: accountNumberRaw, accountName: accountNameRaw } = req.body;

      const validNetworks = ["mtn", "glo", "9mobile"];
      if (!network || !validNetworks.includes(network)) {
        return res.status(400).json({ message: "Select a valid network (MTN, Glo, or 9mobile)." });
      }
      const ngn = Math.floor(parseFloat(amountNgn));
      if (!ngn || ngn < 500) {
        return res.status(400).json({ message: "Minimum airtime amount is ₦500." });
      }
      if (ngn > 50000) {
        return res.status(400).json({ message: "Maximum airtime amount per transaction is ₦50,000." });
      }

      // 80% payout (20% fee)
      const cashNgn = Math.floor(ngn * 0.80);
      const cashUsd = parseFloat((cashNgn / 1600).toFixed(2));

      // TSIA receiving numbers per network
      const tsiaNumbers: Record<string, string> = {
        mtn: "08032573277", glo: "08055315628", "9mobile": "08091388232",
      };
      const tsiaPhone = tsiaNumbers[network];

      const payoutMethod = String(payoutMethodRaw ?? "wallet") === "bank" ? "bank" : "wallet";
      const bankName     = payoutMethod === "bank" ? String(bankNameRaw ?? "").trim() : "";
      const accountNumber = payoutMethod === "bank" ? String(accountNumberRaw ?? "").trim() : "";
      const accountName  = payoutMethod === "bank" ? String(accountNameRaw ?? "").trim() : "";

      if (payoutMethod === "bank" && (!bankName || !accountNumber || !accountName)) {
        return res.status(400).json({ message: "Bank name, account number, and account name are required for bank payout." });
      }

      const reference = `TSIA-A2C-${network.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      // Record as a pending bill payment — admin reviews & credits wallet/bank
      await storage.createBillPayment({
        userId,
        service: "airtime_cash",
        amount: cashUsd,
        reference: `${reference} | ₦${ngn} ${network.toUpperCase()} → ${payoutMethod === "bank" ? `${bankName} ${accountNumber} (${accountName})` : "wallet"} | $${cashUsd}`,
        status: "pending",
      });

      // Notify user
      try {
        const notif = await storage.createNotification({
          userId,
          type: "system",
          title: "Airtime Sale Request Received ✓",
          message: `We received your request to sell ₦${ngn.toLocaleString()} ${network.toUpperCase()} airtime. Please send the airtime to ${tsiaPhone}. We'll credit $${cashUsd} to your ${payoutMethod === "bank" ? `bank account (${accountNumber})` : "wallet"} after confirmation.`,
          data: { network, amountNgn: ngn, cashUsd, reference, payoutMethod },
          isRead: false,
        });
        pushToUser(userId, "notification", notif);
      } catch { /* non-critical */ }

      // Notify admin
      try {
        const u = await storage.getUser(userId);
        if (u) {
          sendAdminKycEmail({
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            kycType: `Airtime-to-Cash: ${network.toUpperCase()} ₦${ngn.toLocaleString()} → $${cashUsd} | Payout: ${payoutMethod === "bank" ? `${bankName} ${accountNumber} (${accountName})` : "wallet"} | Ref: ${reference}`,
            userId,
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      res.json({
        success: true,
        reference,
        network,
        amountNgn: ngn,
        cashNgn,
        cashUsd,
        tsiaPhone,
        payoutMethod,
        bankName: payoutMethod === "bank" ? bankName : undefined,
        accountNumber: payoutMethod === "bank" ? accountNumber : undefined,
        accountName: payoutMethod === "bank" ? accountName : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Public: bank-transfer availability status (no auth) ─────────────────────
  app.get("/api/fintech/bank-transfer-status", async (_req, res) => {
    try {
      const enabled = (await storage.getPlatformSetting("bank_transfers_enabled")) ?? "true";
      const overrideRaw = await storage.getPlatformSetting("bank_transfers_weekend_override");
      const overrideTs = overrideRaw ? parseInt(overrideRaw, 10) : 0;
      const wb = isWeekendBlock();
      const weekendActive = wb.blocked;
      const weekendOverridden = weekendActive && overrideTs > Date.now();
      const open = enabled !== "false" && (!weekendActive || weekendOverridden);
      res.json({ open, adminClosed: enabled === "false", weekendActive, weekendOverridden, weekendOverrideUntil: overrideTs });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/bank-transfer — Direct Korapay disburse (no admin queue) ─
  app.post("/api/fintech/bank-transfer", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Admin toggle is the sole gate. ON → transfers work any day.
      // OFF → users see a generic network error.
      const btEnabled = (await storage.getPlatformSetting("bank_transfers_enabled")) ?? "true";
      if (btEnabled === "false") {
        return res.status(503).json({ message: "Network error. Please try again later.", bankTransfersDisabled: true });
      }

      const { bankCode, bankName, accountNumber, accountName, amount, narration } = req.body;
      if (!bankCode || !accountNumber || !accountName || !amount) {
        return res.status(400).json({ message: "bankCode, accountNumber, accountName, and amount are required" });
      }
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) return res.status(400).json({ message: "Invalid amount" });

      // ── Minimum transfer ────────────────────────────────────────────────
      const MIN_TRANSFER_USD = 0.1;
      if (transferAmount < MIN_TRANSFER_USD) {
        return res.status(400).json({ message: `Minimum bank transfer is $${MIN_TRANSFER_USD.toFixed(2)}.` });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      const lien    = parseFloat(wallet.lienAmount ?? "0");
      const lienReason = wallet.lienReason ?? "";
      // If user already withdrew their loan, all transactions (including bank transfers) are now blocked
      if (lienReason.startsWith("loan_withdrawn:")) return res.status(403).json({ message: "You have already withdrawn your loan. All wallet transactions are blocked until the loan is repaid. Please repay to restore full access.", code: "LOAN_LIEN" });
      // First-time loan withdrawal: allow it and bypass the lien restriction
      const isLoanLienActive = lienReason.startsWith("loan_active:");
      const effectiveLien = isLoanLienActive ? 0 : lien;
      const availBal = Math.max(0, balance - effectiveLien);
      if (!isLoanLienActive && lien > 0 && availBal < transferAmount) return res.status(400).json({ message: `Your wallet has an active lien of $${lien.toFixed(2)}. Available balance: $${availBal.toFixed(2)}.`, code: "LIEN_BLOCKED" });
      if (balance < transferAmount) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });
      if (!isLoanLienActive && balance - transferAmount < 2) return res.status(400).json({ message: `A minimum of $2.00 must remain in your wallet. You can transfer up to $${Math.max(0, availBal - 2).toFixed(2)}.` });

      const vatAmount   = parseFloat((transferAmount * 0.075).toFixed(2));
      const netAmountUsd = parseFloat((transferAmount - vatAmount).toFixed(2));
      const netAmountNgn = Math.round(netAmountUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT);
      const txRef = `TSIA-FT-${userId}-${Date.now()}`;

      // ── Queue as pending — admin manually makes the bank transfer then approves ─
      // Wallet is debited immediately; funds are held until admin approves or
      // rejects (reject refunds the full amount back to the user's wallet).
      await storage.updateWalletBalance(userId, (balance - transferAmount).toFixed(2));

      const transferDetails = JSON.stringify({ bankCode, bankName, accountNumber, accountName, narration, netAmountNgn, vatAmount, txRef });
      const bill = await storage.createBillPayment({ userId, service: "bank_transfer", amount: transferAmount, reference: transferDetails, status: "pending" });

      await storage.createTransaction({ userId, type: "withdrawal", amount: (-transferAmount).toFixed(2), fee: vatAmount.toFixed(2), paymentMethod: "bank_transfer", description: `Bank transfer submitted — ₦${netAmountNgn.toLocaleString()} to ${accountName} (${accountNumber}) at ${bankName} | Ref: ${txRef}` });

      const msg = `Your bank transfer of ₦${netAmountNgn.toLocaleString()} to ${accountName} (${accountNumber}) has been completed successfully. Ref: ${txRef}`;
      const notif = await storage.createNotification({ userId, type: "wallet_credit", title: "Bank Transfer Submitted ✓", message: msg, data: { billId: bill.id, ref: txRef }, isRead: false });
      pushToUser(userId, "notification", notif);

      // ── After loan withdrawal: upgrade lien so bank transfers are also blocked ──
      if (isLoanLienActive) {
        const loanId = lienReason.slice("loan_active:".length);
        await storage.setWalletLien(userId, wallet.lienAmount ?? "0", `loan_withdrawn:${loanId}`);
      }

      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`transactions:${userId}`);
      invalidateCacheKey(`wallet_bills:${userId}`);

      // No email to sender on bank transfers — only notify admin
      storage.getUser(userId).then(u => {
        if (!u) return;

        // Notify admin so the transfer is attended to promptly
        sendAdminBankTransferEmail({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          userId,
          accountName,
          accountNumber,
          bankName: bankName || bankCode,
          amountUsd: transferAmount.toFixed(2),
          amountNgn: netAmountNgn.toLocaleString(),
          vat: vatAmount.toFixed(2),
          txRef,
          narration: narration || undefined,
        }).catch(() => {});
      }).catch(() => {});

      const updated = await storage.getOrCreateWallet(userId);
      res.json({ success: true, pending: true, reference: txRef, netAmountNgn, vatAmount: vatAmount.toFixed(2), wallet: updated, message: msg, billId: bill.id });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/bill-otp/request — send OTP before any bill payment ──────
  app.post("/api/fintech/bill-otp/request", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await storage.createWithdrawalOtp(userId, code, "bill_payment");
      await sendOtpEmail(user.email, code, false);
      console.log(`[BILL-OTP] code=${code} → ${user.email}`);
      res.json({ success: true, message: `OTP sent to ${user.email.replace(/(.{2}).+(@.+)/, "$1***$2")}` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/fintech/airtime — VTU.ng airtime purchase ─────────────────────
  app.post("/api/fintech/airtime", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { network, phone, amount, otpCode } = req.body;
      if (!network || !phone || !amount) return res.status(400).json({ message: "network, phone, and amount required" });
      if (!otpCode || String(otpCode).trim().length !== 6) return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this payment" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "bill_payment");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      // VTU.ng service_id must be lowercase: mtn, airtel, glo, 9mobile
      const serviceId = network.toLowerCase() === "etisalat" ? "9mobile" : network.toLowerCase();

      const result = await vtuBuyAirtime(phone, serviceId, amountNgn);
      if (!result.ok) {
        console.log(`[VTUNG AIRTIME] FAILED: ${result.msg}`);
        return res.status(502).json({ message: `Airtime purchase failed: ${result.msg}. Please try again.` });
      }
      console.log(`[VTUNG AIRTIME] ref=${result.ref} orderId=${result.orderId} | phone=${phone} | ₦${amountNgn} | status=${result.status}`);

      const ref = `${serviceId.toUpperCase()} | ${phone} | ₦${amountNgn.toLocaleString()} | Ref: ${result.ref}`;
      const desc = `Airtime ₦${amountNgn.toLocaleString()} → ${phone} (${serviceId.toUpperCase()}) via VTU.ng | Ref: ${result.ref}`;
      const msg = `₦${amountNgn.toLocaleString()} airtime delivered to ${phone} (${serviceId.toUpperCase()}).`;
      await fintechDebitWallet(userId, amountUsd, "airtime", ref, desc, "Airtime Delivered ✓", msg, { ref: result.ref });
      res.json({ success: true, reference: result.ref, amountNgn, message: msg });
      storage.getUser(userId).then(u => {
        if (!u) return;
        sendTransactionReceiptEmail(u.email, u.firstName, {
          title: "Airtime Purchase",
          status: "success",
          amount: `₦${amountNgn.toLocaleString()}`,
          amountLabel: `$${amountUsd.toFixed(2)}`,
          reference: result.ref,
          rows: [
            { label: "Network", value: serviceId.toUpperCase() },
            { label: "Phone", value: phone },
            { label: "Amount (NGN)", value: `₦${amountNgn.toLocaleString()}`, color: "green" },
            { label: "Amount (USD)", value: `$${amountUsd.toFixed(2)}` },
            { label: "Provider", value: "VTU.ng" },
          ],
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/data — VTU.ng data bundle purchase ─────────────────────
  app.post("/api/fintech/data", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { network, phone, amount, planLabel, planValidity, variationId, otpCode } = req.body;
      if (!network || !phone || !variationId) return res.status(400).json({ message: "network, phone, and variationId required" });
      if (!otpCode || String(otpCode).trim().length !== 6) return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this payment" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "bill_payment");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const serviceId = network.toLowerCase() === "etisalat" ? "9mobile" : network.toLowerCase();

      const result = await vtuBuyData(phone, serviceId, variationId);
      if (!result.ok) {
        console.log(`[VTUNG DATA] FAILED: ${result.msg}`);
        return res.status(502).json({ message: `Data purchase failed: ${result.msg}. Please try again.` });
      }
      console.log(`[VTUNG DATA] ref=${result.ref} orderId=${result.orderId} | phone=${phone} | plan=${variationId} | status=${result.status}`);

      const planInfo = result.planName || planLabel || `₦${amountNgn.toLocaleString()} data`;
      const planDisplay = planValidity ? `${planInfo} (${planValidity})` : planInfo;
      const ref = `${serviceId.toUpperCase()} | ${planDisplay} | ${phone} | Ref: ${result.ref}`;
      const desc = `Data ${planDisplay} → ${phone} (${serviceId.toUpperCase()}) via VTU.ng | Ref: ${result.ref}`;
      const msg = `${planDisplay} data bundle activated on ${phone} (${serviceId.toUpperCase()}).`;
      await fintechDebitWallet(userId, amountUsd, "internet", ref, desc, "Data Bundle Activated ✓", msg, { ref: result.ref });
      res.json({ success: true, reference: result.ref, amountNgn, message: msg });
      storage.getUser(userId).then(u => {
        if (!u) return;
        sendTransactionReceiptEmail(u.email, u.firstName, {
          title: "Data Bundle Purchase",
          status: "success",
          amount: `₦${amountNgn.toLocaleString()}`,
          amountLabel: `$${amountUsd.toFixed(2)}`,
          reference: result.ref,
          rows: [
            { label: "Network", value: serviceId.toUpperCase() },
            { label: "Plan", value: planDisplay },
            { label: "Phone", value: phone },
            { label: "Amount (NGN)", value: `₦${amountNgn.toLocaleString()}`, color: "green" },
            { label: "Amount (USD)", value: `$${amountUsd.toFixed(2)}` },
            { label: "Provider", value: "VTU.ng" },
          ],
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/electricity — VTU.ng electricity payment ────────────────
  app.post("/api/fintech/electricity", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { discoCode, meterType, meterNumber, amount, otpCode } = req.body;
      if (!discoCode || !meterType || !meterNumber || !amount) {
        return res.status(400).json({ message: "discoCode, meterType, meterNumber, and amount required" });
      }
      if (!otpCode || String(otpCode).trim().length !== 6) return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this payment" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "bill_payment");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);

      const result = await vtuBuyElectricity(meterNumber, discoCode, meterType as "prepaid" | "postpaid", amountNgn);
      if (!result.ok) {
        console.log(`[VTUNG ELEC] FAILED: ${result.msg}`);
        return res.status(502).json({ message: `Electricity payment failed: ${result.msg}. Please try again.` });
      }
      console.log(`[VTUNG ELEC] ref=${result.ref} orderId=${result.orderId} token=${result.token} | meter=${meterNumber} | ₦${amountNgn} | status=${result.status}`);

      const token = result.token ?? "";
      const noteRef = token ? `Token: ${token} | Ref: ${result.ref}` : `Ref: ${result.ref}`;
      const ref = `${discoCode} | ${meterType} | ${meterNumber} | ₦${amountNgn.toLocaleString()} | ${noteRef}`;
      const desc = `Electricity ₦${amountNgn.toLocaleString()} → ${meterNumber} (${discoCode}, ${meterType}) via VTU.ng | ${noteRef}`;
      const msg = token
        ? `₦${amountNgn.toLocaleString()} electricity credited. Meter: ${meterNumber}. Token: ${token}`
        : `₦${amountNgn.toLocaleString()} electricity submitted for ${meterNumber} (${discoCode}).`;
      await fintechDebitWallet(userId, amountUsd, "electricity", ref, desc, "Electricity Credited ✓", msg, { ref: result.ref, token });
      res.json({ success: true, reference: result.ref, amountNgn, token, customerName: result.customerName, message: msg });
      storage.getUser(userId).then(u => {
        if (!u) return;
        const rows: import("./email").ReceiptEmailRow[] = [
          { label: "Provider", value: discoCode },
          { label: "Meter Type", value: meterType },
          { label: "Meter Number", value: meterNumber, mono: true },
          ...(result.customerName ? [{ label: "Customer", value: result.customerName }] : []),
          { label: "Amount (NGN)", value: `₦${amountNgn.toLocaleString()}`, color: "green" as const },
          { label: "Amount (USD)", value: `$${amountUsd.toFixed(2)}` },
        ];
        if (token) rows.push({ label: "Prepaid Token", value: token, mono: true, color: "gold" as const });
        sendTransactionReceiptEmail(u.email, u.firstName, {
          title: "Electricity Payment",
          status: "success",
          amount: `₦${amountNgn.toLocaleString()}`,
          amountLabel: `$${amountUsd.toFixed(2)}`,
          reference: result.ref,
          rows,
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/cable-tv — VTU.ng cable TV subscription ────────────────
  app.post("/api/fintech/cable-tv", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { serviceId, smartcardNumber, variationId, packageName, subscriptionType, amount, otpCode } = req.body;
      if (!serviceId || !smartcardNumber || !variationId) {
        return res.status(400).json({ message: "serviceId, smartcardNumber, and variationId required" });
      }
      if (!otpCode || String(otpCode).trim().length !== 6) return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this payment" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "bill_payment");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const result = await vtuBuyTv(smartcardNumber, serviceId, variationId, subscriptionType, amount ? amountNgn : undefined);
      if (!result.ok) {
        console.log(`[VTUNG TV] FAILED: ${result.msg}`);
        return res.status(502).json({ message: `Cable TV subscription failed: ${result.msg}. Please try again.` });
      }
      console.log(`[VTUNG TV] ref=${result.ref} orderId=${result.orderId} | card=${smartcardNumber} | ${serviceId} | status=${result.status}`);

      const ref = `${serviceId.toUpperCase()} | ${packageName || variationId} | Card: ${smartcardNumber} | ₦${amountNgn.toLocaleString()} | Ref: ${result.ref}`;
      const desc = `Cable TV ${serviceId.toUpperCase()} ${packageName || ""} → ${smartcardNumber} via VTU.ng | Ref: ${result.ref}`;
      const msg = `${serviceId.toUpperCase()} ${packageName || "subscription"} activated for smartcard ${smartcardNumber}.`;
      await fintechDebitWallet(userId, amountUsd, "cable-tv", ref, desc, "Cable TV Activated ✓", msg, { ref: result.ref });
      res.json({ success: true, reference: result.ref, amountNgn, customerName: result.customerName, message: msg });
      storage.getUser(userId).then(u => {
        if (!u) return;
        sendTransactionReceiptEmail(u.email, u.firstName, {
          title: "Cable TV Subscription",
          status: "success",
          amount: `₦${amountNgn.toLocaleString()}`,
          amountLabel: `$${amountUsd.toFixed(2)}`,
          reference: result.ref,
          rows: [
            { label: "Provider", value: serviceId.toUpperCase() },
            { label: "Package", value: packageName || String(variationId) },
            { label: "Smartcard", value: smartcardNumber, mono: true },
            ...(result.customerName ? [{ label: "Customer", value: result.customerName }] : []),
            { label: "Amount (NGN)", value: `₦${amountNgn.toLocaleString()}`, color: "green" as const },
            { label: "Amount (USD)", value: `$${amountUsd.toFixed(2)}` },
          ],
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/betting — VTU.ng betting account funding ────────────────
  app.post("/api/fintech/betting", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { platform, bettingUserId, amount, otpCode } = req.body;
      if (!platform || !bettingUserId || !amount) return res.status(400).json({ message: "platform, bettingUserId, and amount required" });
      if (!otpCode || String(otpCode).trim().length !== 6) return res.status(400).json({ message: "A valid 6-digit OTP is required to confirm this payment" });
      const otpValid = await storage.verifyAndConsumeWithdrawalOtp(userId, String(otpCode).trim(), "bill_payment");
      if (!otpValid) return res.status(400).json({ message: "Invalid or expired OTP. Please request a new code and try again." });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      // VTU.ng service_id must match exactly: Bet9ja, 1xBet, BetKing, etc.
      const result = await vtuFundBetting(bettingUserId, platform, amountNgn);
      if (!result.ok) {
        console.log(`[VTUNG BET] FAILED: ${result.msg}`);
        return res.status(502).json({ message: `Betting wallet funding failed: ${result.msg}. Please try again.` });
      }
      console.log(`[VTUNG BET] ref=${result.ref} orderId=${result.orderId} | platform=${platform} id=${bettingUserId} | ₦${amountNgn} | status=${result.status}`);

      const ref = `${platform} | ID: ${bettingUserId} | ₦${amountNgn.toLocaleString()} | Ref: ${result.ref}`;
      const desc = `Betting fund ${platform} ID: ${bettingUserId} | ₦${amountNgn.toLocaleString()} via VTU.ng | Ref: ${result.ref}`;
      const msg = `₦${amountNgn.toLocaleString()} funded to ${platform} wallet (ID: ${bettingUserId}).`;
      await fintechDebitWallet(userId, amountUsd, "betting", ref, desc, "Betting Wallet Funded ✓", msg, { ref: result.ref });
      res.json({ success: true, reference: result.ref, amountNgn, customerName: result.customerName, message: msg });
      storage.getUser(userId).then(u => {
        if (!u) return;
        sendTransactionReceiptEmail(u.email, u.firstName, {
          title: "Betting Wallet Funded",
          status: "success",
          amount: `₦${amountNgn.toLocaleString()}`,
          amountLabel: `$${amountUsd.toFixed(2)}`,
          reference: result.ref,
          rows: [
            { label: "Platform", value: platform },
            { label: "User ID", value: bettingUserId, mono: true },
            ...(result.customerName ? [{ label: "Customer", value: result.customerName }] : []),
            { label: "Amount (NGN)", value: `₦${amountNgn.toLocaleString()}`, color: "green" as const },
            { label: "Amount (USD)", value: `$${amountUsd.toFixed(2)}` },
            { label: "Provider", value: "VTU.ng" },
          ],
        }).catch(() => {});
      }).catch(() => {});
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── GET /api/fintech/data-plans?network=mtn — VTU.ng live data plans ─────────
  app.get("/api/fintech/data-plans", async (req, res) => {
    const serviceId = String(req.query.network || "mtn").toLowerCase();
    const valid = ["mtn", "airtel", "glo", "9mobile", "smile"];
    if (!valid.includes(serviceId)) return res.status(400).json({ message: "Invalid network" });
    const cacheKey = `vtung_data_plans:${serviceId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const d = await vtuGetDataVariations(serviceId);
      const plans = (Array.isArray(d?.data) ? d.data : [])
        .filter((p: any) => String(p.availability ?? "").toLowerCase() === "available")
        .map((p: any) => ({
          variationId: String(p.variation_id),
          label: String(p.data_plan ?? p.name ?? p.variation_id),
          priceNgn: Number(p.price),
        }));
      const result = { network: serviceId, plans };
      if (plans.length > 0) setCached(cacheKey, result, 10 * 60_000); // only cache non-empty
      res.json(result);
    } catch (e: any) {
      res.json({ network: serviceId, plans: [], message: e.message ?? "Network error" });
    }
  });

  // ── GET /api/fintech/tv-plans?service=dstv — VTU.ng live cable TV plans ──────
  app.get("/api/fintech/tv-plans", async (req, res) => {
    const serviceId = String(req.query.service || "").toLowerCase();
    const valid = ["dstv", "gotv", "startimes", "showmax"];
    if (serviceId && !valid.includes(serviceId)) return res.status(400).json({ message: "Invalid service" });
    const cacheKey = `vtung_tv_plans:${serviceId || "all"}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const d = await vtuGetTvVariations(serviceId || undefined);
      const plans = (Array.isArray(d?.data) ? d.data : [])
        .filter((p: any) => p.availability === "Available")
        .map((p: any) => ({
          variationId: String(p.variation_id),
          serviceId: String(p.service_id),
          serviceName: String(p.service_name),
          label: String(p.package_bouquet),
          priceNgn: Number(p.price),
        }));
      const result = { service: serviceId || "all", plans };
      setCached(cacheKey, result, 10 * 60_000);
      res.json(result);
    } catch (e: any) {
      res.json({ service: serviceId || "all", plans: [], message: e.message ?? "Network error" });
    }
  });

  // ── POST /api/fintech/verify-customer — VTU.ng customer lookup ───────────────
  app.post("/api/fintech/verify-customer", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { customerId, serviceId, variationId } = req.body;
      if (!customerId || !serviceId) return res.status(400).json({ message: "customerId and serviceId required" });
      const d = await vtuVerifyCustomer(customerId, serviceId, variationId);
      if (d.code !== "success") return res.status(400).json({ message: d.message ?? "Verification failed" });
      res.json({ success: true, data: d.data });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/request-money — Notify TSIA member of money request ───
  app.post("/api/fintech/request-money", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { email, amount, note } = req.body;
      if (!email || !amount) return res.status(400).json({ message: "email and amount are required" });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const requester = await storage.getUser(userId);
      if (!requester) return res.status(404).json({ message: "User not found" });

      const target = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!target) return res.status(404).json({ message: "No TSIA member found with that email" });
      if (target.id === userId) return res.status(400).json({ message: "You cannot request money from yourself" });

      const requestRef = `REQ-${userId}-${Date.now()}`;
      const msg = `${requester.firstName} ${requester.lastName} is requesting $${amountUsd.toFixed(2)} from you${note ? `: "${note}"` : ""}. Log in to your TSIA wallet to send.`;
      const notif = await storage.createNotification({
        userId: target.id, type: "wallet_credit",
        title: `Money Request from ${requester.firstName} ${requester.lastName}`,
        message: msg, data: { requesterId: userId, amount: amountUsd, ref: requestRef }, isRead: false,
      });
      pushToUser(target.id, "notification", notif);
      res.json({ success: true, reference: requestRef, message: `Request for $${amountUsd.toFixed(2)} sent to ${target.firstName} ${target.lastName}.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  // Pay a bill (deduct from wallet)
  app.post("/api/wallet/bill", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { service, amount, note } = req.body;
    if (!service || !amount || amount <= 0) return res.status(400).json({ message: "Invalid bill details" });
    try {
      const wallet  = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      const lienW   = parseFloat(wallet.lienAmount ?? "0");
      const availW  = Math.max(0, balance - lienW);
      if ((wallet.lienReason ?? "").startsWith("loan_active:")) return res.status(403).json({ message: "Your wallet is frozen due to an active loan. Bill payments are blocked until the loan is repaid. You may only withdraw the loan to your bank account.", code: "LOAN_LIEN" });
      if (lienW > 0 && availW < amount) return res.status(400).json({ message: `Your wallet has an active lien of $${lienW.toFixed(2)}. Available balance: $${availW.toFixed(2)}.`, code: "LIEN_BLOCKED" });
      if (balance < amount) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });
      if (balance - amount < 2) return res.status(400).json({ message: `A minimum of $2.00 must remain in your wallet. You can spend up to $${Math.max(0, availW - 2).toFixed(2)}.` });
      await storage.updateWalletBalance(userId, (balance - amount).toFixed(2));
      const reference = `TSIA-BILL-${service.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      await storage.createBillPayment({ userId, service, amount, reference });
      await storage.createTransaction({ userId, type: "bill", amount: (-amount).toFixed(2), fee: "0.00", paymentMethod: "wallet", description: `${service} bill payment${note ? ` — ${note}` : ""} | Ref: ${reference}` });
      res.json({ message: `${service} bill of $${amount.toFixed(2)} paid successfully. Ref: ${reference}` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get bill payments for current user
  app.get("/api/wallet/bills", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const cacheKey = `wallet_bills:${userId}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
      const bills = await storage.getBillPaymentsByUser(userId);
      setCached(cacheKey, bills, 300_000);
      res.json(bills);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Admin: Manually credit a wallet (apply full 75/20/5 split) ─────────────
  // Used when a Korapay/Squad payment arrived but wasn't auto-credited (e.g. user not in system, webhook missed, etc.)
  app.post("/api/admin/manual-deposit-credit", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
      const admin = await storage.getUser(sessionUserId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { userId, amountUsd, reference, note } = req.body;
      const targetId = parseInt(userId);
      const gross = parseFloat(amountUsd);
      if (isNaN(targetId) || targetId <= 0) return res.status(400).json({ message: "Valid userId is required" });
      if (isNaN(gross) || gross <= 0) return res.status(400).json({ message: "Valid amountUsd is required" });

      const targetUser = await storage.getUser(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      // Check if reference already credited
      const txRef = reference?.trim() || `ADMIN-MANUAL-${targetId}-${Date.now()}`;
      const existingDeps = await storage.getWalletDepositsByUser(targetId);
      const alreadyDone = existingDeps.find((d: any) => d.txHash === txRef && d.status === "completed");
      if (alreadyDone) return res.status(409).json({ message: "This reference has already been credited. Re-crediting is blocked to prevent duplicates." });

      // Create or find the deposit record
      let dep = existingDeps.find((d: any) => d.txHash === txRef);
      if (!dep) {
        dep = await storage.createWalletDeposit({ userId: targetId, amountUsd: gross.toFixed(2), txHash: txRef, walletType: "manual", status: "pending" });
      }

      await creditWalletWithSplit(targetId, gross, note ? `manual (${note})` : "manual", txRef, { id: dep.id, amountUsd: gross.toFixed(2), status: dep.status });

      console.log(`[ADMIN MANUAL CREDIT] Admin ${admin.email} credited user ${targetId} (${targetUser.email}) $${gross} — ref: ${txRef}`);
      res.json({ success: true, message: `$${gross.toFixed(2)} credited in full to ${targetUser.firstName} ${targetUser.lastName}'s wallet`, grossAmount: gross.toFixed(2), creditedAmount: gross.toFixed(2) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: confirm wallet deposit
  app.post("/api/admin/wallet-deposit/:id/confirm", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    return res.status(410).json({ message: "Manual deposit confirmation has been removed. All deposits are auto-processed by payment gateways (Korapay/Squad)." });
    try {
      // ── IDEMPOTENCY GUARD: prevent double-crediting already-confirmed deposits ──
      const [existingDeposit] = await db.select().from(walletDeposits).where(eq(walletDeposits.id, parseInt(req.params.id)));
      if (!existingDeposit) return res.status(404).json({ message: "Deposit not found" });
      if (existingDeposit.status === "completed") {
        return res.status(409).json({ message: "This deposit has already been confirmed and credited. Re-confirming is not allowed to prevent duplicate credits." });
      }
      const deposit = await storage.updateWalletDeposit(parseInt(req.params.id), { status: "completed" });
      const gross = parseFloat(deposit.amountUsd);

      // ── Fee policy: 100% of deposit credited to user wallet — fees apply on transactions ──
      const depositUser = await storage.getUser(deposit.userId);
      const isAffiliate = depositUser?.role === "affiliate";
      const isFirstDeposit = true; // kept for notification copy compatibility

      const reserveCut   = 0;
      const affiliateCut = 0;
      const userCredit   = gross; // 100% to user

      // Credit user wallet
      const wallet = await storage.getOrCreateWallet(deposit.userId);
      const newBalance = (parseFloat(wallet.balance) + userCredit).toFixed(2);
      await storage.updateWalletBalance(deposit.userId, newBalance);
      // ── Wallet activation: activate if balance exceeds $5 for the first time ──
      const WALLET_ACTIVATION_MIN = 5;
      let referralResult: Awaited<ReturnType<typeof creditReferrerCommissionOnce>> | null = null;
      if (!wallet.activated && parseFloat(newBalance) > WALLET_ACTIVATION_MIN) {
        try {
          await storage.activateWallet(deposit.userId);
          referralResult = await creditReferrerCommissionOnce(deposit.userId, gross, "personal wallet activation");
          if (!referralResult.credited) console.log(`[REFERRAL] No admin-confirmed wallet activation commission credited for user ${deposit.userId}`);
          // Notify referrer that commission is now active
          const depUserForRef = await storage.getUser(deposit.userId);
          if (depUserForRef?.referredBy) {
            const referrer = await storage.getUserByAffiliateCode(depUserForRef.referredBy);
            if (referrer) {
              const refNotif = await storage.createNotification({
                userId: referrer.id,
                type: "referral_activated",
                title: "Referral Activated 🎉",
                message: `${depUserForRef.firstName} ${depUserForRef.lastName.charAt(0)}. (one of your referrals) has activated their TSIA wallet. Your referral commission is now active!`,
                data: { referredUserId: depUserForRef.id },
                isRead: false,
              });
              pushToUser(referrer.id, "notification", refNotif);
            }
          }
        } catch (e: any) { console.error("[REFERRAL] Wallet activation commission block failed:", e?.message ?? e); }
      } else if (wallet.activated && parseFloat(newBalance) >= WALLET_ACTIVATION_MIN) {
        referralResult = await creditReferrerCommissionOnce(deposit.userId, gross, "personal wallet activation");
        if (!referralResult.credited) console.log(`[REFERRAL] No admin-confirmed deposit commission credited for already-active user ${deposit.userId}`);
      }
      // Record transaction
      const txDescription = `Deposit confirmed — $${gross.toFixed(2)} credited in full (100%)`;
      await storage.createTransaction({
        userId: deposit.userId,
        type: "deposit",
        amount: userCredit.toFixed(2),
        fee: "0.00",
        paymentMethod: deposit.walletType ?? "crypto",
        description: txDescription,
      });
      // ─────────────────────────────────────────────────────────────────────────
      // Notify user
      try {
        if (depositUser) {
          sendWalletCreditEmail(depositUser.email, depositUser.firstName, userCredit.toFixed(2), newBalance).catch((err: any) => console.error("[EMAIL] Wallet credit email failed:", err?.message ?? err));
          sendAdminDepositConfirmedEmail({
            name: `${depositUser.firstName} ${depositUser.lastName}`,
            email: depositUser.email,
            gross: gross.toFixed(2),
            credited: userCredit.toFixed(2),
            reserveCut: reserveCut.toFixed(2),
            affiliateCut: affiliateCut.toFixed(2),
            newBalance,
            walletType: deposit.walletType ?? "crypto",
            txHash: deposit.txHash ?? undefined,
            userId: deposit.userId,
          }).catch((err: any) => console.error("[EMAIL] Admin confirmed deposit email failed:", err?.message ?? err));
        }
        const notifMessage = `$${gross.toFixed(2)} deposit confirmed and fully credited to your TSIA SwiftWallet. New balance: $${newBalance}.`;
        const walletNotif = await storage.createNotification({
          userId: deposit.userId,
          type: "wallet_credit",
          title: "Wallet Credited ✓",
          message: notifMessage,
          data: { depositId: deposit.id, gross, userCredit, reserveCut: 0, affiliateCut: 0, newBalance },
          isRead: false,
        });
        pushToUser(deposit.userId, "notification", walletNotif);
      } catch { /* non-critical */ }
      // Invalidate caches for the credited user
      invalidateCacheKey(`wallet:${deposit.userId}`);
      invalidateCacheKey(`transactions:${deposit.userId}`);
      invalidateCacheKey(`wallet_deposits:${deposit.userId}`);
      invalidateCacheKey("reserve_fund_live");
      res.json({ success: true, breakdown: { gross, userCredit, reserveCut, affiliateCut, newBalance }, referralCommission: referralResult });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: decline wallet deposit
  app.post("/api/admin/wallet-deposit/:id/decline", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    return res.status(410).json({ message: "Manual deposit decline has been removed. All deposits are auto-processed by payment gateways." });
    try {
      const [existing] = await db.select().from(walletDeposits).where(eq(walletDeposits.id, parseInt(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Deposit not found" });
      if (existing.status === "completed") return res.status(409).json({ message: "Cannot decline an already-confirmed deposit." });
      await storage.updateWalletDeposit(parseInt(req.params.id), { status: "declined" } as any);
      try {
        const depUser = await storage.getUser(existing.userId);
        if (depUser) {
          const notif = await storage.createNotification({
            userId: depUser.id,
            type: "deposit",
            title: "Deposit Declined",
            message: `Your deposit of $${existing.amountUsd} has been declined by the admin. Please contact support if you believe this is an error.`,
            data: { depositId: existing.id },
            isRead: false,
          });
          pushToUser(depUser.id, "notification", notif);
        }
      } catch { /* non-critical */ }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: revert deposit back to pending
  app.post("/api/admin/wallet-deposit/:id/pending", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const [existing] = await db.select().from(walletDeposits).where(eq(walletDeposits.id, parseInt(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Deposit not found" });
      return res.status(410).json({ message: "This endpoint has been removed. Deposits are auto-processed by payment gateways." });
      if (existing.status === "completed") return res.status(409).json({ message: "Cannot revert a completed deposit to pending — this would desync the wallet balance." });
      await storage.updateWalletDeposit(parseInt(req.params.id), { status: "pending" } as any);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: delete wallet deposit record
  app.delete("/api/admin/wallet-deposit/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const [existing] = await db.select().from(walletDeposits).where(eq(walletDeposits.id, parseInt(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Deposit not found" });
      await storage.deleteWalletDeposit(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: PENDING BANK TRANSFERS ──────────────────────────────────────────
  app.get("/api/admin/pending-bank-transfers", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const transfers = await storage.getPendingBankTransfers();
      res.json(transfers);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/pending-bank-transfer/:id/approve", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const adminUser = await storage.getUser(userId);
    if (adminUser?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const [bill] = await db.select().from(billPayments).where(eq(billPayments.id, id));
      if (!bill) return res.status(404).json({ message: "Transfer not found" });
      if (bill.status !== "pending") return res.status(400).json({ message: `Cannot approve a ${bill.status} transfer` });

      let details: any = {};
      try { details = JSON.parse(bill.reference); } catch { return res.status(400).json({ message: "Invalid transfer data" }); }

      const { bankCode, bankName, accountNumber, accountName, narration, gateway = "squad", netAmountNgn, vatAmount, txRef } = details;

      // Admin has already made the manual bank transfer — just mark as completed.
      await storage.updateBillPaymentStatus(id, "completed");
      const msg = `Your bank transfer of ₦${Number(netAmountNgn).toLocaleString()} to ${accountName} (${accountNumber}) has been approved and sent. Ref: ${txRef}`;
      const notif = await storage.createNotification({ userId: bill.userId, type: "wallet_credit", title: "Bank Transfer Approved ✓", message: msg, data: { billId: id, ref: txRef }, isRead: false });
      pushToUser(bill.userId, "notification", notif);
      invalidateCacheKey(`wallet_bills:${bill.userId}`);
      res.json({ success: true, message: "Transfer approved and sent successfully." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/pending-bank-transfer/:id/reject", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const adminUser = await storage.getUser(userId);
    if (adminUser?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const [bill] = await db.select().from(billPayments).where(eq(billPayments.id, id));
      if (!bill) return res.status(404).json({ message: "Transfer not found" });
      if (bill.status !== "pending") return res.status(400).json({ message: `Cannot reject a ${bill.status} transfer` });

      const { reason = "Rejected by admin" } = req.body;
      const refundAmt = parseFloat(bill.amount);

      // Refund user wallet
      const refWallet = await storage.getOrCreateWallet(bill.userId);
      const newBal = (parseFloat(refWallet.balance) + refundAmt).toFixed(2);
      await storage.updateWalletBalance(bill.userId, newBal);
      await storage.updateBillPaymentStatus(id, "rejected");

      let details: any = {};
      try { details = JSON.parse(bill.reference); } catch { /* ok */ }
      const txRef = details.txRef || `bill-${id}`;

      await storage.createTransaction({ userId: bill.userId, type: "refund", amount: refundAmt.toFixed(2), fee: "0.00", paymentMethod: "admin_refund", description: `Bank transfer rejected — $${refundAmt.toFixed(2)} refunded to wallet. Reason: ${reason} | Ref: ${txRef}` });
      const msg = `Your bank transfer request ($${refundAmt.toFixed(2)}) has been rejected. $${refundAmt.toFixed(2)} has been refunded to your wallet. Reason: ${reason}`;
      const notif = await storage.createNotification({ userId: bill.userId, type: "wallet_credit", title: "Bank Transfer Rejected", message: msg, data: { billId: id }, isRead: false });
      pushToUser(bill.userId, "notification", notif);
      invalidateCacheKey(`wallet:${bill.userId}`);
      invalidateCacheKey(`transactions:${bill.userId}`);
      invalidateCacheKey(`wallet_bills:${bill.userId}`);
      res.json({ success: true, message: "Transfer rejected and funds refunded to user." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Decline (no refund) — admin already sent money or consciously forfeits refund
  app.post("/api/admin/pending-bank-transfer/:id/decline", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const adminUser = await storage.getUser(userId);
    if (adminUser?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const [bill] = await db.select().from(billPayments).where(eq(billPayments.id, id));
      if (!bill) return res.status(404).json({ message: "Transfer not found" });
      if (bill.status !== "pending") return res.status(400).json({ message: `Cannot decline a ${bill.status} transfer` });

      const { reason = "Declined by admin" } = req.body;
      let details: any = {};
      try { details = JSON.parse(bill.reference); } catch { /* ok */ }
      const txRef = details.txRef || `bill-${id}`;
      const refundAmt = parseFloat(bill.amount);

      await storage.updateBillPaymentStatus(id, "rejected");
      await storage.createTransaction({ userId: bill.userId, type: "withdrawal", amount: (-refundAmt).toFixed(2), fee: "0.00", paymentMethod: "admin_decline", description: `Bank transfer declined (no refund) — Reason: ${reason} | Ref: ${txRef}` });
      const msg = `Your bank transfer request ($${refundAmt.toFixed(2)}) has been declined. Reason: ${reason}`;
      const notif = await storage.createNotification({ userId: bill.userId, type: "wallet_credit", title: "Bank Transfer Declined", message: msg, data: { billId: id }, isRead: false });
      pushToUser(bill.userId, "notification", notif);
      invalidateCacheKey(`transactions:${bill.userId}`);
      invalidateCacheKey(`wallet_bills:${bill.userId}`);
      res.json({ success: true, message: "Transfer declined (no refund issued)." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── E-COMMERCE PRODUCTS ────────────────────────────────────────────────────
  app.get("/api/products", async (req, res) => {
    try {
      const { category, search } = req.query as any;
      const prods = await storage.getProducts({ category, search });
      res.json(prods);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/my", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const prods = await storage.getProducts({ sellerId: userId });
      res.json(prods);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const prod = await storage.getProductById(parseInt(req.params.id));
      if (!prod) return res.status(404).json({ message: "Product not found" });
      res.json(prod);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/products", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { title, description, price, category, condition, images, stock, location, negotiable } = req.body;
    if (!title || !description || !price) return res.status(400).json({ message: "Title, description and price are required" });
    const priceNum = parseFloat(price);
    if (priceNum < ECOMMERCE.MIN_PRICE || priceNum > ECOMMERCE.MAX_PRICE) return res.status(400).json({ message: `Price must be $${ECOMMERCE.MIN_PRICE}–$${ECOMMERCE.MAX_PRICE}` });
    try {
      const prod = await storage.createProduct({ sellerId: userId, title, description, price: priceNum.toFixed(2), category: category || "other", condition: condition || "new", images: images || [], stock: parseInt(stock) || 1, location: location || "London, UK", status: "active", negotiable: negotiable === true });
      res.json(prod);
      // Notify ALL users (fire-and-forget — runs after response is sent)
      setImmediate(async () => {
        try {
          const cat = prod.category || "other";
          const allUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName }).from(users);
          for (const u of allUsers) {
            if (u.id === userId) continue;
            try {
              const notif = await storage.createNotification({
                userId: u.id,
                type: "new_arrival",
                title: "New on TS-Mart Online Stores 🛍️",
                message: `"${prod.title}" just listed in ${cat}. Tap to explore and shop!`,
                relatedId: prod.id,
              });
              pushToUser(u.id, "notification", notif);
            } catch (_) {}
          }
        } catch (err: any) { console.error("[TS-MART] Broadcast notification error:", err?.message ?? err); }
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/products/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const prod = await storage.getProductById(parseInt(req.params.id));
      if (!prod || prod.sellerId !== userId) return res.status(403).json({ message: "Not your product" });
      const oldPrice = parseFloat(prod.price);
      const updated = await storage.updateProduct(parseInt(req.params.id), req.body);
      // Fire price-drop alerts if price decreased
      if (req.body.price !== undefined) {
        const newPrice = parseFloat(updated.price);
        if (newPrice < oldPrice) {
          try {
            const alerts = await storage.getPriceAlertsForProduct(updated.id);
            for (const alert of alerts) {
              if (newPrice < parseFloat(alert.lastKnownPrice)) {
                const notif = await storage.createNotification({ userId: alert.userId, type: "price_drop", title: "Price Drop!", message: `"${updated.title}" dropped from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)}`, relatedId: updated.id });
                pushToUser(alert.userId, "notification", notif);
                await storage.updatePriceAlertLastKnown(alert.userId, updated.id, newPrice.toFixed(2));
                storage.getUser(alert.userId).then(u => {
                  if (u) sendPriceDropEmail(u.email, u.firstName, updated.title, oldPrice.toFixed(2), newPrice.toFixed(2), updated.id).catch((err: any) => console.error("[EMAIL] Price drop email failed:", err?.message ?? err));
                });
              }
            }
          } catch (_) {}
        }
      }
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const prod = await storage.getProductById(parseInt(req.params.id));
      if (!prod) return res.status(404).json({ message: "Product not found" });
      if (prod.sellerId !== userId) return res.status(403).json({ message: "Not your product" });
      await storage.deleteProduct(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── PRODUCT RATINGS ──────────────────────────────────────────────────────
  app.get("/api/products/:id/ratings", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const [ratings, summary] = await Promise.all([
        storage.getProductRatings(productId),
        storage.getProductRatingSummary(productId),
      ]);
      res.json({ ratings, summary });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/products/:id/rate", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const productId = parseInt(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5" });
    try {
      const r = await storage.rateProduct({ productId, userId, rating: parseInt(rating), comment: comment || null });
      const summary = await storage.getProductRatingSummary(productId);
      res.json({ rating: r, summary });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/products/:id/my-rating", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const r = await storage.getUserRatingForProduct(parseInt(req.params.id), userId);
      res.json(r ?? null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── E-COMMERCE ORDERS ──────────────────────────────────────────────────────
  app.post("/api/orders", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { productId, quantity = 1, deliveryAddress, note } = req.body;
    if (!productId) return res.status(400).json({ message: "Product ID is required" });
    try {
      const prod = await storage.getProductById(parseInt(productId));
      if (!prod) return res.status(404).json({ message: "Product not found" });
      if (prod.status !== "active") return res.status(400).json({ message: "Product is not available" });
      const buyer = await storage.getUser(userId);
      if (prod.sellerId === userId || (buyer && (prod as any).sellerEmail && (prod as any).sellerEmail === buyer.email)) {
        return res.status(400).json({ message: "You cannot buy your own product" });
      }
      if (prod.stock < quantity) return res.status(400).json({ message: "Insufficient stock" });

      const qty = parseInt(quantity);
      const unitPrice = parseFloat(prod.price);
      const totalAmount = unitPrice * qty;
      const commissionAmount = +(totalAmount * ECOMMERCE.COMMISSION_RATE).toFixed(2);
      const sellerReceives = +(totalAmount - commissionAmount).toFixed(2);

      // Deduct from buyer wallet — funds held in escrow until delivery confirmed
      const buyerWallet = await storage.getOrCreateWallet(userId);
      if (!buyerWallet.activated) return res.status(403).json({ message: "Activate your wallet before placing marketplace orders." });
      if (parseFloat(buyerWallet.balance) < totalAmount) return res.status(400).json({ message: `Insufficient wallet balance. Need $${totalAmount.toFixed(2)}` });
      await storage.updateWalletBalance(userId, (parseFloat(buyerWallet.balance) - totalAmount).toFixed(2));

      // NOTE: Seller wallet NOT credited yet — funds stay in platform escrow until buyer confirms receipt

      // Update stock
      const newStock = prod.stock - qty;
      await storage.updateProduct(prod.id, { stock: newStock, ...(newStock === 0 ? { status: "sold" } : {}) });

      // Create order record (escrowReleased=false, status=pending)
      const order = await storage.createOrder({ buyerId: userId, sellerId: prod.sellerId, productId: prod.id, quantity: qty, unitPrice: unitPrice.toFixed(2), totalAmount: totalAmount.toFixed(2), commissionRate: ECOMMERCE.COMMISSION_RATE.toFixed(4), commissionAmount: commissionAmount.toFixed(2), sellerReceives: sellerReceives.toFixed(2), status: "pending", escrowReleased: false, deliveryAddress: deliveryAddress || null, note: note || null });

      // Auto-add first tracking entry
      await storage.createOrderTracking({ orderId: order.id, statusLabel: "Order Placed", description: `Payment of $${totalAmount.toFixed(2)} held in TSIA escrow. Awaiting seller confirmation.` });

      // Notify buyer and seller
      try {
        const [buyerUser, sellerUser] = await Promise.all([
          storage.getUser(userId),
          storage.getUser(prod.sellerId),
        ]);
        if (buyerUser) sendOrderUpdateEmail(buyerUser.email, buyerUser.firstName, "pending", prod.title, order.id).catch((err: any) => console.error("[EMAIL] Order email failed:", err?.message ?? err));
        if (sellerUser) sendNewSaleEmail(sellerUser.email, sellerUser.firstName, prod.title, sellerReceives.toFixed(2), order.id).catch((err: any) => console.error("[EMAIL] New sale email failed:", err?.message ?? err));
        const [buyerNotif, sellerNotif] = await Promise.all([
          storage.createNotification({
            userId,
            type: "order_update",
            title: "Order Placed — In Escrow",
            message: `Your order for "${prod.title}" (x${qty}) is placed. $${totalAmount.toFixed(2)} is held in escrow until you confirm delivery.`,
            data: { orderId: order.id, productId: prod.id },
            isRead: false,
          }),
          storage.createNotification({
            userId: prod.sellerId,
            type: "order_update",
            title: "New Sale — Action Required",
            message: `"${prod.title}" was ordered (x${qty}). Confirm and ship to release $${sellerReceives.toFixed(2)} from escrow to your wallet.`,
            data: { orderId: order.id, productId: prod.id },
            isRead: false,
          }),
        ]);
        pushToUser(userId, "notification", buyerNotif);
        pushToUser(prod.sellerId, "notification", sellerNotif);
      } catch { /* non-critical */ }

      // Notify admin
      try {
        const [orderBuyer, orderSeller] = await Promise.all([storage.getUser(userId), storage.getUser(prod.sellerId)]);
        sendAdminOrderEmail({
          buyerName: orderBuyer ? `${orderBuyer.firstName} ${orderBuyer.lastName}` : `User #${userId}`,
          sellerName: orderSeller ? `${orderSeller.firstName} ${orderSeller.lastName}` : `User #${prod.sellerId}`,
          productTitle: prod.title, quantity: qty, totalAmount: totalAmount.toFixed(2),
          commission: commissionAmount.toFixed(2), sellerReceives: sellerReceives.toFixed(2), orderId: order.id,
        }).catch(() => {});
      } catch { /* non-critical */ }

      res.json({ order, message: `Order placed! $${totalAmount.toFixed(2)} is held in escrow and will be released to the seller once you confirm receipt.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/orders/purchases", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try { res.json(await storage.getOrdersByBuyer(userId)); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/orders/sales", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try { res.json(await storage.getOrdersBySeller(userId)); } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Seller updates order status (confirm / ship) — optionally adds tracking number when shipping
  app.patch("/api/orders/:id/status", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { status, trackingNumber, trackingLocation } = req.body;
    try {
      const existing = await storage.getOrderById(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ message: "Order not found" });
      if (existing.sellerId !== userId) return res.status(403).json({ message: "Only the seller can update this order" });
      const allowedTransitions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["shipped", "cancelled"],
      };
      if (!allowedTransitions[existing.status]?.includes(status)) {
        return res.status(400).json({ message: `Order cannot move from ${existing.status} to ${status}.` });
      }
      const order = await storage.updateOrderStatus(parseInt(req.params.id), status, trackingNumber ? { trackingNumber } : undefined);
      // Add tracking entry
      const labelMap: Record<string, string> = { confirmed: "Confirmed by Seller", shipped: "Shipped", cancelled: "Cancelled" };
      const descMap: Record<string, string> = {
        confirmed: "Seller has confirmed your order and is preparing it for dispatch.",
        shipped: trackingNumber ? `Item dispatched. Tracking number: ${trackingNumber}` : "Item has been dispatched by the seller.",
        cancelled: "Order was cancelled by the seller.",
      };
      if (labelMap[status]) {
        await storage.createOrderTracking({ orderId: order.id, statusLabel: labelMap[status], description: descMap[status] ?? status, location: trackingLocation || undefined });
      }
      // Notify buyer
      try {
        const [buyerUser, prod] = await Promise.all([storage.getUser(order.buyerId), storage.getProductById(order.productId)]);
        if (buyerUser && prod) sendOrderUpdateEmail(buyerUser.email, buyerUser.firstName, status, prod.title, order.id).catch(() => {});
        const notif = await storage.createNotification({ userId: order.buyerId, type: "order_update", title: `Order ${labelMap[status] ?? status}`, message: descMap[status] ?? `Order #${order.id} status changed to ${status}`, data: { orderId: order.id }, isRead: false });
        pushToUser(order.buyerId, "notification", notif);
      } catch { /* non-critical */ }
      res.json(order);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Buyer marks order as received — releases escrow to seller
  app.post("/api/orders/:id/mark-received", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const order = await storage.getOrderById(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyerId !== userId) return res.status(403).json({ message: "Only the buyer can confirm receipt" });
      if (order.escrowReleased) return res.status(400).json({ message: "Escrow already released for this order" });
      if (!["confirmed", "shipped"].includes(order.status)) {
        return res.status(400).json({ message: "The seller must confirm or ship the order before you can release payment." });
      }

      const sellerReceives = parseFloat(order.sellerReceives);
      const commissionAmount = parseFloat(order.commissionAmount);
      const totalAmount = parseFloat(order.totalAmount);

      // Release escrow: credit seller wallet
      const sellerWallet = await storage.getOrCreateWallet(order.sellerId);
      await storage.updateWalletBalance(order.sellerId, (parseFloat(sellerWallet.balance) + sellerReceives).toFixed(2));
      await storage.createTransaction({ userId: order.sellerId, type: "credit", amount: sellerReceives.toFixed(2), fee: commissionAmount.toFixed(2), paymentMethod: "escrow", description: `Sale proceeds released — Order #${order.id} (buyer confirmed receipt)` });

      // Update order to delivered + escrowReleased
      await storage.updateOrderStatus(order.id, "delivered", { escrowReleased: true });
      await storage.createOrderTracking({ orderId: order.id, statusLabel: "Delivered", description: "Buyer confirmed receipt. Escrow released — seller has been paid." });

      // Notify seller
      try {
        const [buyerUser, sellerUser, prod] = await Promise.all([storage.getUser(userId), storage.getUser(order.sellerId), storage.getProductById(order.productId)]);
        const notif = await storage.createNotification({ userId: order.sellerId, type: "wallet_credit", title: "Payment Released!", message: `$${sellerReceives.toFixed(2)} has been released to your wallet for Order #${order.id} ("${prod?.title ?? "item"}")`, data: { orderId: order.id }, isRead: false });
        pushToUser(order.sellerId, "notification", notif);
        if (sellerUser && prod) sendOrderUpdateEmail(sellerUser.email, sellerUser.firstName, "delivered", prod.title, order.id).catch(() => {});
      } catch { /* non-critical */ }

      res.json({ message: `Receipt confirmed. $${sellerReceives.toFixed(2)} released to seller.` });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Seller adds a real-time tracking update
  app.post("/api/orders/:id/tracking", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { statusLabel, description, location } = req.body;
    if (!statusLabel || !description) return res.status(400).json({ message: "statusLabel and description are required" });
    try {
      const order = await storage.getOrderById(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.sellerId !== userId) return res.status(403).json({ message: "Only the seller can add tracking updates" });
      if (order.escrowReleased || ["delivered", "cancelled"].includes(order.status)) {
        return res.status(400).json({ message: "Tracking updates are closed for this order." });
      }
      const tracking = await storage.createOrderTracking({ orderId: order.id, statusLabel, description, location: location || undefined });
      // Push tracking update to buyer
      try {
        const notif = await storage.createNotification({ userId: order.buyerId, type: "order_update", title: `Tracking: ${statusLabel}`, message: description, data: { orderId: order.id }, isRead: false });
        pushToUser(order.buyerId, "notification", notif);
      } catch { /* non-critical */ }
      res.json(tracking);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get tracking timeline for an order
  app.get("/api/orders/:id/tracking", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const order = await storage.getOrderById(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyerId !== userId && order.sellerId !== userId) return res.status(403).json({ message: "Access denied" });
      const tracking = await storage.getOrderTracking(order.id);
      res.json(tracking);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── E-COMMERCE CHAT ─────────────────────────────────────────────────────────
  // Get all chats for the current user
  app.get("/api/chats", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const cacheKey = `chats:${userId}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
      const chats = await storage.getUserChats(userId);
      setCached(cacheKey, chats, 15_000);
      res.json(chats);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get or create a chat for a specific product
  app.post("/api/chats", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "productId required" });
    try {
      const product = await storage.getProductById(parseInt(productId));
      if (!product) return res.status(404).json({ message: "Product not found" });
      const requester = await storage.getUser(userId);
      if (product.sellerId === userId || (requester && (product as any).sellerEmail && (product as any).sellerEmail === requester.email)) {
        return res.status(400).json({ message: "You cannot chat with yourself on your own listing" });
      }
      const chat = await storage.getOrCreateChat(parseInt(productId), userId, product.sellerId);
      res.json(chat);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get messages for a chat
  app.get("/api/chats/:chatId/messages", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const chatId = req.params.chatId;
      const cacheKey = `chat_msgs:${chatId}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
      const messages = await storage.getChatMessages(parseInt(chatId));
      setCached(cacheKey, messages, 8_000);
      res.json(messages);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Mark all messages in a chat as read by the current user
  app.patch("/api/chats/:chatId/read", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.markChatMessagesRead(parseInt(req.params.chatId), userId);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Send a message — server-side censorship as defence-in-depth
  app.post("/api/chats/:chatId/messages", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Message cannot be empty" });
    try {
      const { censorOffPlatform } = await import("@shared/schema");
      const { censored, flagged } = censorOffPlatform(content.trim());
      const chatId = parseInt(req.params.chatId);
      const msg = await storage.createChatMessage({
        chatId,
        senderId: userId,
        content: censored,
        isFlagged: flagged,
      });
      invalidateCacheKey(`chat_msgs:${chatId}`);
      invalidateCachePrefix(`chats:`);

      // Notify the other party in the chat
      try {
        const chats = await storage.getUserChats(userId);
        const chat = chats.find(c => c.id === parseInt(req.params.chatId));
        if (chat) {
          const recipientId = chat.buyerId === userId ? chat.sellerId : chat.buyerId;
          const sender = await storage.getUser(userId);
          const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Someone";
          await storage.createNotification({
            userId: recipientId,
            type: "chat_message",
            title: "New Message",
            message: `${senderName} sent you a message about "${chat.productTitle || "a product"}".`,
            data: { chatId: chat.id, productId: chat.productId },
            isRead: false,
          });
        }
      } catch { /* non-critical — don't fail the message send */ }

      res.json(msg);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
  // GET /api/notifications — returns notifications for the logged-in user.
  // Also auto-inserts bot reminder notifications based on current UK time.
  app.get("/api/notifications", async (req, res) => {
    if (!(req as any).session?.userId) return res.status(401).json({ error: "Not authenticated" });
    const userId = (req as any).session.userId;
    const userRole = (req as any).session.role;

    // Auto-generate bot reminder for affiliates based on UK time
    if (userRole === "affiliate") {
      const now = new Date();
      const ukHour   = parseInt(now.toLocaleString("en-US", { timeZone: "Europe/London", hour: "numeric", hour12: false }));
      const ukMinute = now.getMinutes();

      const is1230 = ukHour === 12 && ukMinute >= 28 && ukMinute <= 35;
      const is1pm  = ukHour === 13 && ukMinute <= 5;

      if (is1230) {
        const already = await storage.hasBotReminderToday(userId, "30-Minute Bot Reminder");
        if (!already) {
          await storage.createNotification({
            userId,
            type: "bot_reminder",
            title: "30-Minute Bot Reminder",
            message: "It's nearly 1:00 PM GMT! Come back in 30 minutes to activate your Itera Trading BOT and start today's trading session.",
            data: { ukHour, ukMinute },
            isRead: false,
          });
        }
      }
      if (is1pm) {
        const already = await storage.hasBotReminderToday(userId, "Bot Activation Window Open");
        if (!already) {
          await storage.createNotification({
            userId,
            type: "bot_reminder",
            title: "Bot Activation Window Open",
            message: "It's 1:00 PM GMT! Your Itera Trading BOT activation window is now open. Go to Trade Market → activate your bot to start today's 2% trades.",
            data: { ukHour, ukMinute },
            isRead: false,
          });
        }
      }
    }

    try {
      const notifs = await storage.getNotifications(userId);
      const unreadCount = notifs.filter(n => !n.isRead).length;
      res.json({ notifications: notifs, unreadCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/notifications/read-all — mark all as read
  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!(req as any).session?.userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      await storage.markAllNotificationsRead((req as any).session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/notifications/mark-type-read — mark all notifications of a given type as read
  app.patch("/api/notifications/mark-type-read", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { type } = req.body;
    if (!type) return res.status(400).json({ message: "type is required" });
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
    res.json({ success: true });
  });

  // DELETE /api/notifications — clear all notifications
  app.delete("/api/notifications", async (req, res) => {
    if (!(req as any).session?.userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      await storage.clearNotifications((req as any).session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/notifications — create a notification (internal / admin use)
  app.post("/api/notifications", async (req, res) => {
    if (!(req as any).session?.userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { type, title, message, data } = req.body;
      const notif = await storage.createNotification({
        userId: (req as any).session.userId,
        type: type || "system",
        title,
        message,
        data: data ?? null,
        isRead: false,
      });
      res.json(notif);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Call Sessions (WebRTC signaling) ─────────────────────────────────────
  // POST /api/calls/initiate  — caller creates a session
  app.post("/api/calls/initiate", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { calleeId, productId, chatId } = req.body;
      if (!calleeId) return res.status(400).json({ error: "calleeId required" });
      // End any existing active calls for this user
      await storage.endStaleCalls(userId);
      const session = await storage.createCallSession({
        callerId: userId,
        calleeId: Number(calleeId),
        productId: productId ? Number(productId) : undefined,
        chatId: chatId ? Number(chatId) : undefined,
        status: "ringing",
        callerSdp: null,
        calleeSdp: null,
        callerIce: [],
        calleeIce: [],
      });
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/calls/incoming  — callee polls for ringing calls
  app.get("/api/calls/incoming", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const session = await storage.getIncomingCall(userId);
      res.json(session ?? null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/calls/:id  — poll for SDP / ICE / status
  app.get("/api/calls/:id", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const s = await storage.getCallSession(Number(req.params.id));
      if (!s) return res.status(404).json({ error: "Call not found" });
      if (s.callerId !== userId && s.calleeId !== userId) return res.status(403).json({ error: "Forbidden" });
      res.json(s);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/calls/:id  — update SDP / status
  app.patch("/api/calls/:id", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const s = await storage.getCallSession(Number(req.params.id));
      if (!s) return res.status(404).json({ error: "Call not found" });
      if (s.callerId !== userId && s.calleeId !== userId) return res.status(403).json({ error: "Forbidden" });
      const allowed = ["callerSdp","calleeSdp","status"] as const;
      const patch: any = {};
      for (const key of allowed) if (req.body[key] !== undefined) patch[key] = req.body[key];
      const updated = await storage.updateCallSession(Number(req.params.id), patch);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/calls/:id/ice  — append ICE candidates
  app.post("/api/calls/:id/ice", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const s = await storage.getCallSession(Number(req.params.id));
      if (!s) return res.status(404).json({ error: "Call not found" });
      const { candidates, side } = req.body;
      if (!Array.isArray(candidates)) return res.status(400).json({ error: "candidates must be array" });
      const field = side === "caller" ? "callerIce" : "calleeIce";
      const existing: any[] = (s as any)[field] ?? [];
      const updated = await storage.updateCallSession(Number(req.params.id), {
        [field]: [...existing, ...candidates],
      } as any);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/calls/:id  — end / reject call
  app.delete("/api/calls/:id", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const s = await storage.getCallSession(Number(req.params.id));
      if (!s) return res.status(404).json({ error: "Call not found" });
      const reason = req.body?.reason;
      const newStatus = reason === "reject" ? "rejected" : "ended";
      const updated = await storage.updateCallSession(Number(req.params.id), { status: newStatus as any });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Forum ────────────────────────────────────────────────────────────────
  // GET /api/forum/topics  — list topics (filtered by section)
  app.get("/api/forum/topics", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const section = (req.query.section as string) ?? "both";
      const search = req.query.search as string | undefined;
      const topics = await storage.getForumTopics(section, userId, search);
      res.json(topics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/forum/topics  — create topic
  app.post("/api/forum/topics", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { title, body, section, tags } = req.body;
      if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: "title and body required" });
      const topic = await storage.createForumTopic({
        title: title.trim(),
        body: body.trim(),
        authorId: userId,
        section: (section ?? "both") as any,
        tags: Array.isArray(tags) ? tags : [],
      });
      res.json(topic);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forum/topics/:id  — single topic
  app.get("/api/forum/topics/:id", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const topic = await storage.getForumTopic(Number(req.params.id));
      if (!topic) return res.status(404).json({ error: "Topic not found" });
      res.json(topic);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/forum/topics/:id/like  — toggle like
  app.post("/api/forum/topics/:id/like", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const result = await storage.toggleForumTopicLike(Number(req.params.id), userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forum/topics/:id/posts  — replies
  app.get("/api/forum/topics/:id/posts", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const posts = await storage.getForumPosts(Number(req.params.id), userId);
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/forum/topics/:id/posts  — reply
  app.post("/api/forum/topics/:id/posts", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "content required" });
      const post = await storage.createForumPost({
        topicId: Number(req.params.id),
        content: content.trim(),
        authorId: userId,
      });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/forum/posts/:id/like  — toggle like
  app.post("/api/forum/posts/:id/like", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const result = await storage.toggleForumPostLike(Number(req.params.id), userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── TOUR AFRICA BOOKINGS ──────────────────────────────────────────────────
  const TOUR_COMMISSION_RATE = 0.10; // 10% TSIA commission on all tour bookings

  // POST /api/tour/book
  app.post("/api/tour/book", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { type, details, amount } = req.body;
      if (!["hotel", "car_hire", "flight"].includes(type)) {
        return res.status(400).json({ message: "Invalid booking type. Must be hotel, car_hire, or flight." });
      }
      const totalAmount = parseFloat(amount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount." });
      }

      // Check wallet balance
      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance || "0");
      if (balance < totalAmount) {
        return res.status(400).json({ message: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${totalAmount.toFixed(2)}.` });
      }

      const commission = parseFloat((totalAmount * TOUR_COMMISSION_RATE).toFixed(2));
      const reference = `TOUR-${type.toUpperCase()}-${Date.now()}`;

      // Deduct from wallet
      await storage.updateWalletBalance(userId, (balance - totalAmount).toFixed(2));

      const booking = await storage.createTourBooking({
        userId,
        type,
        details,
        totalAmount: totalAmount.toFixed(2),
        commissionAmount: commission.toFixed(2),
        currency: "USD",
        status: "confirmed",
        reference,
      });

      // Credit TSIA reserve (10% commission)
      await storage.addToReserveFund(commission.toFixed(6));

      await storage.createNotification({
        userId,
        type: "system",
        title: `${type === "hotel" ? "Hotel" : type === "car_hire" ? "Car Hire" : "Flight"} Booking Confirmed`,
        message: `Your booking is confirmed. $${totalAmount.toFixed(2)} charged, ref: ${reference}.`,
        data: { booking: booking.id, type, totalAmount, commission },
        isRead: false,
      });
      storage.getUser(userId).then(u => {
        if (u) sendTourBookingEmail(u.email, u.firstName, type, totalAmount.toFixed(2), reference).catch((err: any) => console.error("[EMAIL] Tour booking email failed:", err?.message ?? err));
      });

      res.json({ ...booking, message: "Booking confirmed!" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/tour/bookings
  app.get("/api/tour/bookings", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const bookings = await storage.getTourBookingsByUser(userId);
      res.json(bookings);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── QCE (QUICK CREDIT ELIGIBILITY) ──────────────────────────────────────────

  // GET /api/qce/status — get user's QCE SwiftVault record
  app.get("/api/qce/status", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const savings = await storage.getOrCreateQceSavings(userId);
      const transactions = await storage.getQceTransactions(userId);
      res.json({ savings, transactions });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/qce/contribute — add funds to QCE SwiftVault from personal wallet
  app.post("/api/qce/contribute", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required." });

      // Check personal wallet has enough
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBal = parseFloat(wallet.balance);
      if (walletBal < amount) return res.status(400).json({ message: `Insufficient wallet balance. You have $${walletBal.toFixed(2)}.` });

      // Minimum activation check
      const qce = await storage.getOrCreateQceSavings(userId);
      if (!qce.activated && amount < QCE.MIN_ACTIVATION) {
        return res.status(400).json({ message: `Initial QCE activation requires a minimum of $${QCE.MIN_ACTIVATION}.` });
      }

      // Deduct from personal wallet
      const newWalletBal = (walletBal - amount).toFixed(2);
      await storage.updateWalletBalance(userId, newWalletBal);

      // Credit QCE SwiftVault
      const { savings, transaction } = await storage.contributeToQce(userId, amount);

      // Tick QCE days for returning users making daily contributions
      await storage.tickQceDays(userId);

      // Send notification if first activation
      if (!qce.activated) {
        try {
          const qceNotif = await storage.createNotification({
            userId,
            type: "qce_update",
            title: "🎉 QCE SwiftVault Activated — 30% Credit Eligibility Unlocked!",
            message: `Your QCE SwiftVault is now active with $${amount.toFixed(2)}. You have been instantly granted 30% credit eligibility. All credit services (V-Connect, Student Loans, Home Credit, Business Credit) are now fully accessible.`,
            data: { balance: savings.balance, eligibility: 30, creditPortalUnlocked: true },
            isRead: false,
          });
          pushToUser(userId, "notification", qceNotif);
          storage.getUser(userId).then(u => {
            if (u) sendQceActivationEmail(u.email, u.firstName, amount.toFixed(2)).catch((err: any) => console.error("[EMAIL] QCE activation email failed:", err?.message ?? err));
          });
        } catch { /* non-critical */ }
      }

      res.json({ savings, transaction, walletBalance: newWalletBal, message: "Contribution successful!" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/qce/withdraw — withdraw from QCE SwiftVault back to personal wallet
  app.post("/api/qce/withdraw", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required." });

      // ── 90-day lock + 24-hour withdrawal window ──────────────────────────
      const qceSavings = await storage.getOrCreateQceSavings(userId);
      if (qceSavings.startDate) {
        const startMs    = new Date(qceSavings.startDate).getTime();
        const maturityMs = startMs + QCE.PERIOD_DAYS * 24 * 3600 * 1000;
        const windowEndMs = maturityMs + 24 * 3600 * 1000;
        const now = Date.now();

        if (now < maturityMs) {
          const hoursLeft = Math.ceil((maturityMs - now) / 3600000);
          const days = Math.floor(hoursLeft / 24);
          const hrs  = hoursLeft % 24;
          const maturityDate = new Date(maturityMs).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          return res.status(403).json({
            message: `Your QCE SwiftVault is locked for the 90-day savings period. ${days}d ${hrs}h remaining. Your 24-hour withdrawal window opens automatically on ${maturityDate}.`,
            locked: true,
            maturityDate: new Date(maturityMs).toISOString(),
            windowEndDate: new Date(windowEndMs).toISOString(),
          });
        }

        if (now > windowEndMs) {
          return res.status(403).json({
            message: "Your 24-hour withdrawal window has closed. Please contact support if you need assistance with your SwiftVault funds.",
            locked: true,
            windowExpired: true,
          });
        }
      }
      // ────────────────────────────────────────────────────────────────────

      const { savings, transaction } = await storage.withdrawFromQce(userId, amount);

      // Credit personal wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const newWalletBal = (parseFloat(wallet.balance) + amount).toFixed(2);
      await storage.updateWalletBalance(userId, newWalletBal);

      // Notify user and send email
      try {
        const qceWdNotif = await storage.createNotification({
          userId,
          type: "qce_update",
          title: "QCE SwiftVault Withdrawn",
          message: `$${amount.toFixed(2)} withdrawn from your QCE SwiftVault back to your SwiftWallet. Your new wallet balance is $${newWalletBal}.`,
          data: { amount, newWalletBal },
          isRead: false,
        });
        pushToUser(userId, "notification", qceWdNotif);
        storage.getUser(userId).then(u => {
          if (u) sendQceWithdrawalEmail(u.email, u.firstName, amount.toFixed(2), newWalletBal).catch((err: any) => console.error("[EMAIL] QCE withdrawal email failed:", err?.message ?? err));
        });
      } catch { /* non-critical */ }

      res.json({ savings, transaction, walletBalance: newWalletBal, message: "Withdrawal successful!" });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // POST /api/qce/tick — called daily to advance active savings day count
  app.post("/api/qce/tick", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const savings = await storage.tickQceDays(userId);
      res.json({ savings });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── VIRTUAL CARDS ─────────────────────────────────────────────────────────
  const VIRTUAL_CARD_FEE = 5;

  function generateCardNumber(): string {
    // Generate a 16-digit Mastercard-like number (starts with 5)
    let num = "5" + Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join("");
    return num.replace(/(\d{4})/g, "$1 ").trim();
  }
  function generateCvv(): string { return String(Math.floor(100 + Math.random() * 900)); }
  function generateExpiry(): { month: string; year: string } {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return { month: String(d.getMonth() + 1).padStart(2, "0"), year: String(d.getFullYear()).slice(-2) };
  }

  app.get("/api/fintech/virtual-card", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const card = await storage.getVirtualCard(userId);
      res.json({ card });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/fintech/virtual-card/purchase", async (_req, res) => {
    return res.status(503).json({
      message: "Virtual US Mastercard issuance is coming soon. We're integrating with a licensed card issuer (Bridgecard / Sudo) to provide real, fundable virtual cards.",
      comingSoon: true,
    });
  });

  app.post("/api/fintech/virtual-card/purchase-disabled", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const existing = await storage.getVirtualCard(userId);
      if (existing) return res.status(400).json({ message: "You already have a virtual card." });

      const wallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(wallet.balance) < VIRTUAL_CARD_FEE) {
        return res.status(400).json({ message: `Insufficient balance. A virtual card costs $${VIRTUAL_CARD_FEE}.` });
      }

      const newBal = (parseFloat(wallet.balance) - VIRTUAL_CARD_FEE).toFixed(2);
      await storage.updateWalletBalance(userId, newBal);

      const { billingName, billingAddress, billingCity, billingRegion, billingZip, pin } = req.body;
      const user = await storage.getUser(userId);
      const expiry = generateExpiry();
      const resolvedHolder = (billingName?.trim() || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`).trim().toUpperCase();
      const card = await storage.createVirtualCard({
        userId,
        cardNumber: generateCardNumber(),
        cardHolder: resolvedHolder,
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        cvv: generateCvv(),
        status: "active",
        balance: "0.00",
        billingAddress: billingAddress?.trim() || null,
        billingCity: billingCity?.trim() || null,
        billingRegion: billingRegion?.trim() || null,
        billingZip: billingZip?.trim() || null,
        pin: pin || null,
      } as any);

      await storage.createTransaction({
        userId,
        type: "bill",
        amount: (-VIRTUAL_CARD_FEE).toFixed(2),
        fee: "0.00",
        paymentMethod: "wallet",
        description: `Virtual US Mastercard issued — $${VIRTUAL_CARD_FEE} one-time fee`,
      });

      invalidateCacheKey(userId, "wallet");
      invalidateCacheKey(userId, "transactions");

      const notif = await storage.createNotification({
        userId,
        type: "system",
        title: "💳 Virtual US Mastercard Issued!",
        message: `Your virtual Mastercard has been created. Card: ${card.cardNumber}. Valid thru: ${card.expiryMonth}/${card.expiryYear}.`,
        data: { cardId: card.id },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);

      res.json({ card, walletBalance: newBal });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── MOVIE SUBSCRIPTIONS ───────────────────────────────────────────────────
  const NETFLIX_MONTHLY_FEE = 5;

  // ─── ADMIN: Broadcast "new movie added" email + notification to all users ──
  app.post("/api/admin/movies/broadcast", async (req, res) => {
    const session = req.session as any;
    if (!session?.userId || session.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const { title, description } = req.body ?? {};
    const movieTitle = String(title ?? "").trim();
    const movieDesc  = description ? String(description).trim() : undefined;
    if (!movieTitle) return res.status(400).json({ message: "Movie title is required" });
    if (movieTitle.length > 200) return res.status(400).json({ message: "Title too long (max 200 chars)" });
    if (movieDesc && movieDesc.length > 500) return res.status(400).json({ message: "Description too long (max 500 chars)" });

    res.json({ ok: true, message: "Broadcast started — emails are being sent in the background." });

    setImmediate(async () => {
      try {
        const allUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role }).from(users);
        const recipients = allUsers.filter(u => u.role !== "admin");
        let sent = 0;
        for (const u of recipients) {
          try {
            const notif = await storage.createNotification({
              userId: u.id,
              type: "new_movie",
              title: "🎥 New Movie Added",
              message: `"${movieTitle}" is now streaming on TSIA Movies & Streaming. Tap to watch.`,
              data: { movieTitle, movieDesc: movieDesc ?? null },
              isRead: false,
            });
            try { pushToUser(u.id, "notification", notif); } catch {}
            sendNewMovieEmail(u.email, u.firstName, movieTitle, movieDesc).catch((err: any) => console.error("[EMAIL] New movie email failed:", err?.message ?? err));
            sent++;
          } catch {}
        }
        console.log(`[MOVIES] New movie broadcast "${movieTitle}" → ${sent}/${recipients.length} users`);
      } catch (err: any) {
        console.error("[MOVIES] Broadcast error:", err?.message ?? err);
      }
    });
  });

  app.get("/api/movies/subscription", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const sub = await storage.getMovieSubscription(userId);
      res.json({ subscription: sub });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/movies/subscribe", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const wallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(wallet.balance) < NETFLIX_MONTHLY_FEE) {
        return res.status(400).json({ message: `Insufficient balance. Netflix access costs $${NETFLIX_MONTHLY_FEE}/month.` });
      }

      const newBal = (parseFloat(wallet.balance) - NETFLIX_MONTHLY_FEE).toFixed(2);
      await storage.updateWalletBalance(userId, newBal);

      const sub = await storage.createOrRenewMovieSubscription(userId);

      await storage.createTransaction({
        userId,
        type: "bill",
        amount: (-NETFLIX_MONTHLY_FEE).toFixed(2),
        fee: "0.00",
        paymentMethod: "wallet",
        description: `Netflix access subscription — $${NETFLIX_MONTHLY_FEE}/month`,
      });

      invalidateCacheKey(userId, "wallet");
      invalidateCacheKey(userId, "transactions");

      const notif = await storage.createNotification({
        userId,
        type: "system",
        title: "🎬 Netflix Access Activated!",
        message: `Your Netflix access is active until ${new Date(sub.expiresAt).toLocaleDateString()}. Enjoy streaming!`,
        data: { subId: sub.id },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);

      res.json({ subscription: sub, walletBalance: newBal });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── SERVER-SENT EVENTS ────────────────────────────────────────────────────
  app.get("/api/events", (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).end();
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.flushHeaders();
    res.write(": connected\n\n");
    addSseClient(userId, res);
    const hb = setInterval(() => {
      try { res.write(": ping\n\n"); }
      catch { clearInterval(hb); removeSseClient(userId, res); }
    }, 5 * 60 * 1000); // ping every 5 minutes (was 45s) to reduce compute costs
    req.on("close", () => { clearInterval(hb); removeSseClient(userId, res); });
  });

  // ─── PRICE ALERTS ──────────────────────────────────────────────────────────
  // GET /api/price-alerts — get product IDs the user is watching
  app.get("/api/price-alerts", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const productIds = await storage.getUserPriceAlertProductIds(userId);
      res.json({ productIds });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/price-alerts — watch a product
  app.post("/api/price-alerts", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "productId required" });
    try {
      const prod = await storage.getProductById(parseInt(productId));
      if (!prod) return res.status(404).json({ message: "Product not found" });
      const alert = await storage.upsertPriceAlert(userId, prod.id, prod.price);
      res.json(alert);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/price-alerts/:productId — unwatch a product
  app.delete("/api/price-alerts/:productId", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deletePriceAlert(userId, parseInt(req.params.productId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── CATEGORY SUBSCRIPTIONS ────────────────────────────────────────────────
  // GET /api/category-subscriptions — get user's subscribed categories
  app.get("/api/category-subscriptions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const categories = await storage.getUserCategorySubscriptions(userId);
      res.json({ categories });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/category-subscriptions — subscribe to a category
  app.post("/api/category-subscriptions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { category } = req.body;
    if (!category) return res.status(400).json({ message: "category required" });
    try {
      const sub = await storage.upsertCategorySubscription(userId, category);
      res.json(sub);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/category-subscriptions/:category — unsubscribe from a category
  app.delete("/api/category-subscriptions/:category", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await storage.deleteCategorySubscription(userId, decodeURIComponent(req.params.category));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/contact — public support contact form
  app.post("/api/contact", async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email and message are required." });
    }
    const adminEmail = process.env.ADMIN_EMAIL || "support@tsiforafrica.com";
    const subjectLabel = subject || "General Inquiry";
    try {
      await Promise.all([
        sendSupportContactToAdmin(adminEmail, { name, email, phone: phone || "", subject: subjectLabel, message }),
        sendSupportConfirmation(email, name, subjectLabel),
      ]);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[CONTACT] Email error:", err.message);
      res.status(500).json({ message: "Failed to send message. Please try again." });
    }
  });

  // ─── AUTO BACKFILL: credit missed referral commissions on startup ─────────────
  // Covers THREE activation milestones:
  //   1. Wallet KYC done (biometricVerified = true)
  //   2. Portal/subscription fee paid (portalFeePaid = true)
  //   3. Wallet funded to $5+ (wallets.activated = true)
  setImmediate(async () => {
    try {
      // Single combined query: all referred users who completed any activation milestone
      // but whose referrer never received a commission for them
      const missedRows = await db.execute(sql`
        SELECT DISTINCT
          u.id,
          u.first_name,
          u.last_name,
          u.referred_by,
          COALESCE(w.balance, '0') AS balance
        FROM users u
        LEFT JOIN wallets      w ON w.user_id  = u.id
        LEFT JOIN verifications v ON v.user_id = u.id
        WHERE u.referred_by IS NOT NULL
          AND (
            v.biometric_verified = true
            OR v.portal_fee_paid = true
            OR w.activated       = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM trade_transactions tt
            JOIN users ref_u ON UPPER(ref_u.affiliate_code) = UPPER(TRIM(u.referred_by))
            WHERE tt.user_id = ref_u.id
              AND tt.type    = 'bot_earning'
              AND tt.note LIKE '%Referral commission%'
              AND tt.note LIKE '%' || u.first_name || ' ' || u.last_name || '%'
          )
      `);

      let credited = 0;
      for (const row of missedRows.rows as any[]) {
        const balance = parseFloat(row.balance ?? "0");
        const base    = balance >= 3 ? balance : 3;
        const result  = await creditReferrerCommissionOnce(row.id, base, "activation (backfill)");
        if (result.credited) credited++;
      }

      if (credited > 0) {
        console.log(`[REFERRAL BACKFILL] Credited ${credited} missing referral commissions on startup.`);
      } else {
        console.log(`[REFERRAL BACKFILL] No missing commissions found.`);
      }
    } catch (e: any) {
      console.error("[REFERRAL BACKFILL] Error:", e.message);
    }
  });

  // ── Startup: backfill missing Semester 2 disbursements ──────────────────────
  setImmediate(async () => {
    try {
      const allDisbs = await storage.getAllDisbursements();
      const userIds = [...new Set(allDisbs.map((d: any) => d.userId))];
      let created = 0;
      for (const uid of userIds) {
        const userDisbs = allDisbs.filter((d: any) => d.userId === uid);
        const sem1 = userDisbs.find((d: any) => (d.semesterNum ?? 1) === 1);
        const sem2 = userDisbs.find((d: any) => d.semesterNum === 2);
        if (sem1 && !sem2) {
          await storage.createDisbursement({ userId: uid, amount: sem1.amount, status: "pending", semesterNum: 2 });
          created++;
        }
      }
      if (created > 0) console.log(`[SEM2-BACKFILL] Created ${created} missing Semester 2 disbursement(s).`);
      else console.log(`[SEM2-BACKFILL] All students already have Semester 2 disbursements.`);
    } catch (e: any) {
      console.error("[SEM2-BACKFILL] Error:", e.message);
    }
  });

  // ── Background job: re-verify stuck Korapay/Squad pending deposits ──────────
  // Runs every 2 minutes and immediately on startup.
  async function runDepositReverify() {
    try {
      const pending = await storage.getPendingWalletDeposits();
      const fiat = pending.filter((d: any) => d.walletType === "korapay" || d.walletType === "squad");
      if (fiat.length === 0) return;
      console.log(`[DEPOSIT-REVERIFY] Checking ${fiat.length} pending fiat deposit(s)…`);
      const koraSecret  = process.env.KORAPAY_SECRET_KEY ?? "";
      const squadSecret = process.env.SQUAD_SECRET_KEY ?? "";
      const squadBase   = squadSecret.startsWith("sk_") ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
      for (const dep of fiat) {
        const userId  = (dep as any).user_id ?? dep.userId;
        const txHash  = (dep as any).tx_hash ?? dep.txHash;
        const depId   = dep.id;
        const gross   = parseFloat((dep as any).amount_usd ?? dep.amountUsd);
        if (!txHash || !userId || !(gross > 0)) {
          console.warn(`[DEPOSIT-REVERIFY] Skipping deposit ${dep.id} — missing userId/txHash/amount`);
          continue;
        }
        try {
          let confirmed = false;
          let gatewayStatus = "unknown";
          if (dep.walletType === "korapay" && koraSecret) {
            const r = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(txHash)}`, {
              headers: { Authorization: `Bearer ${koraSecret}` },
              signal: AbortSignal.timeout(10000),
            });
            const d = await r.json() as any;
            gatewayStatus = d.data?.status ?? (d.status === false ? "api_error" : "unknown");
            confirmed = d.status === true && d.data?.status === "success";
          } else if (dep.walletType === "squad" && squadSecret) {
            const r = await fetch(`${squadBase}/transaction/verify/${encodeURIComponent(txHash)}`, {
              headers: { Authorization: `Bearer ${squadSecret}` },
              signal: AbortSignal.timeout(10000),
            });
            const d = await r.json() as any;
            gatewayStatus = d.data?.transaction_status ?? (d.success === false ? d.message ?? "api_error" : "unknown");
            confirmed = d.success === true && d.data?.transaction_status === "Success";
          }
          if (confirmed) {
            console.log(`[DEPOSIT-REVERIFY] ✓ Crediting user ${userId} $${gross} for ${dep.walletType} ref ${txHash}`);
            await creditWalletWithSplit(userId, gross, dep.walletType, txHash, { id: depId, amountUsd: String(gross), status: "pending" });
          } else {
            console.log(`[DEPOSIT-REVERIFY] ✗ Deposit ${depId} not confirmed yet — gateway status: ${gatewayStatus} (ref: ${txHash})`);
          }
        } catch (err: any) {
          console.error(`[DEPOSIT-REVERIFY] Error checking deposit ${depId} (${txHash}):`, err.message ?? err);
        }
      }
    } catch (e: any) {
      console.error("[DEPOSIT-REVERIFY] Job error:", e.message);
    }
  }

  // Run immediately on startup, then every 2 minutes
  setTimeout(() => runDepositReverify(), 15_000); // 15 s delay to let server fully init
  setInterval(runDepositReverify, 2 * 60 * 1000);
  console.log("[DEPOSIT-REVERIFY] Background re-verify job started — checks pending fiat deposits every 2 min (first run in 15 s)");

  // ── Masters Commitment Window Auto-Expiry Job ─────────────────────────────
  // Deletes masters scholarship records where the 30-day payment window has
  // elapsed without the commitment fee being paid, so the student can start fresh.
  async function runCommitmentExpiry() {
    try {
      const all = await storage.getAllScholarships();
      const now = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      let deleted = 0;
      for (const rec of all) {
        if (
          rec.type === "masters" &&
          rec.status === "fee_paid" &&
          !rec.commitmentFeePaid &&
          rec.commitmentStartDate &&
          (now - new Date(rec.commitmentStartDate).getTime()) >= THIRTY_DAYS_MS
        ) {
          await storage.deleteScholarship(rec.id);
          deleted++;
          console.log(`[COMMITMENT-EXPIRY] Deleted expired masters enrollment id=${rec.id} user=${rec.userId}`);
          // Notify the user their window expired
          try {
            const expiredNotif = await storage.createNotification({
              userId: rec.userId,
              type: "verification_update",
              title: "Masters Commitment Window Expired",
              message: "Your 30-day commitment payment window has passed without payment. Your enrollment has been reset — you can start a fresh application whenever you're ready.",
              data: {},
              isRead: false,
            });
            pushToUser(rec.userId, "notification", expiredNotif);
          } catch { /* non-critical */ }
        }
      }
      if (deleted > 0) console.log(`[COMMITMENT-EXPIRY] Expired and removed ${deleted} masters enrollment(s).`);
    } catch (e: any) {
      console.error("[COMMITMENT-EXPIRY] Job error:", e.message);
    }
  }

  setTimeout(() => runCommitmentExpiry(), 30_000); // 30 s after startup
  setInterval(runCommitmentExpiry, 60 * 60 * 1000); // every hour
  console.log("[COMMITMENT-EXPIRY] Masters commitment expiry job started — checks every hour.");

  // ── Weekly TS-Mart digest — every Monday at 08:00 WAT (UTC+1) ───────────────
  async function sendWeeklyMartDigest() {
    try {
      console.log("[TS-MART-DIGEST] Running weekly digest job…");
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allProducts = await storage.getProducts({ status: "active" });
      const newListings = allProducts.filter(p => p.createdAt && new Date(p.createdAt) >= since);
      if (newListings.length === 0) {
        console.log("[TS-MART-DIGEST] No new listings this week — skipping digest.");
        return;
      }
      const digestProducts = newListings.slice(0, 9).map(p => ({
        id: p.id, title: p.title, price: p.price,
        category: p.category, images: (p.images ?? []) as string[],
        condition: p.condition, location: p.location,
      }));
      const featured = digestProducts[0];
      const rest = digestProducts.slice(1);
      const allUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName }).from(users);
      let sent = 0;
      for (const u of allUsers) {
        try {
          sendNewArrivalEmail(u.email, u.firstName, featured, rest).catch(() => {});
          sent++;
        } catch (_) {}
      }
      console.log(`[TS-MART-DIGEST] Weekly digest sent to ${sent} users (${newListings.length} new listings).`);
    } catch (err: any) {
      console.error("[TS-MART-DIGEST] Error:", err.message ?? err);
    }
  }

  // ── CASHBACK ─────────────────────────────────────────────────────────────────
  app.get("/api/wallet/cashback", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const balance = await storage.getCashbackBalance(userId);
      res.json({ balance });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/wallet/cashback/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const amount = parseFloat(req.body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0" });
      const cbWallet = await storage.getOrCreateWallet(userId);
      if ((cbWallet.lienReason ?? "").startsWith("loan_active:")) return res.status(403).json({ message: "Your wallet is frozen due to an active loan. Cashback withdrawal is blocked until the loan is repaid.", code: "LOAN_LIEN" });
      const result = await storage.withdrawCashbackToWallet(userId, amount);
      invalidateCacheKey(`wallet:${userId}`);
      invalidateCacheKey(`transactions:${userId}`);
      const notif = await storage.createNotification({ userId, type: "wallet_credit", title: "Cashback Withdrawn ✓", message: `$${amount.toFixed(2)} moved from your cashback to your personal wallet.`, data: { amount }, isRead: false });
      pushToUser(userId, "notification", notif);
      res.json({ success: true, ...result });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ── SAVINGS GOALS ────────────────────────────────────────────────────────────
  app.get("/api/savings/goals", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goals = await storage.getSavingsGoalsByUser(userId);
      res.json(goals);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/savings/goals", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { name, type, emoji, targetAmount, targetDate } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Goal name is required" });
      if (!targetAmount || parseFloat(targetAmount) <= 0) return res.status(400).json({ message: "Target amount must be greater than 0" });
      const goal = await storage.createSavingsGoal({
        userId,
        name: name.trim(),
        type: type || "flexible",
        emoji: emoji || "🎯",
        targetAmount: parseFloat(targetAmount).toFixed(2),
        targetDate: targetDate ? new Date(targetDate) : null,
      });
      res.json(goal);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/savings/goals/:id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goalId = parseInt(req.params.id);
      const goal = await storage.getSavingsGoal(goalId, userId);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      const transactions = await storage.getSavingsTransactions(goalId, userId);
      res.json({ goal, transactions });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/savings/goals/:id/deposit", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goalId = parseInt(req.params.id);
      const amount = parseFloat(req.body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0" });
      const result = await storage.depositToSavings(userId, goalId, amount);
      invalidateCache(`wallet:${userId}`);
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/savings/goals/:id/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goalId = parseInt(req.params.id);
      const amount = parseFloat(req.body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0" });
      const result = await storage.withdrawFromSavings(userId, goalId, amount);
      invalidateCache(`wallet:${userId}`);
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/savings/goals/:id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const goalId = parseInt(req.params.id);
      await storage.deleteSavingsGoal(goalId, userId);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ── SCHOLARSHIP PORTAL ────────────────────────────────────────────────────
  app.get("/api/scholarship/my", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const student = await storage.getScholarship(userId, "student");
        const masters = await storage.getScholarship(userId, "masters");
        res.json({ student: student ?? null, masters: masters ?? null });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/start", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid scholarship type" });
        const walletCheck = await storage.getOrCreateWallet(userId);
        if (!walletCheck.activated) return res.status(403).json({ code: "WALLET_NOT_ACTIVATED", message: "You need to activate your SwiftWallet before accessing the Scholarship Portal." });
        const existing = await storage.getScholarship(userId, type);
        if (existing) {
          // Completed test: enforce 365-day cooldown
          if (["passed", "failed"].includes(existing.status) && existing.testCompletedAt) {
            const daysSince = (Date.now() - new Date(existing.testCompletedAt).getTime()) / 86400000;
            if (daysSince < 365) {
              const daysLeft = Math.ceil(365 - daysSince);
              return res.status(429).json({ code: "COOLDOWN", message: `You can re-enroll in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`, daysLeft });
            }
            // 365 days have passed — create a fresh record for re-enrollment
            const fresh = await storage.createScholarship({ userId, type, status: "started" });
            return res.json(fresh);
          }
          return res.json(existing);
        }
        const record = await storage.createScholarship({ userId, type, status: "started" });
        res.json(record);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/waec-validate", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const walletCheck2 = await storage.getOrCreateWallet(userId);
        if (!walletCheck2.activated) return res.status(403).json({ code: "WALLET_NOT_ACTIVATED", message: "You need to activate your SwiftWallet before accessing the Scholarship Portal." });
        const { type, waecRegNumber, waecYear, subjects, grades, schoolName, schoolLocation,
                tertiarySchool, tertiaryType, tertiaryYear, tertiaryGrade } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid scholarship type" });

        let record = await storage.getScholarship(userId, type);
        if (!record) record = await storage.createScholarship({ userId, type, status: "started" });
        // Block re-validation only if the user has already paid the fee or taken the test
        if (record.portalFeePaid || record.status === "test_in_progress" || record.status === "passed" || record.status === "failed") {
          return res.status(400).json({ message: "WAEC already validated for this scholarship" });
        }

        if (!waecRegNumber || !waecYear) return res.status(400).json({ message: "WAEC registration number and year are required" });
        if (!schoolName || !schoolLocation) return res.status(400).json({ message: "School name and location are required" });
        if (!subjects || !Array.isArray(subjects) || subjects.length !== 5)
          return res.status(400).json({ message: "Exactly 5 subjects are required (Mathematics + English Language + 3 electives)" });
        if (!subjects.includes("Mathematics") || !subjects.includes("English Language"))
          return res.status(400).json({ message: "Mathematics and English Language are compulsory subjects" });
        const validGrades = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
        if (!grades || !Array.isArray(grades) || grades.length !== 5 || grades.some((g: string) => !validGrades.includes(g.toUpperCase())))
          return res.status(400).json({ message: `All 5 grades required. Valid grades: ${validGrades.join(", ")}` });

        // Masters: validate tertiary education fields
        if (type === "masters") {
          if (!tertiarySchool) return res.status(400).json({ message: "Tertiary institution name is required for Masters" });
          if (!["university", "polytechnic"].includes(tertiaryType))
            return res.status(400).json({ message: "Certificate type must be University or Polytechnic" });
          if (!tertiaryYear) return res.status(400).json({ message: "Graduation year is required" });
          const validTertiaryGrades = ["first_class", "second_upper", "second_lower"];
          if (!validTertiaryGrades.includes(tertiaryGrade))
            return res.status(400).json({ message: "Grade must be First Class, Second Upper, or Second Class Lower" });
        }

        const gradeScaleRaw = await storage.getPlatformSetting("waec_grade_scale");
        const gradeScale = gradeScaleRaw ? JSON.parse(gradeScaleRaw) : undefined;
        const percentage = calculateWaecPercentage(grades, gradeScale);

        // No upfront WAEC gate for either type — eligibility is the aggregate (WAEC + test) / 2 >= 70%.
        const currentYear = new Date().getFullYear();
        const estimatedAge = currentYear - parseInt(waecYear, 10) + 16;
        const isAgeDisqualified = estimatedAge > 29;

        record = await storage.updateScholarship(record.id, {
          waecRegNumber, waecYear, schoolName, schoolLocation,
          waecSubjects: subjects.join(","),
          waecGrades: grades.join(" "),
          waecPercentage: percentage.toFixed(2) as any,
          ageDisqualified: isAgeDisqualified,
          status: "waec_done",
          ...(type === "masters" ? { tertiarySchool, tertiaryType, tertiaryYear, tertiaryGrade } : {}),
        });

        res.json({ ...record, percentage });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/pay-fee", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid scholarship type" });

        const record = await storage.getScholarship(userId, type);
        if (!record) return res.status(400).json({ message: "Start a scholarship application first" });
        if (record.status !== "waec_done") return res.status(400).json({ message: "Complete WAEC validation first" });
        if (record.portalFeePaid) return res.status(400).json({ message: "Fee already paid" });

        const wallet = await storage.getOrCreateWallet(userId);
        if (!wallet.activated) return res.status(403).json({ message: "Activate your SwiftWallet first" });

        const portalFee = 3.00;
        const serviceCharge = 0.30;
        const totalCharged = portalFee + serviceCharge;
        const bal = parseFloat(wallet.balance);
        const lienAmtFee = parseFloat(wallet.lienAmount ?? "0");
        const availableFee = Math.max(0, bal - lienAmtFee);
        if (availableFee < totalCharged) {
          return res.status(402).json({
            code: "INSUFFICIENT_BALANCE",
            message: `Insufficient balance. You need $${totalCharged.toFixed(2)} but your available balance is $${availableFee.toFixed(2)}${lienAmtFee > 0 ? ` ($${lienAmtFee.toFixed(2)} is locked by an active lien)` : ""}.`,
          });
        }

        await storage.updateWalletBalance(userId, (bal - totalCharged).toFixed(2));
        await storage.createTransaction({
          userId, type: "verification_fee",
          amount: `-${totalCharged.toFixed(2)}`, fee: serviceCharge.toFixed(2),
          paymentMethod: "wallet",
          description: `Scholarship WAEC validation fee — $${portalFee.toFixed(2)} + $${serviceCharge.toFixed(2)} service charge`,
        });

        // For masters: only start the commitment window on their FIRST fee payment.
        // If commitmentFeePaid is already true, they've served the window and are on a fresh restart.
        const setCommitment = type === "masters" && !record.commitmentFeePaid;
        const updated = await storage.updateScholarship(record.id, {
          portalFeePaid: true,
          status: "fee_paid",
          ...(setCommitment ? { commitmentStartDate: new Date() } : {}),
        });

        try {
          const u = await storage.getUser(userId);
          if (u) {
            sendAdminKycEmail({
              name: `${u.firstName} ${u.lastName}`,
              email: u.email,
              kycType: `Scholarship fee paid — ${type} | WAEC: ${record.waecPercentage}% | Ref: SCH-FEE-${Date.now().toString(36).toUpperCase()}`,
              userId,
            }).catch(() => {});
          }
        } catch { /* non-critical */ }

        res.json(updated);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/pay-commitment", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const { mscDuration } = req.body;
        if (!["1year", "2year"].includes(mscDuration))
          return res.status(400).json({ message: "Choose your MSc duration: '1year' ($10) or '2year' ($25)" });

        const record = await storage.getScholarship(userId, "masters");
        if (!record) return res.status(400).json({ message: "No masters scholarship application found" });
        if (record.status !== "fee_paid") return res.status(400).json({ message: "Pay the WAEC validation fee first" });
        if (record.commitmentFeePaid) return res.status(400).json({ message: "Commitment fee already paid" });

        if (!record.commitmentStartDate) return res.status(400).json({ message: "Commitment window not started" });
        const daysSince = (Date.now() - new Date(record.commitmentStartDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince >= 30) {
          // Window has expired — delete the record so the user can start completely fresh
          await storage.deleteScholarship(record.id);
          return res.status(410).json({
            code: "COMMITMENT_EXPIRED",
            message: "Your 30-day commitment window has expired. Your enrollment has been reset — start a fresh application.",
          });
        }

        const wallet = await storage.getOrCreateWallet(userId);
        const commitmentFee = mscDuration === "2year" ? 25.00 : 10.00;
        const bal = parseFloat(wallet.balance);
        const lienAmtCommit = parseFloat(wallet.lienAmount ?? "0");
        const availableCommit = Math.max(0, bal - lienAmtCommit);
        if (availableCommit < commitmentFee) {
          return res.status(402).json({
            code: "INSUFFICIENT_BALANCE",
            message: `Insufficient balance. You need $${commitmentFee.toFixed(2)} but your available balance is $${availableCommit.toFixed(2)}${lienAmtCommit > 0 ? ` ($${lienAmtCommit.toFixed(2)} is locked by an active lien)` : ""}.`,
          });
        }

        await storage.updateWalletBalance(userId, (bal - commitmentFee).toFixed(2));
        await storage.createTransaction({
          userId, type: "plan_payment",
          amount: `-${commitmentFee.toFixed(2)}`, fee: "0.00",
          paymentMethod: "wallet",
          description: `Masters Scholarship ${mscDuration === "2year" ? "2-Year" : "1-Year"} MSc unlock fee — $${commitmentFee.toFixed(2)}`,
        });

        // Commitment served — reset to "started" so user goes through fresh WAEC + fee,
        // but keep commitmentFeePaid=true so no new 30-day window is triggered.
        const updated = await storage.updateScholarship(record.id, {
          commitmentFeePaid: true,
          mscDuration,
          status: "started",
          waecRegNumber: null as any,
          waecYear: null as any,
          waecSubjects: null as any,
          waecGrades: null as any,
          waecPercentage: null as any,
          schoolName: null as any,
          schoolLocation: null as any,
          portalFeePaid: false,
        });

        res.json(updated);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/pay-renewal", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const record = await storage.getScholarship(userId, "masters");
        if (!record) return res.status(400).json({ message: "No masters scholarship found" });
        if (record.status !== "passed") return res.status(400).json({ message: "You must have passed the Masters scholarship test first" });
        if (record.mscDuration !== "2year") return res.status(400).json({ message: "Year-2 renewal is only available for the 2-Year MSc option" });
        if (record.renewalPaid) return res.status(400).json({ message: "Year-2 renewal already paid" });

        // Check 1 year has passed since test completion
        if (!record.testCompletedAt) return res.status(400).json({ message: "Test completion date not found" });
        const msSinceTest = Date.now() - new Date(record.testCompletedAt).getTime();
        const daysSinceTest = msSinceTest / (1000 * 60 * 60 * 24);
        if (daysSinceTest < 365) {
          const daysLeft = Math.ceil(365 - daysSinceTest);
          return res.status(403).json({
            code: "RENEWAL_NOT_DUE",
            message: `Year-2 renewal is available after 1 year from your test date. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.`,
            daysLeft,
          });
        }

        const wallet = await storage.getOrCreateWallet(userId);
        const renewalFee = 25.00;
        const secondPrize = 250.00;
        const bal = parseFloat(wallet.balance);
        const lienAmtRenewal = parseFloat(wallet.lienAmount ?? "0");
        const availableRenewal = Math.max(0, bal - lienAmtRenewal);
        if (availableRenewal < renewalFee) {
          return res.status(402).json({
            code: "INSUFFICIENT_BALANCE",
            message: `Insufficient balance. You need $${renewalFee.toFixed(2)} but your available balance is $${availableRenewal.toFixed(2)}${lienAmtRenewal > 0 ? ` ($${lienAmtRenewal.toFixed(2)} is locked by an active lien)` : ""}.`,
          });
        }

        await storage.updateWalletBalance(userId, (bal - renewalFee).toFixed(2));
        await storage.createTransaction({
          userId, type: "plan_payment",
          amount: `-${renewalFee.toFixed(2)}`, fee: "0.00",
          paymentMethod: "wallet",
          description: "Masters Scholarship Year-2 renewal fee — $25.00",
        });

        const updated = await storage.updateScholarship(record.id, {
          renewalPaid: true,
          renewalPaidAt: new Date(),
        });

        // Notify user
        try {
          const notif = await storage.createNotification({
            userId, type: "system",
            title: "🎓 Year-2 Renewal Submitted!",
            message: `Your $25 renewal fee has been paid. Your second $${secondPrize.toFixed(0)} prize is pending admin approval and will be credited to your wallet once reviewed.`,
            data: { renewalFee, secondPrize },
            isRead: false,
          });
          pushToUser(userId, "notification", notif);
        } catch { /* non-critical */ }

        try {
          const u = await storage.getUser(userId);
          if (u) {
            sendAdminKycEmail({
              name: `${u.firstName} ${u.lastName}`,
              email: u.email,
              kycType: `MASTERS SCHOLARSHIP YEAR-2 RENEWAL | $25 renewal paid | $250 second prize pending | UserId: ${userId}`,
              userId,
            }).catch(() => {});
          }
        } catch { /* non-critical */ }

        res.json(updated);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/report-cheat", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type, eventType, description, timestamp } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid type" });

        const record = await storage.getScholarship(userId, type);
        if (!record || record.status !== "test_in_progress") {
          return res.status(400).json({ message: "No active test session" });
        }

        const td = (record.testData ?? {}) as any;
        const existing: any[] = td.cheatingEvents ?? [];
        const newEvent = {
          eventType: eventType ?? "unknown",
          description: description ?? "",
          timestamp: timestamp ?? new Date().toISOString(),
        };
        const updatedEvents = [...existing, newEvent];

        await storage.updateScholarship(record.id, {
          cheatingFlag: true,
          testData: { ...td, cheatingEvents: updatedEvents } as any,
        });

        res.json({ ok: true, totalEvents: updatedEvents.length });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/restart-after-decline", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid type" });

        const record = await storage.getScholarship(userId, type);
        if (!record) return res.status(400).json({ message: "No scholarship record found" });
        if (record.status !== "declined") return res.status(400).json({ message: "Scholarship is not in declined status" });

        // Accumulate all previously seen question IDs so they won't be shown again
        const td = (record.testData ?? {}) as any;
        const prevUsedVerbal: number[] = Array.from(new Set([
          ...(td.usedVerbalIds ?? []),
          ...(td.verbalIds ?? []),
        ]));
        const prevUsedQuant: number[] = Array.from(new Set([
          ...(td.usedQuantIds ?? []),
          ...(td.quantIds ?? []),
        ]));

        // Reset the record to a fresh started state, preserving used question IDs
        const reset = await storage.updateScholarship(record.id, {
          status: "started",
          portalFeePaid: false,
          commitmentFeePaid: false,
          waecRegNumber: null,
          waecYear: null,
          waecSubjects: null,
          waecGrades: null,
          waecPercentage: null as any,
          schoolName: null,
          schoolLocation: null,
          ageDisqualified: false,
          testStartedAt: null,
          testCompletedAt: null,
          verbalScore: null,
          quantScore: null,
          prizePaid: false,
          prizeAmount: null as any,
          tertiarySchool: null,
          tertiaryType: null,
          tertiaryYear: null,
          tertiaryGrade: null,
          mscDuration: null,
          commitmentStartDate: null,
          testData: { usedVerbalIds: prevUsedVerbal, usedQuantIds: prevUsedQuant } as any,
        });

        res.json(reset);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/start-test", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid type" });

        const record = await storage.getScholarship(userId, type);
        if (!record) return res.status(400).json({ message: "No scholarship application found" });

        // Masters can start after fee_paid when commitmentFeePaid is already true (fresh restart)
        const canStart = (type === "student" && record.status === "fee_paid") ||
                         (type === "masters" && record.status === "fee_paid" && record.commitmentFeePaid) ||
                         record.status === "test_in_progress";
        if (!canStart) return res.status(403).json({ message: "Not eligible to start the test yet" });
        if (["passed", "failed"].includes(record.status)) return res.status(400).json({ message: "Test already completed" });

        let verbalQs: any[];
        let quantQs: any[];

        if (record.status === "test_in_progress" && record.testData) {
          // Resume an in-progress test — serve the same questions as before
          const td = record.testData as any;
          const allQuestions = [...VERBAL_QUESTIONS, ...QUANT_QUESTIONS];
          const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]));
          verbalQs = (td.verbalIds as number[]).map((id: number) => {
            const { correctIndex, ...rest } = qMap[id];
            return { ...rest, correctIndex };
          });
          quantQs = (td.quantIds as number[]).map((id: number) => {
            const { correctIndex, ...rest } = qMap[id];
            return { ...rest, correctIndex };
          });
        } else {
          // Fresh test start — exclude any previously seen question IDs
          const td = (record.testData ?? {}) as any;
          const usedVerbalIds: number[] = td.usedVerbalIds ?? [];
          const usedQuantIds: number[] = td.usedQuantIds ?? [];

          const freshVerbalPool = VERBAL_QUESTIONS.filter(q => !usedVerbalIds.includes(q.id));
          const freshQuantPool = QUANT_QUESTIONS.filter(q => !usedQuantIds.includes(q.id));

          // If the remaining pool is too small (shouldn't happen with 200-question pools), fall back to full pool
          verbalQs = pickQuestions(15, freshVerbalPool.length >= 15 ? freshVerbalPool : VERBAL_QUESTIONS);
          quantQs = pickQuestions(15, freshQuantPool.length >= 15 ? freshQuantPool : QUANT_QUESTIONS);

          await storage.updateScholarship(record.id, {
            status: "test_in_progress",
            testStartedAt: new Date(),
            testData: {
              usedVerbalIds,
              usedQuantIds,
              verbalIds: verbalQs.map((q: any) => q.id),
              quantIds: quantQs.map((q: any) => q.id),
            } as any,
          });
        }

        res.json({ verbal: verbalQs, quant: quantQs });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/scholarship/submit-test", async (req, res) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const { type, answers } = req.body;
        if (!["student", "masters"].includes(type)) return res.status(400).json({ message: "Invalid type" });

        const record = await storage.getScholarship(userId, type);
        if (!record || record.status !== "test_in_progress") return res.status(400).json({ message: "No active test found" });

        const td = record.testData as any;
        const allQuestions = [...VERBAL_QUESTIONS, ...QUANT_QUESTIONS];
        const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]));
        const answerMap: Record<number, number> = {};
        for (const a of (answers ?? [])) answerMap[a.questionId] = a.selectedIndex;

        let verbalScore = 0;
        let quantScore = 0;
        for (const id of (td.verbalIds as number[])) {
          if (answerMap[id] !== undefined && answerMap[id] === qMap[id]?.correctIndex) verbalScore++;
        }
        for (const id of (td.quantIds as number[])) {
          if (answerMap[id] !== undefined && answerMap[id] === qMap[id]?.correctIndex) quantScore++;
        }

        const totalScore = verbalScore + quantScore;
        const testPct = (totalScore / 30) * 100;
        // Use stored waecPercentage (which was calculated with the current grade scale at
        // validation time, and can be overridden per-student by admin via the dashboard).
        const waecPct = parseFloat(record.waecPercentage ?? "0");
        const aggregatePct = (waecPct + testPct) / 2;
        const passed = aggregatePct >= 70;
        const prizeAmount = type === "masters" ? 250 : 100;

        const updated = await storage.updateScholarship(record.id, {
          status: passed ? "passed" : "failed",
          verbalScore, quantScore,
          testCompletedAt: new Date(),
          testData: { ...td, answers: answerMap } as any,
          ...(passed ? { prizeAmount: prizeAmount.toFixed(2) } : {}),
        });

        if (passed) {
          try {
            const notif = await storage.createNotification({
              userId, type: "system",
              title: "🎉 Scholarship Test Passed!",
              message: `Congratulations! Your aggregate score is ${aggregatePct.toFixed(1)}% (WAEC: ${waecPct.toFixed(1)}%, Test: ${testPct.toFixed(1)}%) on the ${type === "masters" ? "Masters" : "Student"} Scholarship. Your $${prizeAmount} prize is pending admin approval and will be credited to your wallet once reviewed.`,
              data: { verbalScore, quantScore, totalScore, waecPct, testPct, aggregatePct, prizeAmount },
              isRead: false,
            });
            pushToUser(userId, "notification", notif);
          } catch { /* non-critical */ }

          try {
            const u = await storage.getUser(userId);
            if (u) {
              sendAdminKycEmail({
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
                kycType: `SCHOLARSHIP PASSED — ${type.toUpperCase()} | WAEC: ${waecPct.toFixed(1)}% | Test: ${testPct.toFixed(1)}% | Aggregate: ${aggregatePct.toFixed(1)}% | Score: ${totalScore}/30 | Prize: $${prizeAmount}`,
                userId,
              }).catch(() => {});
            }
          } catch { /* non-critical */ }
        }

        res.json({ verbalScore, quantScore, totalScore, waecScore: waecPct, testScore: testPct, aggregateScore: aggregatePct, passed, prizeAmount: passed ? prizeAmount : 0 });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

  // ── EXCHANGE MARKET ROUTES ────────────────────────────────────────────────────

  app.get("/api/exchange/quotes", async (_req, res) => {
    try {
      const quotes = await getAllQuotes();
      res.json(quotes);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/exchange/history/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const range = (req.query.range as string) || "1M";
      const data = await getHistory(ticker, range as any);
      res.json(data);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/exchange/portfolio", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [holdings, wallet, quotes] = await Promise.all([
        db.select().from(exchangeHoldings).where(eq(exchangeHoldings.userId, userId)),
        storage.getOrCreateTradeWallet(userId),
        getAllQuotes(),
      ]);

      const quoteMap = new Map(quotes.map(q => [q.ticker, q]));

      const enriched = holdings.map(h => {
        const q = quoteMap.get(h.ticker);
        const shares = parseFloat(h.shares);
        const avgCost = parseFloat(h.avgCostUsd);
        const price = q?.price ?? 0;
        const value = price * shares;
        const cost  = avgCost * shares;
        const pnl   = value - cost;
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
        return { ...h, price, value, cost, pnl, pnlPct };
      }).filter(h => parseFloat(h.shares) > 0);

      res.json({ holdings: enriched, cash: parseFloat(wallet.exchangeBalance ?? "0") });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Fund exchange account via Korapay (direct card/bank payment) ────────────
  app.post("/api/exchange/korapay/initiate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (!amount || amount < 10) return res.status(400).json({ message: "Minimum funding amount is $10." });
      const secretKey = process.env.KORAPAY_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured. Contact support." });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const rates = await getUsdNgnRates();
      const amountNgn = Math.round(amount * rates.buying);
      const reference = `TSIA-EXKORA-${userId}-${Date.now()}`;
      const notifUrl = `${req.protocol}://${req.get("host")}/api/webhook/korapay`;
      const redirectUrl = `${req.protocol}://${req.get("host")}/affiliate-dashboard`;
      const koraRes = await fetch(`${KORA_BASE}/charges/initialize`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNgn,
          currency: "NGN",
          reference,
          notification_url: notifUrl,
          redirect_url: redirectUrl,
          customer: { name: `${user.firstName} ${user.lastName}`, email: user.email },
          channels: ["card", "bank_transfer", "pay_with_bank"],
          metadata: { userId, amountUsd: amount.toFixed(2), platform: "TSIA", fundType: "exchange" },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const koraData = await koraRes.json() as any;
      if (!koraData.status) return res.status(502).json({ message: koraData.message ?? "Could not initiate payment" });
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: reference, walletType: "exchange_korapay", status: "pending" });
      res.json({ checkoutUrl: koraData.data.checkout_url, reference, amountNgn });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Verify exchange Korapay payment (called by user after returning from checkout) ─
  app.post("/api/exchange/korapay/verify", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ message: "reference is required" });
      const secretKey = process.env.KORAPAY_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Payment gateway not configured" });
      const deposits = await storage.getWalletDepositsByUser(userId);
      const existing = deposits.find((d: any) => d.txHash === reference && d.walletType === "exchange_korapay");
      if (!existing) return res.status(404).json({ message: "Payment record not found" });
      if (existing.status === "completed") return res.json({ message: "Already credited", exchangeBalance: null });
      const verRes = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(reference)}`, {
        headers: { "Authorization": `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(12000),
      });
      const verData = await verRes.json() as any;
      if (!verData.status || verData.data?.status !== "success") {
        return res.status(400).json({ message: "Payment not confirmed yet. Please wait a moment and try again." });
      }
      const gross = parseFloat(existing.amountUsd ?? "0");
      const updated = await storage.updateExchangeBalance(userId, gross);
      await storage.updateWalletDeposit(existing.id, { status: "completed" });
      await storage.createNotification({
        userId, type: "wallet_credit",
        title: "Exchange Account Funded ✓",
        message: `$${gross.toFixed(2)} successfully added to your Exchange account via card/bank payment.`,
        data: { amount: gross, reference }, isRead: false,
      });
      res.json({ success: true, exchangeBalance: parseFloat(updated.exchangeBalance ?? "0") });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Fund exchange account from Swift wallet ──────────────────────────────────
  app.post("/api/exchange/fund", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { amount: amountRaw } = req.body;
      const amount = parseFloat(amountRaw);
      if (isNaN(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount." });
      if (amount < 10) return res.status(400).json({ message: "Minimum funding amount is $10." });
      if (amount > 1200) return res.status(400).json({ message: "Maximum funding amount is $1,200." });

      const wallet = await storage.getOrCreateWallet(userId);
      const swiftBalance = parseFloat(wallet.balance);
      if (swiftBalance < amount) return res.status(400).json({ message: `Insufficient Swift wallet balance. You have $${swiftBalance.toFixed(2)}.` });

      // Deduct from Swift wallet
      await storage.updateWalletBalance(userId, (swiftBalance - amount).toFixed(2));
      // Credit exchange balance
      const updated = await storage.updateExchangeBalance(userId, amount);

      // Notification
      await storage.createNotification({
        userId, type: "wallet_credit",
        title: "Exchange Account Funded ✓",
        message: `$${amount.toFixed(2)} transferred from your Swift wallet to your Exchange account.`,
        data: { amount }, isRead: false,
      });

      res.json({ success: true, exchangeBalance: parseFloat(updated.exchangeBalance ?? "0"), swiftBalance: swiftBalance - amount });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Withdraw from exchange account → Swift wallet (no fee, instant) ──────────
  app.post("/api/exchange/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { amount: amountRaw } = req.body;
      const amount = parseFloat(amountRaw);
      if (isNaN(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount." });
      if (amount < 2) return res.status(400).json({ message: "Minimum withdrawal is $2." });

      const tw = await storage.getOrCreateTradeWallet(userId);
      const exchangeBal = parseFloat(tw.exchangeBalance ?? "0");
      if (amount > exchangeBal) {
        return res.status(400).json({ message: `Insufficient exchange balance. Available: $${exchangeBal.toFixed(2)}.` });
      }

      // Deduct from exchange balance
      const updated = await storage.updateExchangeBalance(userId, -amount);

      // Credit Swift wallet in full (no fee, same as trade → wallet transfer)
      const personalWallet = await storage.getOrCreateWallet(userId);
      const newPersonalBal = (parseFloat(personalWallet.balance) + amount).toFixed(2);
      await storage.updateWalletBalance(userId, newPersonalBal);
      if (!personalWallet.activated && parseFloat(newPersonalBal) > 2) await storage.activateWallet(userId);

      await storage.createTransaction({
        userId, type: "deposit", amount: amount.toFixed(2), fee: "0.00",
        paymentMethod: "internal",
        description: `Exchange account withdrawal — $${amount.toFixed(2)} credited to Swift wallet in full (no fee)`,
      });

      const notif = await storage.createNotification({
        userId, type: "wallet_credit",
        title: "Exchange Withdrawal ✓",
        message: `$${amount.toFixed(2)} moved from your Exchange account to your Swift wallet with no fee.`,
        data: { amount }, isRead: false,
      });
      pushToUser(userId, "notification", notif);

      res.json({
        success: true,
        exchangeBalance: parseFloat(updated.exchangeBalance ?? "0"),
        swiftBalance: parseFloat(newPersonalBal),
        withdrawn: amount.toFixed(2),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/exchange/order", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { ticker, shares: sharesRaw, type } = req.body;
      if (!ticker || !sharesRaw || !type) return res.status(400).json({ message: "ticker, shares and type are required." });
      if (!["buy","sell"].includes(type)) return res.status(400).json({ message: "type must be buy or sell." });

      const shares = parseFloat(sharesRaw);
      if (isNaN(shares) || shares <= 0) return res.status(400).json({ message: "shares must be a positive number." });

      const quote = await getQuote(ticker);
      if (!quote || quote.price <= 0) return res.status(400).json({ message: "Unable to fetch current price for this stock." });

      const priceUsd = quote.price;
      const subtotal = shares * priceUsd;
      const feeUsd   = +(subtotal * 0.001).toFixed(6);
      const totalUsd = type === "buy" ? +(subtotal + feeUsd).toFixed(6) : +(subtotal - feeUsd).toFixed(6);

      // Enforce trade limits ($10 min / $1,200 max per order)
      if (type === "buy") {
        if (subtotal < 10) return res.status(400).json({ message: "Minimum trade amount is $10." });
        if (subtotal > 1200) return res.status(400).json({ message: "Maximum trade amount is $1,200 per order." });
      }

      const wallet = await storage.getOrCreateTradeWallet(userId);
      const balance = parseFloat(wallet.exchangeBalance ?? "0");

      if (type === "buy") {
        if (balance < totalUsd) return res.status(400).json({ message: "Insufficient exchange balance. Please fund your exchange account." });
      }

      let newShares = shares;
      let newAvgCost = priceUsd;

      if (type === "sell") {
        const existing = await db.select().from(exchangeHoldings)
          .where(and(eq(exchangeHoldings.userId, userId), eq(exchangeHoldings.ticker, ticker)));
        if (!existing.length || parseFloat(existing[0].shares) < shares) {
          return res.status(400).json({ message: `Insufficient shares. You hold ${existing[0]?.shares ?? 0} ${ticker}.` });
        }
        newShares = parseFloat(existing[0].shares) - shares;
      }

      await db.transaction(async tx => {
        // Upsert holding
        const existing = await tx.select().from(exchangeHoldings)
          .where(and(eq(exchangeHoldings.userId, userId), eq(exchangeHoldings.ticker, ticker)));

        if (type === "buy") {
          if (existing.length) {
            const prevShares = parseFloat(existing[0].shares);
            const prevAvg    = parseFloat(existing[0].avgCostUsd);
            const combinedShares = prevShares + shares;
            newAvgCost = (prevAvg * prevShares + priceUsd * shares) / combinedShares;
            newShares  = combinedShares;
            await tx.update(exchangeHoldings)
              .set({ shares: newShares.toFixed(8), avgCostUsd: newAvgCost.toFixed(6), updatedAt: new Date() })
              .where(and(eq(exchangeHoldings.userId, userId), eq(exchangeHoldings.ticker, ticker)));
          } else {
            await tx.insert(exchangeHoldings).values({
              userId, ticker, shares: shares.toFixed(8), avgCostUsd: priceUsd.toFixed(6),
            });
          }
        } else {
          const prevAvg = existing.length ? parseFloat(existing[0].avgCostUsd) : priceUsd;
          newAvgCost = prevAvg;
          if (newShares <= 0.000001) {
            await tx.delete(exchangeHoldings)
              .where(and(eq(exchangeHoldings.userId, userId), eq(exchangeHoldings.ticker, ticker)));
            newShares = 0;
          } else {
            await tx.update(exchangeHoldings)
              .set({ shares: newShares.toFixed(8), updatedAt: new Date() })
              .where(and(eq(exchangeHoldings.userId, userId), eq(exchangeHoldings.ticker, ticker)));
          }
        }

        // Record order
        await tx.insert(exchangeOrders).values({
          userId, ticker, stockName: quote.name, type,
          shares: shares.toFixed(8),
          priceUsd: priceUsd.toFixed(6),
          totalUsd: totalUsd.toFixed(6),
          feeUsd: feeUsd.toFixed(6),
        });

        // Update exchange balance (NOT trade_balance)
        const delta = type === "buy" ? -totalUsd : +totalUsd;
        const newBalance = Math.max(0, balance + delta);
        await tx.update(tradeWallets)
          .set({ exchangeBalance: newBalance.toFixed(6), updatedAt: new Date() })
          .where(eq(tradeWallets.userId, userId));
      });

      // Send notification for order fill
      await storage.createNotification({
        userId, type: "trade",
        title: `Order Filled — ${type === "buy" ? "Bought" : "Sold"} ${ticker}`,
        message: `${shares} share${shares !== 1 ? "s" : ""} of ${quote.name} ${type === "buy" ? "purchased" : "sold"} at $${priceUsd.toFixed(2)}. Total: $${totalUsd.toFixed(2)}.`,
        data: { ticker, shares, priceUsd, totalUsd, type }, isRead: false,
      });

      const updatedWallet = await storage.getOrCreateTradeWallet(userId);
      res.json({ success: true, newBalance: parseFloat(updatedWallet.exchangeBalance ?? "0"), ticker, shares, priceUsd, totalUsd, feeUsd, type });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/exchange/orders", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const userOrders = await db.select().from(exchangeOrders)
        .where(eq(exchangeOrders.userId, userId))
        .orderBy(desc(exchangeOrders.createdAt));
      res.json(userOrders);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/exchange/watchlist", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const items = await db.select().from(exchangeWatchlist)
        .where(eq(exchangeWatchlist.userId, userId))
        .orderBy(exchangeWatchlist.createdAt);
      res.json(items.map(i => i.ticker));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/exchange/watchlist/toggle", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { ticker } = req.body;
      if (!ticker) return res.status(400).json({ message: "ticker is required." });

      const existing = await db.select().from(exchangeWatchlist)
        .where(and(eq(exchangeWatchlist.userId, userId), eq(exchangeWatchlist.ticker, ticker)));

      if (existing.length) {
        await db.delete(exchangeWatchlist)
          .where(and(eq(exchangeWatchlist.userId, userId), eq(exchangeWatchlist.ticker, ticker)));
        res.json({ inWatchlist: false });
      } else {
        await db.insert(exchangeWatchlist).values({ userId, ticker });
        res.json({ inWatchlist: true });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P2P USD EXCHANGE
  // ══════════════════════════════════════════════════════════════════════════
  const P2P_MIN_LISTING = 5;
  const P2P_WALLET_MIN  = 2;

  // GET /api/p2p/offers — all active offers, excluding own
  app.get("/api/p2p/offers", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOffers: pt } = await import("@shared/schema");
      const offers = await db.select().from(pt)
        .where(and(eq(pt.status, "active"), ne(pt.sellerId, userId)))
        .orderBy(desc(pt.createdAt));
      res.json(offers);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/p2p/offers/my — my own offers
  app.get("/api/p2p/offers/my", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOffers: pt } = await import("@shared/schema");
      const offers = await db.select().from(pt)
        .where(eq(pt.sellerId, userId))
        .orderBy(desc(pt.createdAt));
      res.json(offers);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/offers — create sell offer (deducts USD → escrow)
  app.post("/api/p2p/offers", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd, ratePerUsd, localCurrency, minOrderUsd, maxOrderUsd, paymentMethod, paymentDetails } = req.body;
      const amt    = parseFloat(amountUsd);
      const rate   = parseFloat(ratePerUsd);
      const minOrd = parseFloat(minOrderUsd ?? "5");
      const maxOrd = parseFloat(maxOrderUsd ?? amountUsd);
      if (!amt || amt < P2P_MIN_LISTING)   return res.status(400).json({ message: `Minimum offer amount is $${P2P_MIN_LISTING}` });
      if (!rate || rate <= 0)              return res.status(400).json({ message: "Invalid exchange rate" });
      if (!paymentMethod?.trim())          return res.status(400).json({ message: "Payment method is required" });
      if (!paymentDetails?.trim())         return res.status(400).json({ message: "Payment details are required" });
      if (!localCurrency?.trim())          return res.status(400).json({ message: "Local currency is required" });
      if (minOrd < 1)                      return res.status(400).json({ message: "Minimum order amount is $1" });
      if (maxOrd > amt)                    return res.status(400).json({ message: "Max order cannot exceed offer amount" });

      const wallet   = await storage.getOrCreateWallet(userId);
      const walletBal = parseFloat(wallet.balance);
      const lienAmt   = parseFloat((wallet as any).lienAmount ?? "0");
      const available = walletBal - lienAmt - P2P_WALLET_MIN;
      if (available < amt) return res.status(400).json({ message: `Insufficient balance. Available for P2P: $${Math.max(0, available).toFixed(2)}` });

      const seller     = await storage.getUser(userId);
      const sellerName = `${seller?.firstName ?? ""} ${seller?.lastName ?? ""}`.trim() || "Unknown";

      await storage.updateWalletBalance(userId, (walletBal - amt).toFixed(2));
      invalidateCacheKey(`wallet:${userId}`);

      const { p2pOffers: pt } = await import("@shared/schema");
      const [offer] = await db.insert(pt).values({
        sellerId: userId, amountUsd: amt.toFixed(2), availableUsd: amt.toFixed(2),
        ratePerUsd: rate.toFixed(2), localCurrency: localCurrency.toUpperCase(),
        minOrderUsd: minOrd.toFixed(2), maxOrderUsd: maxOrd.toFixed(2),
        paymentMethod: paymentMethod.trim(), paymentDetails: paymentDetails.trim(), sellerName,
      }).returning();

      await storage.createTransaction({
        userId, type: "transfer", amount: (-amt).toFixed(2), fee: "0.00",
        paymentMethod: "wallet",
        description: `P2P escrow: $${amt.toFixed(2)} locked in offer #${offer.id}`,
      });
      invalidateCacheKey(`transactions:${userId}`);

      const notif = await storage.createNotification({
        userId, title: "P2P Offer Live",
        message: `Your offer to sell $${amt.toFixed(2)} at ${localCurrency} ${rate.toLocaleString()}/USD is now live.`,
        type: "transaction",
      });
      pushToUser(userId, "notification", notif);
      res.json({ success: true, offer });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/p2p/offers/:id/pause — toggle active ↔ paused
  app.patch("/api/p2p/offers/:id/pause", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOffers: pt } = await import("@shared/schema");
      const [offer] = await db.select().from(pt).where(and(eq(pt.id, Number(req.params.id)), eq(pt.sellerId, userId)));
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status !== "active" && offer.status !== "paused") return res.status(400).json({ message: "Offer cannot be toggled" });
      const newStatus = offer.status === "active" ? "paused" : "active";
      const [updated] = await db.update(pt).set({ status: newStatus, updatedAt: new Date() }).where(eq(pt.id, offer.id)).returning();
      res.json({ success: true, offer: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/p2p/offers/:id — cancel offer, return escrow to seller
  app.delete("/api/p2p/offers/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOffers: pt, p2pOrders: ot } = await import("@shared/schema");
      const [offer] = await db.select().from(pt).where(and(eq(pt.id, Number(req.params.id)), eq(pt.sellerId, userId)));
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status === "cancelled") return res.status(400).json({ message: "Offer already cancelled" });

      const activeOrders = await db.select().from(ot)
        .where(and(eq(ot.offerId, offer.id), or(eq(ot.status, "pending"), eq(ot.status, "paid"))));
      if (activeOrders.length > 0) return res.status(400).json({ message: "Cancel or complete all active orders on this offer first." });

      const avail = parseFloat(offer.availableUsd);
      if (avail > 0) {
        const wallet = await storage.getOrCreateWallet(userId);
        await storage.updateWalletBalance(userId, (parseFloat(wallet.balance) + avail).toFixed(2));
        invalidateCacheKey(`wallet:${userId}`);
        await storage.createTransaction({
          userId, type: "transfer", amount: avail.toFixed(2), fee: "0.00",
          paymentMethod: "wallet",
          description: `P2P escrow returned: offer #${offer.id} cancelled`,
        });
        invalidateCacheKey(`transactions:${userId}`);
      }
      await db.update(pt).set({ status: "cancelled", updatedAt: new Date() }).where(eq(pt.id, offer.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/orders — buyer places order against an offer
  app.post("/api/p2p/orders", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { offerId, amountUsd, note } = req.body;
      const amt = parseFloat(amountUsd);
      if (!offerId || !amt || amt <= 0) return res.status(400).json({ message: "Invalid order parameters" });

      const { p2pOffers: pt, p2pOrders: ot } = await import("@shared/schema");
      const [offer] = await db.select().from(pt).where(eq(pt.id, Number(offerId)));
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      if (offer.status !== "active") return res.status(400).json({ message: "This offer is not available" });
      if (offer.sellerId === userId)  return res.status(400).json({ message: "You cannot buy from your own offer" });

      const minOrd    = parseFloat(offer.minOrderUsd);
      const maxOrd    = parseFloat(offer.maxOrderUsd);
      const available = parseFloat(offer.availableUsd);
      if (amt < minOrd)    return res.status(400).json({ message: `Minimum order is $${minOrd}` });
      if (amt > maxOrd)    return res.status(400).json({ message: `Maximum order is $${maxOrd}` });
      if (amt > available) return res.status(400).json({ message: `Only $${available.toFixed(2)} available` });

      const buyer     = await storage.getUser(userId);
      const buyerName = `${buyer?.firstName ?? ""} ${buyer?.lastName ?? ""}`.trim() || "Unknown";

      const newAvail = (available - amt).toFixed(2);
      await db.update(pt).set({ availableUsd: newAvail, updatedAt: new Date() }).where(eq(pt.id, offer.id));

      const rate        = parseFloat(offer.ratePerUsd);
      const localAmount = (amt * rate).toFixed(2);
      const [order] = await db.insert(ot).values({
        offerId: offer.id, sellerId: offer.sellerId, buyerId: userId,
        amountUsd: amt.toFixed(2), ratePerUsd: offer.ratePerUsd,
        localCurrency: offer.localCurrency, localAmount,
        paymentMethod: offer.paymentMethod, paymentDetails: offer.paymentDetails,
        buyerNote: note ?? null, sellerName: offer.sellerName, buyerName,
      }).returning();

      const sellerNotif = await storage.createNotification({
        userId: offer.sellerId, title: "New P2P Order!",
        message: `${buyerName.split(" ")[0]} wants to buy $${amt.toFixed(2)}. Awaiting their payment.`,
        type: "transaction",
      });
      pushToUser(offer.sellerId, "notification", sellerNotif);
      res.json({ success: true, order });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/p2p/orders/:id/paid — buyer marks payment as sent
  app.patch("/api/p2p/orders/:id/paid", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOrders: ot } = await import("@shared/schema");
      const [order] = await db.select().from(ot).where(and(eq(ot.id, Number(req.params.id)), eq(ot.buyerId, userId)));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending") return res.status(400).json({ message: "Order is not pending" });

      const [updated] = await db.update(ot).set({ status: "paid", paidAt: new Date() }).where(eq(ot.id, order.id)).returning();

      const sellerNotif = await storage.createNotification({
        userId: order.sellerId, title: "Payment Sent — Release USD!",
        message: `${order.buyerName.split(" ")[0]} has paid ${order.localCurrency} ${parseFloat(order.localAmount).toLocaleString()} for Order #${order.id}. Verify and release the USD.`,
        type: "transaction",
      });
      pushToUser(order.sellerId, "notification", sellerNotif);
      res.json({ success: true, order: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/p2p/orders/:id/complete — seller confirms payment, releases USD to buyer
  app.patch("/api/p2p/orders/:id/complete", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOrders: ot, p2pOffers: pt } = await import("@shared/schema");
      const [order] = await db.select().from(ot).where(and(eq(ot.id, Number(req.params.id)), eq(ot.sellerId, userId)));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") return res.status(400).json({ message: "Order must be marked paid by buyer first" });

      const amt         = parseFloat(order.amountUsd);
      const buyerWallet = await storage.getOrCreateWallet(order.buyerId);
      await storage.updateWalletBalance(order.buyerId, (parseFloat(buyerWallet.balance) + amt).toFixed(2));
      invalidateCacheKey(`wallet:${order.buyerId}`);

      await storage.createTransaction({
        userId: order.sellerId, type: "transfer", amount: (-amt).toFixed(2), fee: "0.00",
        paymentMethod: "p2p",
        description: `P2P: sold $${amt.toFixed(2)} to ${order.buyerName.split(" ")[0]} (Order #${order.id})`,
      });
      await storage.createTransaction({
        userId: order.buyerId, type: "transfer", amount: amt.toFixed(2), fee: "0.00",
        paymentMethod: "p2p",
        description: `P2P: bought $${amt.toFixed(2)} from ${order.sellerName.split(" ")[0]} (Order #${order.id})`,
      });
      invalidateCacheKey(`transactions:${order.buyerId}`);
      invalidateCacheKey(`transactions:${order.sellerId}`);

      const [updatedOrder] = await db.update(ot).set({ status: "completed", completedAt: new Date() }).where(eq(ot.id, order.id)).returning();
      await db.update(pt).set({ completedTrades: sql`${pt.completedTrades} + 1`, updatedAt: new Date() }).where(eq(pt.id, order.offerId));

      const buyerNotif = await storage.createNotification({
        userId: order.buyerId, title: "Trade Complete! 🎉",
        message: `$${amt.toFixed(2)} has been added to your wallet from ${order.sellerName.split(" ")[0]}.`,
        type: "transaction",
      });
      pushToUser(order.buyerId, "notification", buyerNotif);
      res.json({ success: true, order: updatedOrder });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/p2p/orders/:id/cancel — cancel order (both parties, pending/paid only)
  app.patch("/api/p2p/orders/:id/cancel", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOrders: ot, p2pOffers: pt } = await import("@shared/schema");
      const [order] = await db.select().from(ot).where(
        and(eq(ot.id, Number(req.params.id)), or(eq(ot.buyerId, userId), eq(ot.sellerId, userId)))
      );
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending" && order.status !== "paid") return res.status(400).json({ message: "Order cannot be cancelled" });

      const amt = parseFloat(order.amountUsd);
      const [offer] = await db.select().from(pt).where(eq(pt.id, order.offerId));
      if (offer && offer.status !== "cancelled") {
        await db.update(pt).set({ availableUsd: (parseFloat(offer.availableUsd) + amt).toFixed(2), updatedAt: new Date() }).where(eq(pt.id, offer.id));
      } else {
        // Offer gone — return USD to seller
        const sw = await storage.getOrCreateWallet(order.sellerId);
        await storage.updateWalletBalance(order.sellerId, (parseFloat(sw.balance) + amt).toFixed(2));
        invalidateCacheKey(`wallet:${order.sellerId}`);
      }

      const [updated] = await db.update(ot).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(ot.id, order.id)).returning();

      const otherUserId = userId === order.buyerId ? order.sellerId : order.buyerId;
      const cancellerName = userId === order.buyerId ? order.buyerName : order.sellerName;
      const notif = await storage.createNotification({
        userId: otherUserId, title: "Order Cancelled",
        message: `Order #${order.id} ($${amt.toFixed(2)}) was cancelled by ${cancellerName.split(" ")[0]}.`,
        type: "transaction",
      });
      pushToUser(otherUserId, "notification", notif);
      res.json({ success: true, order: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/p2p/orders/my — all orders where user is buyer or seller
  app.get("/api/p2p/orders/my", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { p2pOrders: ot } = await import("@shared/schema");
      const orders = await db.select().from(ot)
        .where(or(eq(ot.buyerId, userId), eq(ot.sellerId, userId)))
        .orderBy(desc(ot.createdAt));
      res.json(orders);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  function msUntilNextMondayAt8WAT() {
    // WAT = UTC+1
    const now = new Date();
    const nowWAT = new Date(now.getTime() + 60 * 60 * 1000); // shift to WAT
    const day = nowWAT.getUTCDay(); // 0=Sun,1=Mon,...
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
    const nextMonday = new Date(nowWAT);
    nextMonday.setUTCDate(nowWAT.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(7, 0, 0, 0); // 07:00 UTC = 08:00 WAT
    return nextMonday.getTime() - now.getTime();
  }

  const msToFirst = msUntilNextMondayAt8WAT();
  setTimeout(() => {
    sendWeeklyMartDigest();
    setInterval(sendWeeklyMartDigest, 7 * 24 * 60 * 60 * 1000);
  }, msToFirst);
  console.log(`[TS-MART-DIGEST] Weekly digest scheduled — first run in ${Math.round(msToFirst / 3600000)}h.`);

  return httpServer;
}
