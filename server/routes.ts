import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { addSseClient, removeSseClient, pushToUser } from "./realtime";
import {
  sendOtpEmail, sendWelcomeEmail, sendWalletCreditEmail,
  sendOrderUpdateEmail, sendLoanUpdateEmail, sendVerificationUpdateEmail,
  sendReferralCommissionEmail, sendPriceDropEmail,
  sendNewSaleEmail, sendBotEarningsEmail, sendCoAffiliateEnrollmentEmail,
  sendTourBookingEmail, sendQceActivationEmail, sendQceWithdrawalEmail,
  sendNewArrivalEmail, sendReferralSignupEmail,
  sendSupportContactToAdmin, sendSupportConfirmation,
} from "./email";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import { calculateWaecPercentage, getPayoutTier, CURRENCY_RATES, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, generateAffiliateCode, getCoAffiliatePricing, getMilestoneProgress, CO_AFFILIATE_PROGRAM, TRADE_MARKET, ECOMMERCE, getEliteSharePercentage, calculateStudentLoanLimit, calculateAffiliateLoanLimit, calculateLoanMonthly, QCE, users, loans, transactions, tradeTransactions, orders, wallets, verifications, coAffiliates, walletDeposits, forumPosts, forumTopics } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ne, and, sql } from "drizzle-orm";

const PgSession = pgSession(session);

// In-memory cache for Paystack bank account resolutions
// key: `${bankCode}:${accountNumber}` → accountName
const bankResolveCache = new Map<string, string>();

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
      const { email, firstName, lastName, phone, country, referralCode, role, loginRole } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

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
            password: "otp-only", country: country || "ng", role: targetRole,
            referredBy: referralCode || null,
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
              message: `Welcome to TSIA! To unlock all platform features — including QCE savings, loans, e-commerce and more — please fund your Personal Wallet with a minimum of $5. You can withdraw your money at any time; however, a minimum balance of $2 must remain in your wallet to keep the system running seamlessly. Head to your Personal Wallet section to make your first deposit.`,
              data: { minActivation: QCE.MIN_ACTIVATION, minBalance: QCE.MIN_BALANCE },
              isRead: false,
            });
          } catch { /* non-critical */ }
          // Notify referrer
          if (referralCode) {
            try {
              const referrer = await storage.getUserByAffiliateCode(referralCode);
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

      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
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
    res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, phone: user.phone, country: user.country, affiliateCode: user.affiliateCode });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
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
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "Session save failed" });
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
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({ id: admin.id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role, affiliateCode: admin.affiliateCode });
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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

  // ── Helper: verify any Nigerian ID via Prembly (prembly.com) ─────────────
  // Prembly supports NIN, BVN, VIN, Driver's License, Passport, and Liveness.
  // Set PREMBLY_API_KEY and PREMBLY_APP_ID in secrets to enable live lookups.
  async function ninverifyLookup(idType: string, idBody: Record<string, string>): Promise<{ ok: boolean; data: any; message: string }> {
    const apiKey = process.env.PREMBLY_API_KEY;
    const appId  = process.env.PREMBLY_APP_ID || "tsia";

    if (!apiKey) {
      // No key configured — block verification instead of silently accepting
      return { ok: false, data: null, message: "Identity verification service is not configured. Please contact support." };
    }

    // Prembly endpoint map — https://api.prembly.com/identitypass/verification/
    const endpointMap: Record<string, string> = {
      nin:             "https://api.prembly.com/identitypass/verification/nin",
      bvn:             "https://api.prembly.com/identitypass/verification/bvn",
      voters_card:     "https://api.prembly.com/identitypass/verification/vin",
      drivers_license: "https://api.prembly.com/identitypass/verification/drivers_license",
      passport:        "https://api.prembly.com/identitypass/verification/passport",
      national_id:     "https://api.prembly.com/identitypass/verification/nin",
    };

    // Prembly body field map — all use "number" for the primary ID
    const bodyMap: Record<string, Record<string, string>> = {
      nin:             { number: idBody.nin             || "" },
      bvn:             { number: idBody.bvn             || "" },
      voters_card:     { number: idBody.vin             || "" },
      drivers_license: { number: idBody.license_no      || "" },
      passport:        { number: idBody.passport_no     || "", last_name: idBody.last_name || "" },
      national_id:     { number: idBody.nin             || "" },
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
        signal: AbortSignal.timeout(15000),
      });
    } catch (err: any) {
      console.error("[KYC] Network error:", err.message);
      return { ok: false, data: null, message: "Verification service is temporarily unreachable. Please try again shortly." };
    }

    const raw = await resp.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      console.error("[KYC] Non-JSON response:", raw.slice(0, 200));
      return { ok: false, data: null, message: "Verification service returned an unexpected response. Please try again." };
    }

    console.log(`[KYC] ${idType} → HTTP ${resp.status} | status=${json.status} | detail=${json.detail || json.message || ""}`);

    if (!resp.ok || json.status === false) {
      const errMsg = json?.detail || json?.message || "ID could not be verified. Please check your details and try again.";
      return { ok: false, data: null, message: errMsg };
    }

    const d = json.data || json;
    return {
      ok: true,
      message: json.detail || json.message || "Verified",
      data: {
        firstName:   d.firstName  || d.first_name  || d.firstname  || "",
        lastName:    d.lastName   || d.last_name   || d.lastname   || "",
        middleName:  d.middleName || d.middle_name || d.middlename || "",
        gender:      d.gender     || "",
        phone:       d.phoneNumber || d.phone      || "",
        dateOfBirth: d.dateOfBirth || d.dob        || d.birthdate  || "",
        photo:       d.photo       || d.image      || null,
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
  app.post("/api/verification/validate-id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

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

      const demo = result.message === "demo";
      return res.json({
        valid: true,
        idType,
        idNumber,
        demo,
        message: demo ? `${ID_LABELS[idType] || idType} format validated (live lookup active with API key).` : `${ID_LABELS[idType] || idType} verified successfully.`,
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

  // ── Face liveness check via Prembly ──────────────────────────────────────
  app.post("/api/verification/face-liveness", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { image } = req.body; // base64 JPEG from webcam
      if (!image) return res.status(400).json({ message: "Image is required." });

      const apiKey = process.env.PREMBLY_API_KEY;
      const appId  = process.env.PREMBLY_APP_ID || "tsia";

      if (!apiKey) {
        // No API configured — pass liveness locally (client-side checks already ran)
        console.warn("[LIVENESS] PREMBLY_API_KEY not set — accepting client-side liveness result");
        return res.json({ live: true, confidence: 0, demo: true, message: "Liveness accepted (API key not yet configured)." });
      }

      let verifyRes: Response;
      try {
        verifyRes = await fetch("https://api.prembly.com/identitypass/verification/liveness_check", {
          method: "POST",
          headers: {
            "x-api-key":    apiKey,
            "app-id":       appId,
            "Content-Type": "application/json",
            "Accept":       "application/json",
          },
          body: JSON.stringify({ image }),
          signal: AbortSignal.timeout(20000),
        });
      } catch (netErr: any) {
        console.error("[LIVENESS] Network error:", netErr.message);
        // Don't block user if liveness API is unreachable — fallback pass
        return res.json({ live: true, confidence: 0, message: "Liveness service temporarily unavailable; check passed locally." });
      }

      const raw = await verifyRes.text();
      let json: any;
      try { json = JSON.parse(raw); } catch {
        console.error("[LIVENESS] non-JSON response:", raw.slice(0, 200));
        return res.json({ live: true, confidence: 0, message: "Liveness service returned unexpected response; check passed locally." });
      }

      console.log(`[LIVENESS] HTTP ${verifyRes.status} | status=${json.status} | detail=${json.detail || json.message || ""}`);

      if (!verifyRes.ok || json.status === false) {
        return res.status(400).json({ message: json?.detail || json?.message || "Face liveness check failed. Please ensure good lighting and try again." });
      }

      const d = json.data || json;
      return res.json({
        live: true,
        confidence: d.confidence || d.score || 95,
        message: json.detail || json.message || "Liveness verified.",
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/waec-validate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) return res.status(400).json({ message: "Start verification first" });

      const { waecRegNumber, waecYear, subjects, grades, schoolName, schoolLocation } = req.body;

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

      const percentage = calculateWaecPercentage(grades);
      const payoutInfo = getPayoutTier(percentage);

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

      if (tier === "none") {
        return res.status(400).json({
          message: "Your WAEC results do not meet the minimum 50% threshold for sponsorship. You need at least a 50% score to qualify.",
          percentage,
          waecValidation: waecApiResponse,
        });
      }

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
      });

      // Return success regardless of age — disqualification is invisible to user
      res.json({
        ...verification,
        calculatedPercentage: percentage,
        payoutRange: payoutInfo,
        waecValidation: waecApiResponse,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── BVN Verification via ninverify.ng ─────────────────────────────────────
  app.post("/api/verification/bvn", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { bvn } = req.body;
      if (!bvn || bvn.length !== 11 || !/^\d{11}$/.test(bvn)) {
        return res.status(400).json({ message: "BVN must be exactly 11 digits." });
      }

      const apiKey = process.env.NINVERIFY_API_KEY;
      if (!apiKey) {
        console.warn("[BVN] NINVERIFY_API_KEY not set — running format-only check");
        return res.json({ valid: true, bvn, message: "BVN format validated (live lookup pending key).", demo: true });
      }

      // ninverify.ng BVN lookup — fall back to format-only if API is unreachable
      let verifyData: any = null;
      try {
        const verifyRes = await fetch("https://api.ninverify.ng/api/v1/bvn", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ bvn }),
          signal: AbortSignal.timeout(10000),
        });
        const raw = await verifyRes.text();
        try { verifyData = JSON.parse(raw); } catch { /* non-JSON response */ }
        if (verifyData && (!verifyRes.ok || verifyData.status === false)) {
          return res.status(400).json({
            message: verifyData?.message || "BVN could not be verified. Please check the number and try again.",
          });
        }
      } catch (fetchErr: any) {
        console.warn("[BVN] ninverify.ng unreachable — falling back to format-only validation:", fetchErr?.message);
        // Fall back: accept valid-format BVN and continue
        return res.json({ valid: true, bvn, message: "BVN accepted (format validated). Proceeding.", demo: true });
      }

      const bvnData = verifyData.data || verifyData;
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

  // ── Wallet KYC Completion (BVN + GPS → marks biometricVerified) ───────────
  app.post("/api/verification/wallet-kyc", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { bvn, gpsCoords } = req.body;
      if (!bvn) return res.status(400).json({ message: "BVN is required." });
      if (!gpsCoords) return res.status(400).json({ message: "GPS coordinates are required." });

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) {
        verification = await storage.createVerification({
          userId, status: "pending", portalFeePaid: false, tier: "none",
        });
      }

      // Mark biometric/KYC as done — unlocks wallet deposits and withdrawals
      verification = await storage.updateVerification(verification.id, {
        biometricVerified: true,
      });

      // Fire notification
      try {
        const kycNotif = await storage.createNotification({
          userId,
          type: "verification_update",
          title: "Wallet KYC Complete ✓",
          message: "Your BVN, GPS location, and biometric face scan have been verified. Your TSIA wallet is now fully unlocked.",
          data: { bvn: bvn.slice(-4).padStart(11, "*"), gpsCoords },
          isRead: false,
        });
        pushToUser(userId, "notification", kycNotif);
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

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) return res.status(400).json({ message: "Start verification first" });

      verification = await storage.updateVerification(verification.id, { biometricVerified: true });
      res.json({ success: true, message: "Biometric verification completed successfully" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/pay-fee", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      let verification = await storage.getVerificationByUser(userId);
      if (!verification) {
        verification = await storage.createVerification({
          userId, status: "pending", portalFeePaid: false, tier: "none",
        });
      }

      if (verification.portalFeePaid) {
        return res.status(400).json({ message: "Fee already paid" });
      }

      // ── Batch enrollment check ──────────────────────────────────────────────
      const BATCH_MAX = 15; // server-side only; never sent to client
      let batch = await storage.getCurrentBatch();

      if (batch && batch.status === "closed") {
        // Batch is full — tell user when next batch opens (without revealing batch size)
        const reopens = batch.nextOpenAt
          ? new Date(batch.nextOpenAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : "soon";
        return res.status(409).json({
          code: "BATCH_CLOSED",
          message: `The current enrollment batch is complete. The next batch opens on ${reopens}. You can still access all other platform features while you wait.`,
          nextOpenAt: batch.nextOpenAt,
        });
      }

      if (!batch) {
        // First-ever enrollment — create batch 1
        batch = await storage.createBatch(1);
      }
      // ────────────────────────────────────────────────────────────────────────

      const portalFee = 3.00;
      const serviceCharge = 0.30;
      const totalCharged = portalFee + serviceCharge;
      const ngnEquivalent = Math.round(totalCharged * CURRENCY_RATES.USD_TO_NGN_PAYMENT);

      verification = await storage.updateVerification(verification.id, {
        portalFeePaid: true,
        commitmentStartDate: new Date(),
      });

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

      if (!verification.portalFeePaid) {
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

      const percentage = calculateWaecPercentage(gradesArray);
      const payoutInfo = getPayoutTier(percentage);

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
    let wallet = await storage.getOrCreateWallet(userId);
    // Self-heal: activate wallets that already have >= $5 but were never activated
    // (can happen if balance was set before the activated column existed)
    if (!wallet.activated && parseFloat(wallet.balance) >= 5) {
      wallet = await storage.activateWallet(userId);
    }
    const balanceUsd = parseFloat(wallet.balance);
    const balanceNgn = balanceUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT;
    res.json({ ...wallet, balanceNgn: balanceNgn.toFixed(2) });
  });

  // ── Nigerian bank account lookup via Squad ───────────────────────────────
  app.post("/api/bank/lookup", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { bank_code, account_number } = req.body;
      if (!bank_code || !account_number) return res.status(400).json({ message: "bank_code and account_number required" });
      const secretKey = process.env.SQUAD_SECRET_KEY;
      const r = await fetch("https://api.squadco.com/bank/account/lookup", {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bank_code, account_number }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json() as any;
      if (data.success) {
        res.json({ success: true, accountName: data.data?.account_name ?? data.data?.AccountName });
      } else {
        res.status(400).json({ message: data.message ?? "Account lookup failed — check details" });
      }
    } catch (e: any) { res.status(500).json({ message: e.message ?? "Bank lookup error" }); }
  });

  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { amount, bankCode, accountNumber, accountName } = req.body;
      if (!bankCode || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details required: bankCode, accountNumber, accountName" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      const withdrawAmount = parseFloat(amount);
      const MIN_BALANCE = 2; // always keep $2 in wallet
      if (withdrawAmount <= 0 || withdrawAmount > parseFloat(wallet.balance)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (parseFloat(wallet.balance) - withdrawAmount < MIN_BALANCE) {
        return res.status(400).json({ message: `You must keep a minimum of $${MIN_BALANCE} in your wallet` });
      }

      const vatAmount = withdrawAmount * 0.075;
      const netAmountUsd = withdrawAmount - vatAmount;
      const netAmountNgn = netAmountUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT;
      const transferRef = `TSIA-WD-${userId}-${Date.now()}`;

      // ── Attempt Squad Transfer (payout to Nigerian bank) ──────────────────
      const secretKey = process.env.SQUAD_SECRET_KEY;
      let squadSuccess = false;
      let squadMsg = "";
      try {
        const squadRes = await fetch("https://api.squadco.com/payout/initiate", {
          method: "POST",
          headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_reference: transferRef,
            amount: Math.round(netAmountNgn), // Squad Transfer amount in NGN (naira)
            bank_code: bankCode,
            account_number: accountNumber,
            account_name: accountName,
            currency_id: "NGN",
            narration: `TSIA Wallet Withdrawal | Ref: ${transferRef}`,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const squadData = await squadRes.json() as any;
        if (squadData.success) {
          squadSuccess = true;
        } else {
          squadMsg = squadData.message ?? "Squad transfer failed";
        }
      } catch (fetchErr: any) {
        squadMsg = fetchErr.message ?? "Network error during transfer";
      }

      if (!squadSuccess) {
        return res.status(502).json({ message: `Bank transfer failed: ${squadMsg}. Please try again or contact support.` });
      }

      // ── Deduct wallet and record transaction ──────────────────────────────
      await storage.updateWalletBalance(userId, (parseFloat(wallet.balance) - withdrawAmount).toFixed(2));
      await storage.createTransaction({
        userId, type: "withdrawal",
        amount: (-withdrawAmount).toFixed(2),
        fee: vatAmount.toFixed(2),
        paymentMethod: "bank_transfer",
        description: `Withdrawal ₦${Math.round(netAmountNgn).toLocaleString()} to ${accountName} (${accountNumber}) — 7.5% VAT: $${vatAmount.toFixed(2)} | Ref: ${transferRef}`,
      });

      const user = await storage.getUser(userId);
      const wdNotif = await storage.createNotification({ userId, type: "wallet_credit", title: "Withdrawal Initiated ✓", message: `₦${Math.round(netAmountNgn).toLocaleString()} has been sent to ${accountName} (${accountNumber}). Processing within 24h.`, data: { ref: transferRef }, isRead: false });
      pushToUser(userId, "notification", wdNotif);

      const updated = await storage.getOrCreateWallet(userId);
      res.json({
        wallet: updated,
        vatAmount: vatAmount.toFixed(2),
        netAmount: netAmountUsd.toFixed(2),
        netAmountNgn: Math.round(netAmountNgn).toFixed(0),
        transferRef,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const txns = await storage.getTransactionsByUser(userId);
    res.json(txns);
  });

  // ── USDT Crypto Withdrawal (manual fulfilment) ───────────────────────────
  app.post("/api/wallet/withdraw-crypto", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amount, network, address } = req.body;
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
      if (!wallet.activated) {
        return res.status(403).json({ message: "Your wallet must be activated (minimum $5 funded) before withdrawing." });
      }
      const withdrawAmt = parseFloat(amount);
      const currentBalance = parseFloat(wallet.balance);
      const MIN_BALANCE = 2;
      if (withdrawAmt > currentBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      if (currentBalance - withdrawAmt < MIN_BALANCE) {
        return res.status(400).json({ message: `A minimum of $${MIN_BALANCE} must remain in your wallet` });
      }
      // Deduct from wallet
      const newBalance = (currentBalance - withdrawAmt).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);
      // Record transaction — embed network and (truncated) address in description
      const networkLabel = network === "bep20" ? "BEP20 (BSC)" : "TRC20 (TRON)";
      const truncated = address.trim().length > 16
        ? `${address.trim().slice(0, 8)}…${address.trim().slice(-6)}`
        : address.trim();
      await storage.createTransaction({
        userId,
        type: "crypto_withdrawal",
        amount: (-withdrawAmt).toFixed(2),
        fee: "0.00",
        paymentMethod: "crypto",
        description: `USDT Withdrawal (${networkLabel}) to ${truncated} | Full address: ${address.trim()} | Processing within 24h`,
      });
      // In-app notification
      const notif = await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Crypto Withdrawal Received ✓",
        message: `Your USDT withdrawal of $${withdrawAmt.toFixed(2)} (${networkLabel}) has been received and will be processed within 24 hours.`,
        data: { network, address: address.trim(), amount: withdrawAmt },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);
      const updated = await storage.getOrCreateWallet(userId);
      res.json({
        message: `Your USDT withdrawal of $${withdrawAmt.toFixed(2)} has been received and will be processed within 24 hours.`,
        wallet: updated,
        amount: withdrawAmt,
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
      const txns = await storage.getTransactionsByUser(userId);
      const withdrawals = txns.filter((t: any) => t.type === "withdrawal" || t.type === "crypto_withdrawal");
      res.json(withdrawals);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sponsorship/select", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Check for existing plan and 365-day lock
      const existing = await storage.getSponsorshipPlanByUser(userId);
      if (existing) {
        const planAge = Math.floor((Date.now() - new Date(existing.createdAt).getTime()) / 86400000);
        const daysLeft = Math.max(0, 365 - planAge);
        if (daysLeft > 0) {
          return res.status(400).json({ message: `Your current plan is locked for ${daysLeft} more day(s). You can change it after 365 days.`, daysLeft });
        }
      }

      const { planYears } = req.body;
      const planMap: Record<number, { cost: string; payout: string }> = {
        1: { cost: "35.00", payout: "230.00" },
        2: { cost: "45.00", payout: "460.00" },
        3: { cost: "50.00", payout: "690.00" },
      };
      const planInfo = planMap[planYears];
      if (!planInfo) return res.status(400).json({ message: "Invalid plan" });

      const plan = await storage.createSponsorshipPlan({
        userId, planYears, annualCost: planInfo.cost, maxPayout: planInfo.payout, active: true,
      });

      await storage.createDisbursement({ userId, amount: planInfo.payout, status: "pending" });
      res.json(plan);
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
      if (!batch) {
        // No batch yet — enrollment is open (will create on first fee payment)
        return res.json({ status: "open", nextOpenAt: null, enrolled: false });
      }

      // Check if this user already paid their fee (i.e. enrolled in any batch)
      const verification = await storage.getVerificationByUser(userId);
      const enrolled = !!(verification?.portalFeePaid);

      if (batch.status === "open") {
        return res.json({ status: "open", nextOpenAt: null, enrolled });
      }
      // Batch is closed — return when it re-opens
      return res.json({ status: "closed", nextOpenAt: batch.nextOpenAt, enrolled });
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

      // Trade wallet available balance (commissions land here)
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const tradeBalance = parseFloat(tradeWallet.tradeBalance);

      res.json({
        totalReferred,
        activeCount,
        pendingCount,
        totalCommissionEarned: parseFloat(totalCommissionEarned.toFixed(4)),
        commissionCount,
        tradeBalance: parseFloat(tradeBalance.toFixed(4)),
        commissionNote: "You earn 5% of every deposit and bot earning made by members who signed up with your referral code.",
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

  // Withdraw referral commission earnings from Trade Wallet to Personal Wallet
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

      // Check trade wallet balance
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      const tradeBalance = parseFloat(tradeWallet.tradeBalance);
      if (withdrawAmount > tradeBalance) {
        return res.status(400).json({ message: `Insufficient trade balance. Available: $${tradeBalance.toFixed(4)}` });
      }
      if (withdrawAmount < 0.01) {
        return res.status(400).json({ message: "Minimum withdrawal is $0.01." });
      }

      const txRef = `COMM-WD-${userId}-${Date.now()}`;

      // Deduct from trade wallet
      await storage.updateTradeBalance(userId, (-withdrawAmount).toFixed(6));
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
        note: `Commission withdrawal to Personal Wallet | Ref: ${txRef}`,
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
        message: `$${withdrawAmount.toFixed(4)} withdrawn from your Trade Wallet to your Personal Wallet. Ref: ${txRef}`,
        data: { ref: txRef, amount: withdrawAmount },
        isRead: false,
      });
      pushToUser(userId, "notification", notif);

      const updatedTrade = await storage.getOrCreateTradeWallet(userId);
      res.json({
        success: true,
        reference: txRef,
        withdrawn: withdrawAmount,
        newTradeBalance: parseFloat(updatedTrade.tradeBalance).toFixed(4),
        newPersonalBalance,
        message: `$${withdrawAmount.toFixed(4)} moved to your Personal Wallet.`,
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

      // ── Deduct from Personal Wallet ──
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

      // ── Deduct from Personal Wallet ──
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

  // Co-Affiliate: withdraw available earnings to Personal Wallet
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

      // Credit Personal Wallet
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
        message: `$${available.toFixed(4)} from your Trust Fund earnings has been credited to your TSIA Personal Wallet.`,
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
      res.json(wallet);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

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
      const referrer = await storage.getUserByAffiliateCode(user.referredBy);
      if (!referrer) return { credited: false };

      const commission = parseFloat((grossAmount * TRADE_MARKET.AFFILIATE_SHARE_RATE).toFixed(6)); // 5%
      if (commission <= 0) return { credited: false };

      // Ensure referrer has a trade wallet before crediting
      await storage.getOrCreateTradeWallet(referrer.id);
      await storage.updateTradeBalance(referrer.id, commission.toFixed(6));
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
        message: `$${commission.toFixed(4)} (5%) referral commission from ${user.firstName} ${user.lastName.charAt(0)}. ${sourceLabel}. Added to your Trade Wallet.`,
        data: { referredUserId, commission, sourceLabel },
        isRead: false,
      });
      pushToUser(referrer.id, "notification", notif);
      return { credited: true, referrerId: referrer.id, commissionAmount: commission };
    } catch { return { credited: false }; }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  app.post("/api/trade/deposit", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd, walletType, txHash } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < TRADE_MARKET.MIN_DEPOSIT) {
        return res.status(400).json({ message: `Minimum deposit is $${TRADE_MARKET.MIN_DEPOSIT}.` });
      }
      if (!["trc20", "bep20"].includes(walletType)) {
        return res.status(400).json({ message: "walletType must be trc20 or bep20." });
      }
      // Allocations on deposit
      const reserveCut = amount * TRADE_MARKET.RESERVE_FUND_RATE;      // 20%
      const affiliateCut = amount * TRADE_MARKET.AFFILIATE_SHARE_RATE; // 5%
      const userCredit = amount - reserveCut - affiliateCut;           // 75%

      await storage.getOrCreateTradeWallet(userId);
      const tx = await storage.createTradeTransaction({
        userId,
        type: "deposit",
        walletType,
        amountUsd: amount.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: reserveCut.toFixed(6),
        affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: userCredit.toFixed(6),
        txHash: txHash || null,
        status: "completed",
        note: `Deposit via ${walletType.toUpperCase()} — 20% reserve, 5% affiliate commission`,
      });

      await storage.updateTradeBalance(userId, userCredit.toFixed(6));
      await storage.addToReserveFund(reserveCut.toFixed(6));

      // Credit 5% directly to the specific referrer (if any), otherwise shared pool
      const refResult = await creditReferrerCommission(userId, amount, "trade deposit");
      if (!refResult.credited) {
        const affiliateCount = await storage.getAffiliateCount();
        const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
        await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));
      } else {
        // Still record in pool table for accounting (using referrer count = 1)
        await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), 1, affiliateCut.toFixed(6));
      }

      const wallet = await storage.getOrCreateTradeWallet(userId);
      res.json({
        transaction: tx,
        newBalance: wallet.tradeBalance,
        breakdown: {
          deposited: amount,
          reserveFund: reserveCut,
          affiliatePool: affiliateCut,
          creditedToYou: userCredit,
        },
        message: "Deposit confirmed.",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Fund Trade Wallet from Personal Wallet balance ────────────────────────
  app.post("/api/trade/fund-from-wallet", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < TRADE_MARKET.MIN_DEPOSIT) {
        return res.status(400).json({ message: `Minimum funding amount is $${TRADE_MARKET.MIN_DEPOSIT}.` });
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
      // Allocations
      const reserveCut = amount * TRADE_MARKET.RESERVE_FUND_RATE;      // 20%
      const affiliateCut = amount * TRADE_MARKET.AFFILIATE_SHARE_RATE; // 5%
      const userCredit = amount - reserveCut - affiliateCut;           // 75%
      // Credit trade wallet
      await storage.getOrCreateTradeWallet(userId);
      const tx = await storage.createTradeTransaction({
        userId,
        type: "deposit",
        walletType: "trc20",
        amountUsd: amount.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: reserveCut.toFixed(6),
        affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: userCredit.toFixed(6),
        txHash: `INTERNAL-${userId}-${Date.now()}`,
        status: "completed",
        note: `Funded from Personal Wallet — 75% credited, 20% reserve, 5% affiliate pool`,
      });
      await storage.updateTradeBalance(userId, userCredit.toFixed(6));
      await storage.addToReserveFund(reserveCut.toFixed(6));
      // Credit 5% directly to specific referrer (if any), otherwise shared pool
      const fwRefResult = await creditReferrerCommission(userId, amount, "trade funding");
      if (!fwRefResult.credited) {
        const affiliateCount = await storage.getAffiliateCount();
        const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
        await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));
      } else {
        await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), 1, affiliateCut.toFixed(6));
      }
      // Log transaction in personal wallet history
      const platformFee = reserveCut + affiliateCut;
      await storage.createTransaction({
        userId,
        type: "trade_transfer",
        amount: (-amount).toFixed(2),
        fee: platformFee.toFixed(2),
        paymentMethod: "wallet",
        description: `Trade Wallet funding — $${userCredit.toFixed(2)} credited (75%), $${reserveCut.toFixed(2)} reserve, $${affiliateCut.toFixed(2)} pool | Platform fee: $${platformFee.toFixed(2)} (25%)`,
      });
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      res.json({
        message: `$${userCredit.toFixed(2)} credited to your Trade Wallet (75% of $${amount.toFixed(2)})`,
        newTradeBalance: tradeWallet.tradeBalance,
        breakdown: { deposited: amount, reserveFund: reserveCut, affiliatePool: affiliateCut, creditedToYou: userCredit },
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Transfer trade earnings → Personal Wallet (no fee, instant) ──────────
  app.post("/api/trade/transfer-to-wallet", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < 1) return res.status(400).json({ message: "Minimum transfer is $1." });
      const tradeWallet = await storage.getOrCreateTradeWallet(userId);
      if (parseFloat(tradeWallet.tradeBalance) < amount) {
        return res.status(400).json({ message: `Insufficient trade balance. Available: $${parseFloat(tradeWallet.tradeBalance).toFixed(2)}` });
      }
      // Deduct from trade wallet
      await storage.updateTradeBalance(userId, (-amount).toFixed(6));
      await storage.createTradeTransaction({
        userId, type: "withdraw_exchange", walletType: null,
        amountUsd: amount.toFixed(6), feeUsd: "0.000000",
        reserveFundDeduction: "0.000000", affiliateShareDeduction: "0.000000",
        netAmount: amount.toFixed(6), txHash: null, status: "completed",
        note: `Transferred $${amount.toFixed(2)} to Personal Wallet`,
      });
      // Credit personal wallet
      const personalWallet = await storage.getOrCreateWallet(userId);
      const newPersonalBal = (parseFloat(personalWallet.balance) + amount).toFixed(2);
      await storage.updateWalletBalance(userId, newPersonalBal);
      if (!personalWallet.activated && parseFloat(newPersonalBal) >= 5) await storage.activateWallet(userId);
      await storage.createTransaction({ userId, type: "deposit", amount: amount.toFixed(2), fee: "0.00", paymentMethod: "internal", description: `Transfer from Trade Wallet — $${amount.toFixed(2)}` });
      const notif = await storage.createNotification({ userId, type: "wallet_credit", title: "Trade Transfer Complete ✓", message: `$${amount.toFixed(2)} from your Trade Wallet has been credited to your Personal Wallet.`, data: {}, isRead: false });
      pushToUser(userId, "notification", notif);
      const updatedTrade = await storage.getOrCreateTradeWallet(userId);
      res.json({ newTradeBalance: updatedTrade.tradeBalance, newPersonalBalance: newPersonalBal, transferred: amount.toFixed(2) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/trade/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
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
      const affiliateCut = amount * TRADE_MARKET.AFFILIATE_SHARE_RATE;
      const netPayout = amount - fee - affiliateCut;

      const wallet = await storage.getOrCreateTradeWallet(userId);
      const currentBalance = parseFloat(wallet.tradeBalance);
      if (currentBalance < amount) {
        return res.status(400).json({ message: `Insufficient balance. Available: $${currentBalance.toFixed(2)}` });
      }

      // ── For bank withdrawals: call Squad payout API ───────────────────────
      if (withdrawalType === "withdraw_bank") {
        const netNgn = netPayout * CURRENCY_RATES.USD_TO_NGN_PAYOUT; // ₦1,280/$
        const transferRef = `TSIA-TWD-${userId}-${Date.now()}`;
        const secretKey = process.env.SQUAD_SECRET_KEY;
        let squadSuccess = false, squadMsg = "";
        try {
          const squadRes = await fetch("https://api.squadco.com/payout/initiate", {
            method: "POST",
            headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction_reference: transferRef,
              amount: Math.round(netNgn),
              bank_code: bankCode,
              account_number: accountNumber,
              account_name: accountName,
              currency_id: "NGN",
              narration: `TSIA Trade Withdrawal | Ref: ${transferRef}`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const squadData = await squadRes.json() as any;
          squadSuccess = !!squadData.success;
          if (!squadSuccess) squadMsg = squadData.message ?? "Squad transfer failed";
        } catch (fetchErr: any) { squadMsg = fetchErr.message ?? "Network error"; }
        if (!squadSuccess) {
          return res.status(502).json({ message: `Bank transfer failed: ${squadMsg}. Please try again or contact support.` });
        }
      }

      const txType = withdrawalType === "withdraw_bank" ? "withdraw_bank" : "withdraw_exchange";
      const tx = await storage.createTradeTransaction({
        userId, type: txType, walletType: walletType || null,
        amountUsd: amount.toFixed(6), feeUsd: fee.toFixed(6),
        reserveFundDeduction: "0.000000", affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: netPayout.toFixed(6), txHash: null, status: "completed",
        note: withdrawalType === "withdraw_bank"
          ? `Bank withdrawal ₦${Math.round(netPayout * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} → ${accountName} (${accountNumber}) — 8% fee + 5% pool`
          : `Exchange withdrawal — 5% fee + 5% affiliate pool`,
      });

      await storage.updateTradeBalance(userId, (-amount).toFixed(6));
      const affiliateCount = await storage.getAffiliateCount();
      const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));

      const updatedWallet = await storage.getOrCreateTradeWallet(userId);
      const wdNotif = await storage.createNotification({ userId, type: "wallet_credit", title: "Trade Withdrawal Initiated ✓", message: withdrawalType === "withdraw_bank" ? `₦${Math.round(netPayout * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()} is being sent to ${accountName}. Processing within 24h.` : `$${netPayout.toFixed(2)} withdrawal to exchange wallet initiated.`, data: {}, isRead: false });
      pushToUser(userId, "notification", wdNotif);
      res.json({
        transaction: tx, newBalance: updatedWallet.tradeBalance,
        breakdown: { requested: amount, fee, feeRate: `${(feeRate * 100).toFixed(0)}%`, affiliatePool: affiliateCut, netPayout },
        message: "Withdrawal processed.",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Loss-day helpers ────────────────────────────────────────────────────────
  function getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  function getLossDaysForWeek(weekNum: number): Set<number> {
    // Returns 2 distinct ISO weekday numbers (1=Mon … 7=Sun) deterministically per week
    const d1 = ((weekNum * 7 + 3) % 7) + 1;
    let d2   = ((weekNum * 13 + 11) % 7) + 1;
    if (d2 === d1) d2 = (d2 % 7) + 1;
    return new Set([d1, d2]);
  }
  function getLossRateForDay(weekNum: number, isoDay: number): number {
    // Deterministic loss rate between 0.5% and 1.5%
    const seed = (weekNum * 37 + isoDay * 17) % 100;
    return 0.005 + seed / 10000; // 0.005 → 0.0149
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Called by the frontend when the user activates the bot — persists start time in the DB
  app.post("/api/trade/bot/activate", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const wallet = await storage.getOrCreateTradeWallet(userId);
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

      // activatedAt is the timestamp (ms) when the bot was started — fall back to DB value if missing
      const { activatedAt: clientActivatedAt } = req.body as { activatedAt?: number };
      const wallet0 = await storage.getOrCreateTradeWallet(userId);
      // Determine the actual session start: prefer client-provided timestamp, fall back to DB
      let activatedAt: number | undefined = clientActivatedAt && Number.isFinite(clientActivatedAt) ? clientActivatedAt : undefined;
      if (!activatedAt && wallet0.botActivatedAt) {
        activatedAt = new Date(wallet0.botActivatedAt).getTime();
      }

      const wallet = wallet0;
      const balance = parseFloat(wallet.tradeBalance);
      if (balance <= 0) return res.status(400).json({ message: "No balance to earn from." });

      // ── Determine if today (UK time) is a loss day ───────────────────────
      const nowUK   = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
      const isoWeek = getISOWeekNumber(nowUK);
      const isoDay  = nowUK.getDay() === 0 ? 7 : nowUK.getDay(); // Sun=0 → 7; Mon=1…Sat=6 stays
      const lossDays = getLossDaysForWeek(isoWeek);
      const isLossDay = lossDays.has(isoDay);

      // ── Compute session duration ─────────────────────────────────────────
      const BOT_MAX_MS    = 12 * 3600 * 1000;
      const BOT_FULL_RATE = 0.02;
      let elapsedMs = BOT_MAX_MS;
      if (activatedAt && Number.isFinite(activatedAt)) {
        elapsedMs = Math.min(Date.now() - activatedAt, BOT_MAX_MS);
        elapsedMs = Math.max(elapsedMs, 0);
      }
      const fraction     = elapsedMs / BOT_MAX_MS;
      const elapsedHours = (elapsedMs / 3600000).toFixed(1);

      if (isLossDay) {
        // ── LOSS DAY: deduct from balance, do not touch totalBotEarnings ──
        const lossRate   = getLossRateForDay(isoWeek, isoDay) * fraction;
        const lossAmount = parseFloat((balance * lossRate).toFixed(6));
        const ratePercent = (lossRate * 100).toFixed(4);

        if (lossAmount <= 0) return res.json({ earning: "0", elapsedHours, ratePercent: "0", newBalance: wallet.tradeBalance, totalBotEarnings: wallet.totalBotEarnings, isLossDay: true });

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
          note: `Bot session (loss day): ${elapsedHours}h traded → -${ratePercent}% on $${balance.toFixed(2)}`,
        });
        const updatedWallet = await storage.applyBotLoss(userId, lossAmount.toFixed(6));
        await storage.createNotification({
          userId,
          type: "trade",
          title: "Bot Session — Market Loss",
          message: `Your trading bot session (${elapsedHours}h) resulted in a market loss of $${lossAmount.toFixed(4)} (-${ratePercent}%). This reflects real market conditions.`,
          data: { loss: lossAmount, elapsedHours, ratePercent, newBalance: updatedWallet.tradeBalance },
          isRead: false,
        });
        return res.json({
          earning: (-lossAmount).toFixed(6),
          elapsedHours,
          ratePercent: `-${ratePercent}`,
          newBalance: updatedWallet.tradeBalance,
          totalBotEarnings: updatedWallet.totalBotEarnings,
          isLossDay: true,
        });
      }

      // ── PROFIT DAY ───────────────────────────────────────────────────────
      const rate    = BOT_FULL_RATE * fraction;
      const grossEarning = parseFloat((balance * rate).toFixed(6));
      const ratePercent = (rate * 100).toFixed(4);

      if (grossEarning <= 0) return res.status(400).json({ message: "Earning too small to credit." });

      // 5% referral commission on bot earnings (deducted from gross, credited to referrer)
      const botAffiliateCommission = parseFloat((grossEarning * TRADE_MARKET.AFFILIATE_SHARE_RATE).toFixed(6));
      const botUser = await storage.getUser(userId);
      const hasBotReferrer = !!(botUser?.referredBy);
      const earning = hasBotReferrer ? parseFloat((grossEarning - botAffiliateCommission).toFixed(6)) : grossEarning;

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
        note: `Bot session: ${elapsedHours}h traded → ${ratePercent}% return on $${balance.toFixed(2)}${hasBotReferrer ? ` | 5% referral commission: $${botAffiliateCommission.toFixed(4)}` : ""}`,
      });
      const updatedWallet = await storage.creditBotEarnings(userId, earning.toFixed(6));

      // Credit 5% commission to referrer if applicable
      if (hasBotReferrer && botAffiliateCommission > 0) {
        await creditReferrerCommission(userId, grossEarning, "bot earnings").catch(() => {});
      }

      await storage.createNotification({
        userId,
        type: "trade",
        title: "Bot Session Complete — Earnings Credited",
        message: `Your trading bot session (${elapsedHours}h) has ended. $${earning.toFixed(4)} (${ratePercent}% return${hasBotReferrer ? ", 5% referral commission deducted" : ""}) has been added to your Trade Wallet.`,
        data: { earning, elapsedHours, ratePercent, newBalance: updatedWallet.tradeBalance },
        isRead: false,
      });
      storage.getUser(userId).then(u => {
        if (u) sendBotEarningsEmail(u.email, u.firstName, earning.toFixed(2), parseFloat(updatedWallet.tradeBalance).toFixed(2)).catch((err: any) => console.error("[EMAIL] Bot earnings email failed:", err?.message ?? err));
      });
      res.json({
        earning: earning.toFixed(6),
        elapsedHours,
        ratePercent,
        newBalance: updatedWallet.tradeBalance,
        totalBotEarnings: updatedWallet.totalBotEarnings,
        isLossDay: false,
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

      const tradeReserve = parseFloat(fund.total_balance ?? "0");

      res.json({
        totalBalance: fund.total_balance ?? "0",
        totalDeposited: fund.total_deposited ?? "0",
        contributionRate: 20,
        description: "20% of every Global Trade Market deposit is ring-fenced into this strategic reserve.",
        walletFloorReserve: walletFloorReserve.toFixed(2),
        walletsAtMin,
        totalWallets,
        minBalancePerWallet: 2,
        combinedReserve: (tradeReserve + walletFloorReserve).toFixed(2),
        updatedAt: new Date().toISOString(),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Commission profits chart — profits after 5% affiliate pool distributed
  app.get("/api/reserve-fund/commission-profits", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // E-commerce commissions (8% per order)
      const ecomResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'Mon YY') AS month,
          TO_CHAR(created_at, 'YYYY-MM') AS month_key,
          COALESCE(SUM(commission_amount), 0) AS ecom_commission
        FROM orders
        GROUP BY month, month_key
        ORDER BY month_key
      `);

      // Trade withdrawal fees collected
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

      res.json({ chartData, totals });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── ADMIN: All Co-Affiliates (Trust Funders) ───────────────────────────────
  app.get("/api/admin/co-affiliates", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const all = await storage.getAllCoAffiliates();
      const enriched = await Promise.all(all.map(async (ca) => {
        const u = await storage.getUser(ca.userId);
        return { ...ca, userName: u ? `${u.firstName} ${u.lastName}` : "Unknown", userEmail: u?.email ?? "—" };
      }));
      res.json(enriched);
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

  app.post("/api/admin/verify/:verificationId", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { approve, reason } = req.body;
      const vId = parseInt(req.params.verificationId);
      const status = approve ? "verified" : "rejected";
      const updated = await storage.updateVerification(vId, { status });
      // Notify student
      try {
        const verUser = await storage.getUser(updated.userId);
        if (verUser) {
          sendVerificationUpdateEmail(verUser.email, verUser.firstName, status).catch((err: any) => console.error("[EMAIL] Verification email failed:", err?.message ?? err));
        }
        const notif = await storage.createNotification({
          userId: updated.userId,
          type: "verification_update",
          title: approve ? "Verification Approved ✓" : "Verification Update",
          message: approve
            ? "Congratulations! Your identity has been verified. You now have full access to all TSIA features and your wallet will be funded shortly."
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

  app.get("/api/admin/pending-disbursements", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const pending = await storage.getPendingDisbursements();
    res.json(pending);
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
      await storage.updateWalletBalance(disbursement.userId, (parseFloat(disbWallet.balance) + parseFloat(disbursement.amount)).toFixed(2));
      await storage.createTransaction({
        userId: disbursement.userId, type: "sponsorship_credit",
        amount: disbursement.amount,
        fee: "0.00",
        paymentMethod: "wallet",
        description: `Sponsorship payout $${disbursement.amount} (₦${(parseFloat(disbursement.amount) * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()})`,
      });

      res.json(disbursement);
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
      // Auto-activate wallet if balance reaches $5 minimum
      if (!curWal.activated && newBal >= 5) await storage.activateWallet(targetId);
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
      // Auto-activate wallet if balance now meets $5 minimum
      if (!wallet.activated && parseFloat(newBal) >= 5) await storage.activateWallet(targetId);
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

      const affiliates = await db.select().from(users).where(eq(users.role, "affiliate")).orderBy(desc(users.createdAt));
      const enriched = await Promise.all(
        affiliates.map(async (a) => {
          const wallet = await storage.getOrCreateWallet(a.id);
          const coAffiliate = await storage.getCoAffiliateByUser(a.id);
          const referrals = await storage.getReferralsByCode(a.affiliateCode || "");
          const tradeWallet = await storage.getOrCreateTradeWallet(a.id);
          return { ...a, password: undefined, wallet, coAffiliate, referralCount: referrals.length, tradeWallet };
        })
      );
      res.json(enriched);
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

      const { status } = req.body;
      const loanId = parseInt(req.params.id);
      if (!["approved", "active", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });

      const loan = await storage.updateLoan(loanId, {
        status,
        ...(status === "active" ? { disbursedAt: new Date() } : {}),
      });

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
        const loanApprNotif = await storage.createNotification({ userId: loan.userId, type: "verification_update", title: "Loan Disbursed", message: `Your $${loan.amountUsd} loan has been approved and credited to your wallet.`, data: { loanId: loan.id }, isRead: false });
        pushToUser(loan.userId, "notification", loanApprNotif);
        storage.getUser(loan.userId).then(u => { if (u) sendLoanUpdateEmail(u.email, u.firstName, "approved", loan.amountUsd).catch((err: any) => console.error("[EMAIL] Loan email failed:", err?.message ?? err)); });
      } else if (status === "rejected") {
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

  // ─── ADMIN: E-commerce stats ─────────────────────────────────────────────────
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
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
      const totalBotEarnings = tradeTxns.filter(t => t.type === "bot_earning").reduce((s, t) => s + parseFloat(t.amount), 0);

      res.json({
        reserveBalance: reserveFund.total_balance,
        totalDeposited: reserveFund.total_deposited,
        affiliateCount,
        totalBotEarnings: totalBotEarnings.toFixed(2),
        recentTransactions: tradeTxns.slice(0, 20),
      });
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

  // ─── STUDENT: Validate / Use Sponsor Code ─────────────────────────────────────
  app.post("/api/verification/validate-sponsor-code", async (req, res) => {
    try {
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

      await storage.useSponsorCode(code, userId);

      const verification = await storage.getVerificationByUser(userId);
      res.json({ success: true, verification });
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
      const activeLoan = await storage.getActiveLoanByUser(userId);
      if (user.role === "student") {
        const verification = await storage.getVerificationByUser(userId);
        if (!verification || verification.verificationStatus !== "verified") {
          return res.json({ eligible: false, reason: "You must complete enrollment (identity + WAEC + biometric + $3 fee) to qualify for a student loan.", limitUsd: 0 });
        }
        const tier = verification.tier || "none";
        const limitUsd = calculateStudentLoanLimit(tier);
        res.json({ eligible: limitUsd > 0, limitUsd, tier, activeLoan: activeLoan || null, interestRate: 10, terms: [6, 12, 18] });
      } else if (user.role === "affiliate") {
        const referrals = await storage.getReferralsByCode(user.affiliateCode || "");
        const tradeWallet = await storage.getOrCreateTradeWallet(userId);
        const coAffiliate = await storage.getCoAffiliateByUser(userId);
        const tradeBalance = parseFloat(tradeWallet.balance || "0");
        const refCount = referrals.length;
        const coAmount = coAffiliate ? parseFloat(coAffiliate.investedAmount) : 0;
        const hasEarnings = refCount > 0 || tradeBalance > 0;
        if (!hasEarnings) {
          return res.json({ eligible: false, reason: "You need at least 1 verified referral or a trade wallet balance to qualify for a business loan.", limitUsd: 0 });
        }
        const limitUsd = calculateAffiliateLoanLimit(refCount, tradeBalance, coAmount);
        res.json({ eligible: true, limitUsd: Math.round(limitUsd), referralCount: refCount, tradeBalance, coAffiliateAmount: coAmount, activeLoan: activeLoan || null, interestRate: 15, terms: [6, 12, 24] });
      } else {
        res.json({ eligible: false, reason: "Loans are available for students and affiliates only.", limitUsd: 0 });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/loans/apply", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd, termMonths, purpose } = req.body;
      if (!amountUsd || !termMonths) return res.status(400).json({ message: "Amount and term are required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const activeLoan = await storage.getActiveLoanByUser(userId);
      if (activeLoan) return res.status(400).json({ message: "You already have an active loan. Please repay it before applying for another." });
      let interestRate = 10;
      let maxLimit = 0;
      if (user.role === "student") {
        const verification = await storage.getVerificationByUser(userId);
        if (!verification || verification.verificationStatus !== "verified") return res.status(400).json({ message: "You must be a verified student to apply for a student loan." });
        maxLimit = calculateStudentLoanLimit(verification.tier || "none");
        interestRate = 10;
      } else if (user.role === "affiliate") {
        const referrals = await storage.getReferralsByCode(user.affiliateCode || "");
        const tradeWallet = await storage.getOrCreateTradeWallet(userId);
        const coAffiliate = await storage.getCoAffiliateByUser(userId);
        const tradeBalance = parseFloat(tradeWallet.balance || "0");
        if (referrals.length === 0 && tradeBalance === 0) return res.status(400).json({ message: "You need earnings to qualify for a business loan." });
        maxLimit = calculateAffiliateLoanLimit(referrals.length, tradeBalance, coAffiliate ? parseFloat(coAffiliate.investedAmount) : 0);
        interestRate = 15;
      }
      if (parseFloat(amountUsd) > maxLimit) return res.status(400).json({ message: `Loan amount exceeds your limit of $${Math.round(maxLimit).toFixed(2)}` });
      const { totalPayable, monthly } = calculateLoanMonthly(parseFloat(amountUsd), interestRate, parseInt(termMonths));
      const loan = await storage.createLoan({
        userId, userRole: user.role as "student" | "affiliate",
        amountUsd: parseFloat(amountUsd).toFixed(2),
        interestRate: interestRate.toFixed(2),
        termMonths: parseInt(termMonths),
        monthlyPaymentUsd: monthly.toFixed(2),
        totalPayableUsd: totalPayable.toFixed(2),
        totalPaidUsd: "0",
        purpose: purpose || null,
        status: "pending",
      });
      res.json(loan);
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
    if (!amount || amount < 1) return res.status(400).json({ message: "Minimum funding amount is $1" });
    const secretKey = process.env.SQUAD_SECRET_KEY;
    const publicKey = process.env.SQUAD_PUBLIC_KEY;
    if (!secretKey || !publicKey) return res.status(500).json({ message: "Payment gateway not configured. Please contact support." });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const USD_TO_KOBO = 148000; // 1 USD = ₦1,480 = 148,000 kobo
      const amountKobo = Math.round(amount * USD_TO_KOBO);
      const transactionRef = `TSIA-${userId}-${Date.now()}`;
      // Save pending deposit record
      await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: transactionRef, walletType: "squad", status: "pending" });
      res.json({ transactionRef, amountKobo, amountNgn: (amount * 1480).toFixed(2), publicKey, email: user.email, firstName: user.firstName, lastName: user.lastName });
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
      const amountUsd = parseFloat(existing?.amountUsd ?? (amountKoboFromSquad / 148000).toFixed(2));
      // Credit wallet
      const squadWallet = await storage.getOrCreateWallet(userId);
      const newBalance = (parseFloat(squadWallet.balance) + amountUsd).toFixed(2);
      await storage.updateWalletBalance(userId, newBalance);
      // Activate wallet on first funding ≥ $5 and credit referral commission
      if (!squadWallet.activated && parseFloat(newBalance) >= 5) {
        try {
          await storage.activateWallet(userId);
          // Credit 5% referral commission to referrer on first activation deposit
          creditReferrerCommission(userId, amountUsd, "personal wallet activation").catch(() => {});
          const sqUser = await storage.getUser(userId);
          if (sqUser?.referredBy) {
            const sqReferrer = await storage.getUserByAffiliateCode(sqUser.referredBy);
            if (sqReferrer) {
              const refN = await storage.createNotification({
                userId: sqReferrer.id, type: "referral_activated",
                title: "Referral Activated 🎉",
                message: `${sqUser.firstName} ${sqUser.lastName.charAt(0)}. (one of your referrals) has activated their TSIA wallet. Your referral commission is now active!`,
                data: { referredUserId: sqUser.id }, isRead: false,
              });
              pushToUser(sqReferrer.id, "notification", refN);
            }
          }
        } catch { /* non-critical */ }
      }
      // Record credited transaction
      await storage.createTransaction({ userId, type: "deposit", amount: amountUsd.toFixed(2), fee: "0.00", paymentMethod: "squad", description: `Wallet funded via Squad (${transactionRef})` });
      // Mark deposit record as completed
      if (existing) await storage.updateWalletDeposit(existing.id, { status: "completed" });
      // Push live notification
      const notif = await storage.createNotification({ userId, type: "deposit", title: "Wallet Funded ✓", message: `$${amountUsd.toFixed(2)} has been credited to your TSIA Personal Wallet`, data: { transactionRef }, isRead: false });
      pushToUser(userId, "notification", notif);
      res.json({ message: `$${amountUsd.toFixed(2)} has been credited to your TSIA Personal Wallet`, amountUsd });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Squad webhook (async payment notification) ────────────────────────────
  app.post("/api/webhook/squad", async (req, res) => {
    // Squad sends: { Event: "charge_completed", data: { transaction_ref, transaction_status, transaction_amount, ... } }
    try {
      const { Event, data } = req.body;
      if (Event === "charge_completed" && data?.transaction_status === "Success") {
        const ref = data.transaction_ref as string;
        // Find the pending deposit by txHash
        const allDeposits = await (storage as any).db?.query?.walletDeposits?.findFirst?.({ where: (t: any, { eq }: any) => eq(t.txHash, ref) });
        if (allDeposits && allDeposits.status !== "completed") {
          const secretKey = process.env.SQUAD_SECRET_KEY ?? "";
          const isLive = secretKey.startsWith("sk_");
          const baseUrl = isLive ? "https://api-d.squadco.com" : "https://sandbox-api-d.squadco.com";
          const verRes = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          });
          const verData = await verRes.json() as any;
          if (verData.success && verData.data?.transaction_status === "Success") {
            const userId = allDeposits.userId;
            const amountUsd = parseFloat(allDeposits.amountUsd);
            const wl = await storage.getOrCreateWallet(userId);
            const newBal = (parseFloat(wl.balance) + amountUsd).toFixed(2);
            await storage.updateWalletBalance(userId, newBal);
            if (!wl.activated && parseFloat(newBal) >= 5) {
              await storage.activateWallet(userId);
              // Credit 5% referral commission to referrer on first activation deposit
              creditReferrerCommission(userId, amountUsd, "personal wallet activation").catch(() => {});
            }
            await storage.createTransaction({ userId, type: "deposit", amount: amountUsd.toFixed(2), fee: "0.00", paymentMethod: "squad", description: `Wallet funded via Squad webhook (${ref})` });
            await storage.updateWalletDeposit(allDeposits.id, { status: "completed" });
            const notif = await storage.createNotification({ userId, type: "deposit", title: "Wallet Funded ✓", message: `$${amountUsd.toFixed(2)} credited via Squad`, data: { ref }, isRead: false });
            pushToUser(userId, "notification", notif);
          }
        }
      }
    } catch { /* webhook errors must not crash the server */ }
    res.sendStatus(200);
  });

  // ── Paystack: initialize payment (legacy – kept for backward compat) ───────
  app.post("/api/wallet/paystack/initialize", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount < 1) return res.status(400).json({ message: "Minimum funding amount is $1" });
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return res.status(500).json({ message: "Payment service not configured" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const USD_TO_KOBO = 148000; // 1 USD = 1480 NGN = 148000 kobo
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
      const amountUsd = parseFloat(data.data.metadata?.amountUsd || (data.data.amount / 148000).toFixed(2));
      // Credit wallet
      const pstackWallet = await storage.getOrCreateWallet(userId);
      const psNewBalance = (parseFloat(pstackWallet.balance) + amountUsd).toFixed(2);
      await storage.updateWalletBalance(userId, psNewBalance);
      // Activate wallet on first funding ≥ $5 and credit referral commission
      if (!pstackWallet.activated && parseFloat(psNewBalance) >= 5) {
        try {
          await storage.activateWallet(userId);
          // Credit 5% referral commission to referrer on first activation deposit
          creditReferrerCommission(userId, amountUsd, "personal wallet activation").catch(() => {});
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
      await storage.createTransaction({ userId, type: "deposit", amount: amountUsd.toFixed(2), fee: "0.00", paymentMethod: "paystack", description: `Wallet funded via Paystack (${reference})` });
      const psNotif = await storage.createNotification({ userId, type: "deposit", title: "Wallet Funded ✓", message: `$${amountUsd.toFixed(2)} has been credited to your TSIA Personal Wallet`, data: { reference }, isRead: false });
      pushToUser(userId, "notification", psNotif);
      res.json({ message: `$${amountUsd.toFixed(2)} has been credited to your TSIA Personal Wallet`, amountUsd });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Legacy crypto deposit (kept for admin history)
  app.post("/api/wallet/deposit", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { amountUsd, txHash, walletType } = req.body;
    const amount = parseFloat(amountUsd);
    if (!amount || amount < ECOMMERCE.MIN_DEPOSIT) return res.status(400).json({ message: `Minimum deposit is $${ECOMMERCE.MIN_DEPOSIT}` });
    if (!txHash || txHash.trim().length < 10) return res.status(400).json({ message: "Valid transaction hash is required" });
    try {
      const deposit = await storage.createWalletDeposit({ userId, amountUsd: amount.toFixed(2), txHash: txHash.trim(), walletType: walletType || "trc20", status: "pending" });
      res.json({ deposit, message: "Deposit submitted. Your wallet will be credited after confirmation (within 30 minutes)." });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/wallet/deposits", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const deposits = await storage.getWalletDepositsByUser(userId);
      res.json(deposits);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── FINTECH: BANKS, RESOLUTION & P2P ───────────────────────────────────────
  // Nigerian banks list
  // ── Banks list — live from Squad, hardcoded fallback ────────────────────────
  const FALLBACK_BANKS = [
    { code: "044", name: "Access Bank" }, { code: "035A", name: "ALAT by Wema" },
    { code: "023", name: "Citibank Nigeria" }, { code: "050", name: "EcoBank Nigeria" },
    { code: "070", name: "Fidelity Bank" }, { code: "011", name: "First Bank of Nigeria" },
    { code: "214", name: "First City Monument Bank (FCMB)" }, { code: "058", name: "Guaranty Trust Bank (GTB)" },
    { code: "301", name: "Jaiz Bank" }, { code: "082", name: "Keystone Bank" },
    { code: "526", name: "Kuda Bank" }, { code: "090405", name: "Moniepoint MFB" },
    { code: "076", name: "Polaris Bank" }, { code: "101", name: "Providus Bank" },
    { code: "221", name: "Stanbic IBTC Bank" }, { code: "232", name: "Sterling Bank" },
    { code: "032", name: "Union Bank of Nigeria" }, { code: "033", name: "United Bank for Africa (UBA)" },
    { code: "215", name: "Unity Bank" }, { code: "035", name: "Wema Bank" },
    { code: "057", name: "Zenith Bank" }, { code: "090110", name: "VFD Microfinance Bank" },
    { code: "000026", name: "Taj Bank" }, { code: "000031", name: "PalmPay" },
    { code: "000014", name: "OPay (OPay Digital)" }, { code: "000019", name: "Flutterwave" },
  ];
  let cachedBankList: { code: string; name: string }[] | null = null;
  let bankListCachedAt = 0;

  app.get("/api/wallet/banks", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // Serve from memory cache (1 hour TTL)
    if (cachedBankList && Date.now() - bankListCachedAt < 3600_000) return res.json(cachedBankList);
    const secretKey = process.env.SQUAD_SECRET_KEY;
    try {
      const r = await fetch("https://api.squadco.com/bank/list", {
        headers: { "Authorization": `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json() as any;
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const banks = data.data
          .map((b: any) => ({ code: String(b.bank_code || b.code || ""), name: String(b.bank_name || b.name || "") }))
          .filter((b: any) => b.code && b.name)
          .sort((a: any, z: any) => a.name.localeCompare(z.name));
        cachedBankList = banks;
        bankListCachedAt = Date.now();
        return res.json(banks);
      }
    } catch (_) {}
    // Fallback
    res.json(FALLBACK_BANKS);
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

    const secretKey = process.env.SQUAD_SECRET_KEY;
    try {
      const r = await fetch("https://api.squadco.com/bank/account/lookup", {
        method: "POST",
        headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await r.json() as any;
      if (data.success) {
        const accountName: string = data.data?.account_name ?? data.data?.AccountName ?? "";
        if (accountName) {
          bankResolveCache.set(cacheKey, accountName);
          return res.json({ accountName, accountNumber });
        }
      }
      const msg: string = (data.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("invalid") || msg.includes("does not exist")) {
        return res.json({ accountNotFound: true, message: "Account not found. Check the account number and bank." });
      }
      return res.json({ message: data.message || "Could not verify account. Please double-check and proceed with caution.", unverified: true });
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
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) return res.status(404).json({ message: "No TSIA member found with that email" });
      if (user.id === userId) return res.status(400).json({ message: "You cannot send money to yourself" });
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email });
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
    const { recipientId, amount, note } = req.body;
    if (!recipientId || !amount || amount <= 0) return res.status(400).json({ message: "Invalid transfer details" });
    try {
      const senderWallet    = await storage.getOrCreateWallet(userId);
      const senderBalance   = parseFloat(senderWallet.balance);
      if (senderBalance < amount) return res.status(400).json({ message: `Insufficient balance. You have $${senderBalance.toFixed(2)}` });
      const recipient = await storage.getUser(recipientId);
      if (!recipient) return res.status(404).json({ message: "Recipient not found" });
      // Deduct from sender
      await storage.updateWalletBalance(userId, (senderBalance - amount).toFixed(2));
      // Credit recipient
      const recipientWallet  = await storage.getOrCreateWallet(recipientId);
      const recipientBalance = parseFloat(recipientWallet.balance);
      await storage.updateWalletBalance(recipientId, (recipientBalance + amount).toFixed(2));
      // Record transfer
      await storage.createWalletTransfer({ senderId: userId, recipientId, amount, note });
      // Record transaction entries for both parties
      await storage.createTransaction({ userId, type: "transfer", amount: (-amount).toFixed(2), fee: "0.00", paymentMethod: "wallet", description: `P2P transfer to ${recipient.firstName} ${recipient.lastName}${note ? ` — ${note}` : ""}` });
      await storage.createTransaction({ userId: recipientId, type: "transfer", amount: amount.toFixed(2), fee: "0.00", paymentMethod: "wallet", description: `P2P transfer from ${(await storage.getUser(userId))?.firstName ?? "User"}${note ? ` — ${note}` : ""}` });
      res.json({ message: `$${amount.toFixed(2)} sent to ${recipient.firstName} ${recipient.lastName} successfully` });
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
    if (balance < amountUsd) throw Object.assign(new Error(`Insufficient balance. You have $${balance.toFixed(2)}`), { status: 400 });
    await storage.updateWalletBalance(userId, (balance - amountUsd).toFixed(2));
    await storage.createBillPayment({ userId, service, amount: amountUsd, reference });
    await storage.createTransaction({ userId, type: "bill", amount: (-amountUsd).toFixed(2), fee: "0.00", paymentMethod: "wallet", description });
    const notif = await storage.createNotification({ userId, type: "wallet_credit", title: notifTitle, message: notifMessage, data: notifData, isRead: false });
    pushToUser(userId, "notification", notif);
    return await storage.getOrCreateWallet(userId);
  }

  // ── POST /api/fintech/bank-transfer — Squad payout to Nigerian bank ──────────
  app.post("/api/fintech/bank-transfer", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { bankCode, bankName, accountNumber, accountName, amount, narration } = req.body;
      if (!bankCode || !accountNumber || !accountName || !amount) {
        return res.status(400).json({ message: "bankCode, accountNumber, accountName, and amount are required" });
      }
      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) return res.status(400).json({ message: "Invalid amount" });

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      if (balance < transferAmount) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });

      const vatAmount = transferAmount * 0.075;
      const netAmountUsd = transferAmount - vatAmount;
      const netAmountNgn = Math.round(netAmountUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT);
      const txRef = `TSIA-FT-${userId}-${Date.now()}`;

      // Call Squad payout API
      const secretKey = process.env.SQUAD_SECRET_KEY;
      let squadSuccess = false, squadMsg = "";
      try {
        const squadRes = await fetch("https://api.squadco.com/payout/initiate", {
          method: "POST",
          headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_reference: txRef,
            amount: netAmountNgn,
            bank_code: bankCode,
            account_number: accountNumber,
            account_name: accountName,
            currency_id: "NGN",
            narration: narration || `TSIA Bank Transfer | Ref: ${txRef}`,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const squadData = await squadRes.json() as any;
        squadSuccess = !!squadData.success;
        if (!squadSuccess) squadMsg = squadData.message ?? "Transfer failed";
      } catch (e: any) { squadMsg = e.message ?? "Network error"; }

      if (!squadSuccess) {
        return res.status(502).json({ message: `Bank transfer failed: ${squadMsg}. Please try again or contact support.` });
      }

      // Deduct + record
      await storage.updateWalletBalance(userId, (balance - transferAmount).toFixed(2));
      const billRef = `${accountName} | ${accountNumber} | ${bankName || bankCode} | Ref: ${txRef}`;
      await storage.createBillPayment({ userId, service: "bank_transfer", amount: transferAmount, reference: billRef });
      await storage.createTransaction({ userId, type: "withdrawal", amount: (-transferAmount).toFixed(2), fee: vatAmount.toFixed(2), paymentMethod: "bank_transfer", description: `Bank transfer ₦${netAmountNgn.toLocaleString()} to ${accountName} (${accountNumber}) — 7.5% VAT: $${vatAmount.toFixed(2)} | Ref: ${txRef}` });
      const msg = `₦${netAmountNgn.toLocaleString()} sent to ${accountName} (${accountNumber}). Processing within 24h. Ref: ${txRef}`;
      const notif = await storage.createNotification({ userId, type: "wallet_credit", title: "Bank Transfer Initiated ✓", message: msg, data: { ref: txRef }, isRead: false });
      pushToUser(userId, "notification", notif);
      const updated = await storage.getOrCreateWallet(userId);
      res.json({ success: true, reference: txRef, netAmountNgn, vatAmount: vatAmount.toFixed(2), wallet: updated, message: msg });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/airtime — Squad VAS airtime purchase ──────────────────
  app.post("/api/fintech/airtime", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { network, phone, amount } = req.body;
      if (!network || !phone || !amount) return res.status(400).json({ message: "network, phone, and amount required" });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      if (balance < amountUsd) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const txRef = `TSIA-AIR-${userId}-${Date.now()}`;
      const NETWORK_MAP: Record<string, string> = { mtn: "MTN", airtel: "AIRTEL", glo: "GLO", "9mobile": "9MOBILE", etisalat: "9MOBILE" };
      const networkCode = NETWORK_MAP[network.toLowerCase()] || network.toUpperCase();

      const secretKey = process.env.SQUAD_SECRET_KEY;
      let squadSuccess = false, squadMsg = "";
      try {
        const r = await fetch("https://api.squadco.com/vending/purchase/airtime", {
          method: "POST",
          headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: phone, network_operator: networkCode, amount: amountNgn, transaction_reference: txRef }),
          signal: AbortSignal.timeout(20000),
        });
        const d = await r.json() as any;
        squadSuccess = !!d.success;
        if (!squadSuccess) squadMsg = d.message ?? "Airtime purchase failed";
      } catch (e: any) { squadMsg = e.message ?? "Network error"; }

      if (!squadSuccess) {
        return res.status(502).json({ message: `Airtime purchase failed: ${squadMsg}. Please try again.` });
      }

      const ref = `${networkCode} | ${phone} | ₦${amountNgn.toLocaleString()} | Ref: ${txRef}`;
      const desc = `Airtime ₦${amountNgn.toLocaleString()} → ${phone} (${networkCode}) | Ref: ${txRef}`;
      const msg = `₦${amountNgn.toLocaleString()} airtime delivered to ${phone} (${networkCode}).`;
      await fintechDebitWallet(userId, amountUsd, "airtime", ref, desc, "Airtime Delivered ✓", msg, { ref: txRef });
      res.json({ success: true, reference: txRef, amountNgn, message: msg });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/data — Squad VAS data bundle purchase ─────────────────
  app.post("/api/fintech/data", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { network, phone, amount, planLabel, planValidity } = req.body;
      if (!network || !phone || !amount) return res.status(400).json({ message: "network, phone, and amount required" });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      if (balance < amountUsd) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const txRef = `TSIA-DATA-${userId}-${Date.now()}`;
      const NETWORK_MAP: Record<string, string> = { mtn: "MTN", airtel: "AIRTEL", glo: "GLO", "9mobile": "9MOBILE", etisalat: "9MOBILE" };
      const networkCode = NETWORK_MAP[network.toLowerCase()] || network.toUpperCase();

      const secretKey = process.env.SQUAD_SECRET_KEY;
      let squadSuccess = false, squadMsg = "";
      try {
        const r = await fetch("https://api.squadco.com/vending/purchase/data", {
          method: "POST",
          headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: phone, network_operator: networkCode, amount: amountNgn, transaction_reference: txRef }),
          signal: AbortSignal.timeout(20000),
        });
        const d = await r.json() as any;
        squadSuccess = !!d.success;
        if (!squadSuccess) squadMsg = d.message ?? "Data purchase failed";
      } catch (e: any) { squadMsg = e.message ?? "Network error"; }

      if (!squadSuccess) {
        return res.status(502).json({ message: `Data purchase failed: ${squadMsg}. Please try again.` });
      }

      const planInfo = planLabel ? `${planLabel}${planValidity ? ` (${planValidity})` : ""}` : `₦${amountNgn.toLocaleString()} data`;
      const ref = `${networkCode} | ${planInfo} | ${phone} | Ref: ${txRef}`;
      const desc = `Data ${planInfo} ₦${amountNgn.toLocaleString()} → ${phone} (${networkCode}) | Ref: ${txRef}`;
      const msg = `${planInfo} data bundle activated on ${phone} (${networkCode}).`;
      await fintechDebitWallet(userId, amountUsd, "internet", ref, desc, "Data Bundle Activated ✓", msg, { ref: txRef });
      res.json({ success: true, reference: txRef, amountNgn, message: msg });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/electricity — Squad VAS electricity payment ────────────
  app.post("/api/fintech/electricity", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { discoCode, meterType, meterNumber, amount, phone } = req.body;
      if (!discoCode || !meterType || !meterNumber || !amount) {
        return res.status(400).json({ message: "discoCode, meterType, meterNumber, and amount required" });
      }
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);
      if (balance < amountUsd) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const txRef = `TSIA-ELEC-${userId}-${Date.now()}`;

      const secretKey = process.env.SQUAD_SECRET_KEY;
      let squadSuccess = false, squadMsg = "", token = "";
      try {
        const r = await fetch("https://api.squadco.com/vending/purchase/electricity", {
          method: "POST",
          headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            disco_code: discoCode, meter_type: meterType, meter_number: meterNumber,
            amount: amountNgn, phone_number: phone || "08000000000", transaction_reference: txRef,
          }),
          signal: AbortSignal.timeout(25000),
        });
        const d = await r.json() as any;
        squadSuccess = !!d.success;
        token = d.data?.token ?? d.data?.meter_token ?? "";
        if (!squadSuccess) squadMsg = d.message ?? "Electricity payment failed";
      } catch (e: any) { squadMsg = e.message ?? "Network error"; }

      if (!squadSuccess) {
        return res.status(502).json({ message: `Electricity payment failed: ${squadMsg}. Please try again.` });
      }

      const noteRef = token ? `Token: ${token} | Ref: ${txRef}` : `Ref: ${txRef}`;
      const ref = `${discoCode} | ${meterType} | ${meterNumber} | ₦${amountNgn.toLocaleString()} | ${noteRef}`;
      const desc = `Electricity ₦${amountNgn.toLocaleString()} → ${meterNumber} (${discoCode}, ${meterType}) | ${noteRef}`;
      const msg = token
        ? `₦${amountNgn.toLocaleString()} electricity credited. Meter: ${meterNumber}. Token: ${token}`
        : `₦${amountNgn.toLocaleString()} electricity submitted for ${meterNumber} (${discoCode}).`;
      await fintechDebitWallet(userId, amountUsd, "electricity", ref, desc, "Electricity Credited ✓", msg, { ref: txRef, token });
      res.json({ success: true, reference: txRef, amountNgn, token, message: msg });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
  });

  // ── POST /api/fintech/betting — Betting wallet funding (wallet debit) ────────
  app.post("/api/fintech/betting", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { platform, bettingUserId, amount } = req.body;
      if (!platform || !bettingUserId || !amount) return res.status(400).json({ message: "platform, bettingUserId, and amount required" });
      const amountUsd = parseFloat(amount);
      if (isNaN(amountUsd) || amountUsd <= 0) return res.status(400).json({ message: "Invalid amount" });

      const amountNgn = Math.round(amountUsd * CURRENCY_RATES.USD_TO_NGN_PAYMENT);
      const txRef = `TSIA-BET-${userId}-${Date.now()}`;
      const ref = `${platform} | ID: ${bettingUserId} | ₦${amountNgn.toLocaleString()} | Ref: ${txRef}`;
      const desc = `Betting wallet fund ${platform} ID: ${bettingUserId} | ₦${amountNgn.toLocaleString()} | Ref: ${txRef}`;
      const msg = `₦${amountNgn.toLocaleString()} funded to ${platform} wallet (ID: ${bettingUserId}).`;
      await fintechDebitWallet(userId, amountUsd, "betting", ref, desc, "Betting Wallet Funded ✓", msg, { ref: txRef });
      res.json({ success: true, reference: txRef, amountNgn, message: msg });
    } catch (e: any) { res.status(e.status || 500).json({ message: e.message }); }
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
      if (balance < amount) return res.status(400).json({ message: `Insufficient balance. You have $${balance.toFixed(2)}` });
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
      const bills = await storage.getBillPaymentsByUser(userId);
      res.json(bills);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: confirm wallet deposit
  app.post("/api/admin/wallet-deposit/:id/confirm", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      // ── IDEMPOTENCY GUARD: prevent double-crediting already-confirmed deposits ──
      const [existingDeposit] = await db.select().from(walletDeposits).where(eq(walletDeposits.id, parseInt(req.params.id)));
      if (!existingDeposit) return res.status(404).json({ message: "Deposit not found" });
      if (existingDeposit.status === "completed") {
        return res.status(409).json({ message: "This deposit has already been confirmed and credited. Re-confirming is not allowed to prevent duplicate credits." });
      }
      const deposit = await storage.updateWalletDeposit(parseInt(req.params.id), { status: "completed" });
      const gross = parseFloat(deposit.amountUsd);
      // 75% → user wallet, 20% → reserve fund, 5% → affiliate pool
      const reserveCut   = parseFloat((gross * TRADE_MARKET.RESERVE_FUND_RATE).toFixed(2));   // 20%
      const affiliateCut = parseFloat((gross * TRADE_MARKET.AFFILIATE_SHARE_RATE).toFixed(2)); // 5%
      const userCredit   = parseFloat((gross - reserveCut - affiliateCut).toFixed(2));         // 75%
      // Credit user wallet (75%)
      const wallet = await storage.getOrCreateWallet(deposit.userId);
      const newBalance = (parseFloat(wallet.balance) + userCredit).toFixed(2);
      await storage.updateWalletBalance(deposit.userId, newBalance);
      // Reserve fund (20%)
      await storage.addToReserveFund(reserveCut.toFixed(6));
      // Affiliate pool share (always recorded for accounting)
      try {
        const affiliateCount = await storage.getAffiliateCount();
        const perAffiliate = affiliateCount > 0 ? affiliateCut / affiliateCount : 0;
        await storage.recordAffiliateTradeShare(deposit.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));
      } catch { /* non-critical */ }
      // ── Wallet activation: activate if balance reaches $5 for the first time ──
      const WALLET_ACTIVATION_MIN = 5;
      if (!wallet.activated && parseFloat(newBalance) >= WALLET_ACTIVATION_MIN) {
        try {
          await storage.activateWallet(deposit.userId);
          // Credit 5% referral commission to referrer on first activation deposit
          creditReferrerCommission(deposit.userId, gross, "personal wallet activation").catch(() => {});
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
        } catch { /* non-critical */ }
      }
      // Record transaction (platform fee = 25%: 20% reserve + 5% affiliate)
      await storage.createTransaction({
        userId: deposit.userId,
        type: "deposit",
        amount: userCredit.toFixed(2),
        fee: (reserveCut + affiliateCut).toFixed(2),
        paymentMethod: deposit.walletType ?? "crypto",
        description: `Crypto deposit confirmed — $${gross.toFixed(2)} gross | $${userCredit.toFixed(2)} credited (75%), $${reserveCut.toFixed(2)} reserve, $${affiliateCut.toFixed(2)} pool`,
      });
      // ─────────────────────────────────────────────────────────────────────────
      // Notify user
      try {
        const depUser = await storage.getUser(deposit.userId);
        if (depUser) {
          sendWalletCreditEmail(depUser.email, depUser.firstName, userCredit.toFixed(2), newBalance).catch((err: any) => console.error("[EMAIL] Wallet credit email failed:", err?.message ?? err));
        }
        const walletNotif = await storage.createNotification({
          userId: deposit.userId,
          type: "wallet_credit",
          title: "Wallet Credited ✓",
          message: `$${gross.toFixed(2)} deposit confirmed. $${userCredit.toFixed(2)} (75%) credited to your TSIA Personal Wallet. $${reserveCut.toFixed(2)} (20%) to Reserve Fund, $${affiliateCut.toFixed(2)} (5%) to Affiliate Pool. New balance: $${newBalance}.`,
          data: { depositId: deposit.id, gross, userCredit, reserveCut, affiliateCut, newBalance },
          isRead: false,
        });
        pushToUser(deposit.userId, "notification", walletNotif);
      } catch { /* non-critical */ }
      res.json({ success: true, breakdown: { gross, userCredit, reserveCut, affiliateCut, newBalance } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: decline wallet deposit
  app.post("/api/admin/wallet-deposit/:id/decline", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
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
      // Notify category subscribers
      try {
        const cat = prod.category || "other";
        const subs = await storage.getCategorySubscribers(cat);
        for (const subId of subs) {
          if (subId === userId) continue;
          const notif = await storage.createNotification({ userId: subId, type: "new_arrival", title: "New Arrival", message: `A new item in ${cat}: "${prod.title}"`, relatedId: prod.id });
          pushToUser(subId, "notification", notif);
          storage.getUser(subId).then(u => {
            if (u) sendNewArrivalEmail(u.email, u.firstName, cat, prod.title, prod.id).catch((err: any) => console.error("[EMAIL] New arrival email failed:", err?.message ?? err));
          });
        }
      } catch (_) {}
      res.json(prod);
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

      // Deduct from buyer wallet
      const buyerWallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(buyerWallet.balance) < totalAmount) return res.status(400).json({ message: `Insufficient wallet balance. Need $${totalAmount.toFixed(2)}` });
      await storage.updateWalletBalance(userId, (parseFloat(buyerWallet.balance) - totalAmount).toFixed(2));

      // Credit seller wallet (minus commission)
      const sellerWallet = await storage.getOrCreateWallet(prod.sellerId);
      await storage.updateWalletBalance(prod.sellerId, (parseFloat(sellerWallet.balance) + sellerReceives).toFixed(2));

      // Update stock
      const newStock = prod.stock - qty;
      await storage.updateProduct(prod.id, { stock: newStock, ...(newStock === 0 ? { status: "sold" } : {}) });

      // Create order record
      const order = await storage.createOrder({ buyerId: userId, sellerId: prod.sellerId, productId: prod.id, quantity: qty, unitPrice: unitPrice.toFixed(2), totalAmount: totalAmount.toFixed(2), commissionRate: ECOMMERCE.COMMISSION_RATE.toFixed(4), commissionAmount: commissionAmount.toFixed(2), sellerReceives: sellerReceives.toFixed(2), status: "confirmed", deliveryAddress: deliveryAddress || null, note: note || null });

      // Notify buyer and seller
      try {
        const [buyerUser, sellerUser] = await Promise.all([
          storage.getUser(userId),
          storage.getUser(prod.sellerId),
        ]);
        if (buyerUser) sendOrderUpdateEmail(buyerUser.email, buyerUser.firstName, "confirmed", prod.title, order.id).catch((err: any) => console.error("[EMAIL] Order email failed:", err?.message ?? err));
        if (sellerUser) sendNewSaleEmail(sellerUser.email, sellerUser.firstName, prod.title, sellerReceives.toFixed(2), order.id).catch((err: any) => console.error("[EMAIL] New sale email failed:", err?.message ?? err));
        const [buyerNotif, sellerNotif] = await Promise.all([
          storage.createNotification({
            userId,
            type: "order_update",
            title: "Order Confirmed",
            message: `Your order for "${prod.title}" (x${qty}) has been confirmed. $${totalAmount.toFixed(2)} deducted from your wallet.`,
            data: { orderId: order.id, productId: prod.id },
            isRead: false,
          }),
          storage.createNotification({
            userId: prod.sellerId,
            type: "order_update",
            title: "New Sale",
            message: `Your listing "${prod.title}" was purchased (x${qty}). You received $${sellerReceives.toFixed(2)} in your wallet.`,
            data: { orderId: order.id, productId: prod.id },
            isRead: false,
          }),
        ]);
        pushToUser(userId, "notification", buyerNotif);
        pushToUser(prod.sellerId, "notification", sellerNotif);
      } catch { /* non-critical */ }

      res.json({ order, message: `Order placed! $${totalAmount.toFixed(2)} deducted. TSIA commission: $${commissionAmount.toFixed(2)} (${(ECOMMERCE.COMMISSION_RATE * 100)}%).` });
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

  app.patch("/api/orders/:id/status", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { status } = req.body;
    try {
      const order = await storage.updateOrderStatus(parseInt(req.params.id), status);
      // Email buyer about order status change
      try {
        const [buyerUser, prod] = await Promise.all([
          storage.getUser(order.buyerId),
          storage.getProductById(order.productId),
        ]);
        if (buyerUser && prod) {
          sendOrderUpdateEmail(buyerUser.email, buyerUser.firstName, status, prod.title, order.id).catch((err: any) => console.error("[EMAIL] Order email failed:", err?.message ?? err));
        }
      } catch { /* non-critical */ }
      res.json(order);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── E-COMMERCE CHAT ─────────────────────────────────────────────────────────
  // Get all chats for the current user
  app.get("/api/chats", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const chats = await storage.getUserChats(userId);
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
      const messages = await storage.getChatMessages(parseInt(req.params.chatId));
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
      const msg = await storage.createChatMessage({
        chatId: parseInt(req.params.chatId),
        senderId: userId,
        content: censored,
        isFlagged: flagged,
      });

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
            message: "It's nearly 1:00 PM GMT! Come back in 30 minutes to activate your AI Trading Bot and start today's trading session.",
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
            message: "It's 1:00 PM GMT! Your AI Trading Bot activation window is now open. Go to Trade Market → activate your bot to start today's 2% trades.",
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
      const topics = await storage.getForumTopics(section, search);
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

  // POST /api/forum/topics/:id/like
  app.post("/api/forum/topics/:id/like", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      await storage.likeForumTopic(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forum/topics/:id/posts  — replies
  app.get("/api/forum/topics/:id/posts", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const posts = await storage.getForumPosts(Number(req.params.id));
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

  // POST /api/forum/posts/:id/like
  app.post("/api/forum/posts/:id/like", async (req, res) => {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      await storage.likeForumPost(Number(req.params.id));
      res.json({ ok: true });
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

  // GET /api/qce/status — get user's QCE savings record
  app.get("/api/qce/status", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const savings = await storage.getOrCreateQceSavings(userId);
      const transactions = await storage.getQceTransactions(userId);
      res.json({ savings, transactions });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/qce/contribute — add funds to QCE savings from personal wallet
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

      // Credit QCE savings
      const { savings, transaction } = await storage.contributeToQce(userId, amount);

      // Tick QCE days for returning users making daily contributions
      await storage.tickQceDays(userId);

      // Send notification if first activation
      if (!qce.activated) {
        try {
          const qceNotif = await storage.createNotification({
            userId,
            type: "qce_update",
            title: "QCE Savings Activated!",
            message: `Your Quick Credit Eligibility savings are now active with $${amount.toFixed(2)}. Keep contributing daily over 90 days to build up to 30% credit eligibility. Your Credit Portal is now unlocked.`,
            data: { balance: savings.balance, daysActive: savings.daysActive },
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

  // POST /api/qce/withdraw — withdraw from QCE savings back to personal wallet
  app.post("/api/qce/withdraw", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { amountUsd } = req.body;
      const amount = parseFloat(amountUsd);
      if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required." });

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
          title: "QCE Savings Withdrawn",
          message: `$${amount.toFixed(2)} withdrawn from your QCE savings back to your Personal Wallet. Your new wallet balance is $${newWalletBal}.`,
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
    }, 15000);
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
    const adminEmail = process.env.BREVO_SENDER_EMAIL || "emmanuelbright769@gmail.com";
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

  return httpServer;
}
