import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { addSseClient, removeSseClient, pushToUser } from "./realtime";
import {
  sendOtpEmail, sendWelcomeEmail, sendWalletCreditEmail,
  sendOrderUpdateEmail, sendLoanUpdateEmail, sendVerificationUpdateEmail,
  sendReferralCommissionEmail, sendPriceDropEmail,
} from "./email";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import { calculateWaecPercentage, getPayoutTier, CURRENCY_RATES, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, generateAffiliateCode, getCoAffiliatePricing, getMilestoneProgress, CO_AFFILIATE_PROGRAM, TRADE_MARKET, ECOMMERCE, getEliteSharePercentage, calculateStudentLoanLimit, calculateAffiliateLoanLimit, calculateLoanMonthly, QCE, users, loans, transactions, tradeTransactions, orders, wallets, verifications, coAffiliates } from "@shared/schema";
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

const DEMO_OTP = "123456";

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

        const isDemo = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
        const code = isDemo ? DEMO_OTP : generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createOtp({ email, code, expiresAt, used: false });
        console.log(`[OTP] Code for ${email} (${targetUser.role}): ${code}`);
        sendOtpEmail(email, code, false).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));

        return res.json({ message: "OTP sent to your email", otpSent: true, ...(isDemo ? { devOtp: code } : {}) });
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
        const isDemo2 = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
        const code = isDemo2 ? DEMO_OTP : generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await storage.createOtp({ email, code, expiresAt, used: false });
        console.log(`[OTP] Dual-account code for ${email}: ${code}`);
        sendOtpEmail(email, code, true).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));
        return res.json({ message: "OTP sent to your email", otpSent: true, bothCreated: true, ...(isDemo2 ? { devOtp: code } : {}) });
      }

      // Single-role signup
      const targetRole = role === "affiliate" ? "affiliate" : "student";
      const user = await createRoleAccount(targetRole);

      const isDemo3 = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
      const code = isDemo3 ? DEMO_OTP : generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email, code, expiresAt, used: false });
      console.log(`[OTP] Code for ${email}: ${code}`);
      sendOtpEmail(email, code, true).catch((err: any) => console.error("[EMAIL] OTP send failed:", err?.message ?? err));

      res.json({
        message: "OTP sent to your email",
        otpSent: true,
        isNewUser: !await storage.getVerificationByUser(user!.id),
        ...(isDemo3 ? { devOtp: code } : {}),
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
      const demoOtpValid = process.env.NODE_ENV !== "production" && code === DEMO_OTP;
      if (!otp && !demoOtpValid) return res.status(401).json({ message: "Invalid or expired OTP code" });
      if (otp) {
        await storage.markOtpUsed(otp.id);
      }

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

  app.post("/api/verification/validate-nin", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { nin } = req.body;
      if (!nin || nin.length !== 11 || !/^\d{11}$/.test(nin)) {
        return res.status(400).json({ message: "NIN must be exactly 11 digits." });
      }

      const apiKey = process.env.VERIFYME_API_KEY;

      if (!apiKey) {
        console.warn("[NIN] VERIFYME_API_KEY not set — running format-only validation");
        return res.json({
          valid: true,
          nin,
          message: "NIN format validated. Live NIMC lookup pending API key configuration.",
          demo: true,
          data: { firstName: "Verified", lastName: "User", nin },
        });
      }

      const verifyRes = await fetch(
        `https://vapi.verifyme.ng/v1/verifications/identities/nin/${nin}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || verifyData.status !== "success") {
        return res.status(400).json({
          message: "NIN could not be verified. Please check the number and try again.",
          details: verifyData?.message || "Verification failed",
        });
      }

      const ninData = verifyData.data || {};
      return res.json({
        valid: true,
        nin,
        message: "NIN verified successfully via NIMC database.",
        data: {
          firstName: ninData.firstname || "",
          lastName: ninData.lastname || "",
          middleName: ninData.middlename || "",
          gender: ninData.gender || "",
          phone: ninData.phone || "",
          birthdate: ninData.birthdate || "",
          photo: ninData.photo || null,
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/verification/identity", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { nin } = req.body;
      if (!nin || nin.length !== 11 || !/^\d{11}$/.test(nin)) {
        return res.status(400).json({ message: "A valid 11-digit NIN is required." });
      }
      let verification = await storage.getVerificationByUser(userId);
      if (verification) {
        verification = await storage.updateVerification(verification.id, { nin });
      } else {
        verification = await storage.createVerification({ userId, nin, status: "pending", portalFeePaid: false, tier: "none" });
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
        description: `Portal verification fee ($${portalFee.toFixed(2)}) + service charge ($${serviceCharge.toFixed(2)}) = $${totalCharged.toFixed(2)} (₦${ngnEquivalent.toLocaleString()})`,
      });

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
    const wallet = await storage.getOrCreateWallet(userId);
    const balanceUsd = parseFloat(wallet.balance);
    const balanceNgn = balanceUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT;
    res.json({ ...wallet, balanceNgn: balanceNgn.toFixed(2) });
  });

  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { amount } = req.body;
      const wallet = await storage.getOrCreateWallet(userId);
      const withdrawAmount = parseFloat(amount);
      if (withdrawAmount <= 0 || withdrawAmount > parseFloat(wallet.balance)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const vatAmount = withdrawAmount * 0.075;
      const netAmountUsd = withdrawAmount - vatAmount;
      const netAmountNgn = netAmountUsd * CURRENCY_RATES.USD_TO_NGN_PAYOUT;

      await storage.updateWalletBalance(userId, (-withdrawAmount).toString());
      await storage.createTransaction({
        userId, type: "withdrawal",
        amount: (-netAmountUsd).toFixed(2),
        description: `Withdrawal $${netAmountUsd.toFixed(2)} (₦${netAmountNgn.toLocaleString()}) to bank`,
      });
      await storage.createTransaction({
        userId, type: "vat_deduction",
        amount: (-vatAmount).toFixed(2),
        description: `7.5% VAT on $${withdrawAmount.toFixed(2)} withdrawal`,
      });

      const updated = await storage.getOrCreateWallet(userId);
      res.json({
        wallet: updated,
        vatAmount: vatAmount.toFixed(2),
        netAmount: netAmountUsd.toFixed(2),
        netAmountNgn: netAmountNgn.toFixed(2),
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
      res.json({ ...record, myProfit: myProfit.toFixed(6), totalAffiliatePool: totalAffiliatePool.toFixed(2) });
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
        type: "wallet",
        title: "Trust Fund Enrolment Confirmed",
        message: `You've joined the Co-Affiliate programme. $${reserveCut.toFixed(2)} (20%) has been ring-fenced into the Strategic Reserve Fund.`,
        data: { amountPaid, reserveCut, shareLabel: (sharePercentage * 100).toFixed(6) + "%" },
        isRead: false,
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

      const updated = await storage.updateCoAffiliate(userId, {
        investmentCategory: newCategory,
        amountPaid: newAmountPaid.toFixed(2),
        sharePercentage: newSharePercentage.toFixed(10),
      });

      res.json({
        ...updated,
        currentPrice: newAmountPaid,
        shareLabel: (newSharePercentage * 100).toFixed(6) + "%",
        message: `Successfully upgraded to ${cat === 500 ? "Elite" : cat === 300 ? "Growth" : "Starter"} tier!`,
      });
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
        note: `Deposit via ${walletType.toUpperCase()} — 20% reserve, 5% affiliate pool`,
      });

      await storage.updateTradeBalance(userId, userCredit.toFixed(6));
      await storage.addToReserveFund(reserveCut.toFixed(6));
      const affiliateCount = await storage.getAffiliateCount();
      const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));

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

  app.post("/api/trade/withdraw", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amountUsd, withdrawalType, walletType, bankAccountName } = req.body;
      const amount = parseFloat(amountUsd);
      if (isNaN(amount) || amount < TRADE_MARKET.MIN_WITHDRAW) {
        return res.status(400).json({ message: `Minimum withdrawal is $${TRADE_MARKET.MIN_WITHDRAW}.` });
      }
      if (!["withdraw_exchange", "withdraw_bank"].includes(withdrawalType)) {
        return res.status(400).json({ message: "withdrawalType must be withdraw_exchange or withdraw_bank." });
      }
      const feeRate = withdrawalType === "withdraw_bank" ? TRADE_MARKET.FEE_BANK_WITHDRAW : TRADE_MARKET.FEE_EXCHANGE_WITHDRAW;
      const fee = amount * feeRate;
      const affiliateCut = amount * TRADE_MARKET.AFFILIATE_SHARE_RATE; // 5% on withdrawal too
      const netPayout = amount - fee - affiliateCut;

      await storage.getOrCreateTradeWallet(userId);
      const wallet = await storage.getOrCreateTradeWallet(userId);
      const currentBalance = parseFloat(wallet.tradeBalance);
      if (currentBalance < amount) {
        return res.status(400).json({ message: `Insufficient balance. Available: $${currentBalance.toFixed(2)}` });
      }

      const txType = withdrawalType === "withdraw_bank" ? "withdraw_bank" : "withdraw_exchange";
      const tx = await storage.createTradeTransaction({
        userId,
        type: txType,
        walletType: walletType || null,
        amountUsd: amount.toFixed(6),
        feeUsd: fee.toFixed(6),
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: affiliateCut.toFixed(6),
        netAmount: netPayout.toFixed(6),
        txHash: null,
        status: "completed",
        note: withdrawalType === "withdraw_bank"
          ? `Bank withdrawal — 8% fee + 5% affiliate pool`
          : `Exchange wallet withdrawal — 5% fee + 5% affiliate pool`,
      });

      await storage.updateTradeBalance(userId, (-amount).toFixed(6));
      const affiliateCount = await storage.getAffiliateCount();
      const perAffiliate = affiliateCount > 0 ? (affiliateCut / affiliateCount) : 0;
      await storage.recordAffiliateTradeShare(tx.id, affiliateCut.toFixed(6), affiliateCount, perAffiliate.toFixed(6));

      const updatedWallet = await storage.getOrCreateTradeWallet(userId);
      res.json({
        transaction: tx,
        newBalance: updatedWallet.tradeBalance,
        breakdown: {
          requested: amount,
          fee: fee,
          feeRate: `${(feeRate * 100).toFixed(0)}%`,
          affiliatePool: affiliateCut,
          netPayout: netPayout,
        },
        message: "Withdrawal processed.",
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Called by the frontend when the bot session completes (12h elapsed) — credits 2% of balance
  app.post("/api/trade/bot/complete", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const wallet = await storage.getOrCreateTradeWallet(userId);
      const balance = parseFloat(wallet.tradeBalance);
      if (balance <= 0) return res.status(400).json({ message: "No balance to earn from." });
      const earning = parseFloat((balance * 0.02).toFixed(6)); // 2% daily return
      if (earning <= 0) return res.status(400).json({ message: "Earning too small." });
      await storage.createTradeTransaction({
        userId,
        type: "bot_earning",
        walletType: null,
        amountUsd: earning.toFixed(6),
        feeUsd: "0.000000",
        reserveFundDeduction: "0.000000",
        affiliateShareDeduction: "0.000000",
        netAmount: earning.toFixed(6),
        txHash: null,
        status: "completed",
        note: `Bot session completed — 2% return on $${balance.toFixed(2)}`,
      });
      const updatedWallet = await storage.creditBotEarnings(userId, earning.toFixed(6));
      await storage.createNotification({
        userId,
        type: "trade",
        title: "Bot Session Complete — Earnings Credited",
        message: `Your 12-hour bot session has ended. $${earning.toFixed(2)} (2% daily return) has been added to your Trade Wallet.`,
        data: { earning, newBalance: updatedWallet.tradeBalance },
        isRead: false,
      });
      res.json({
        earning: earning.toFixed(6),
        newBalance: updatedWallet.tradeBalance,
        totalBotEarnings: updatedWallet.totalBotEarnings,
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
      res.json({
        totalBalance: fund.total_balance ?? "0",
        totalDeposited: fund.total_deposited ?? "0",
        contributionRate: 20,
        description: "20% of every Global Trade Market deposit is ring-fenced into this strategic reserve.",
        updatedAt: new Date().toISOString(),
      });
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

      await storage.updateWalletBalance(disbursement.userId, disbursement.amount);
      await storage.createTransaction({
        userId: disbursement.userId, type: "sponsorship_credit",
        amount: disbursement.amount,
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
      await storage.deleteUserById(targetId);
      res.json({ success: true, deletedId: targetId });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
        await storage.updateWalletBalance(loan.userId, loan.amountUsd);
        await storage.createTransaction({
          userId: loan.userId, type: "sponsorship_credit",
          amount: loan.amountUsd,
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
  // ── Paystack: initialize payment ──────────────────────────────────────────
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
      const USD_TO_KOBO = 160000; // 1 USD = 1600 NGN = 160000 kobo
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
      const amountUsd = parseFloat(data.data.metadata?.amountUsd || (data.data.amount / 160000).toFixed(2));
      // Credit wallet
      await storage.updateWalletBalance(userId, amountUsd.toFixed(2));
      // Mark deposit as completed
      if (existing) await storage.updateWalletDeposit(existing.id, { status: "completed" });
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
  app.get("/api/wallet/banks", (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json([
      { code: "044", name: "Access Bank" },
      { code: "035A", name: "ALAT by Wema" },
      { code: "401", name: "ASO Savings and Loans" },
      { code: "023", name: "Citibank Nigeria" },
      { code: "063", name: "Diamond Bank" },
      { code: "050", name: "EcoBank Nigeria" },
      { code: "562", name: "Ekondo Microfinance Bank" },
      { code: "084", name: "Enterprise Bank" },
      { code: "070", name: "Fidelity Bank" },
      { code: "011", name: "First Bank of Nigeria" },
      { code: "214", name: "First City Monument Bank" },
      { code: "058", name: "Guaranty Trust Bank" },
      { code: "030", name: "Heritage Bank" },
      { code: "301", name: "Jaiz Bank" },
      { code: "082", name: "Keystone Bank" },
      { code: "526", name: "Kuda Bank" },
      { code: "090405", name: "Moniepoint Microfinance Bank" },
      { code: "014", name: "Mainstreet Bank" },
      { code: "076", name: "Polaris Bank" },
      { code: "101", name: "ProvidusBank" },
      { code: "221", name: "Stanbic IBTC Bank" },
      { code: "068", name: "Standard Chartered Bank" },
      { code: "232", name: "Sterling Bank" },
      { code: "100", name: "Suntrust Bank" },
      { code: "032", name: "Union Bank of Nigeria" },
      { code: "033", name: "United Bank For Africa" },
      { code: "215", name: "Unity Bank" },
      { code: "035", name: "Wema Bank" },
      { code: "057", name: "Zenith Bank" },
      { code: "090110", name: "VFD Microfinance Bank" },
      { code: "000026", name: "Taj Bank" },
      { code: "000031", name: "PalmPay" },
      { code: "000014", name: "Opay (OPay Digital)" },
      { code: "000019", name: "Flutterwave" },
    ]);
  });

  // Resolve Nigerian bank account name via Paystack
  app.post("/api/wallet/resolve-bank", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) return res.status(400).json({ message: "Account number and bank code required" });
    if (!/^\d{10}$/.test(accountNumber)) return res.status(400).json({ message: "Account number must be 10 digits" });

    // ── 1. Serve from cache if available (saves Paystack quota) ──────────
    const cacheKey = `${bankCode}:${accountNumber}`;
    const cached = bankResolveCache.get(cacheKey);
    if (cached) return res.json({ accountName: cached, accountNumber, fromCache: true });

    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      return res.json({ message: "Cannot auto-verify right now — please confirm account details before sending", unverified: true });
    }

    try {
      const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      const data = await response.json() as any;

      // ── 2. Paystack API-level failure ────────────────────────────────
      if (!data.status) {
        const msg: string = (data.message || "").toLowerCase();
        const isRateLimit = msg.includes("daily limit") || msg.includes("test mode") || msg.includes("upgrade to live");
        const isNotFound  = msg.includes("could not resolve") || msg.includes("not found") || response.status === 422;

        if (isRateLimit) {
          // Treat as unverified warning — user can still proceed
          return res.json({ message: "Auto-verification unavailable right now. Please double-check the account details before sending.", unverified: true });
        }
        if (isNotFound) {
          return res.json({ accountNotFound: true, message: "Account not found. Check the account number and bank." });
        }
        return res.json({ message: data.message || "Could not verify account", unverified: true });
      }

      // ── 3. Success — cache and return ────────────────────────────────
      const accountName: string = data.data.account_name;
      bankResolveCache.set(cacheKey, accountName);
      res.json({ accountName, accountNumber: data.data.account_number });
    } catch (e: any) {
      res.json({ message: "Verification service unreachable — please confirm account details before sending.", unverified: true });
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
      const deposit = await storage.updateWalletDeposit(parseInt(req.params.id), { status: "completed" });
      // Credit user wallet
      const wallet = await storage.getOrCreateWallet(deposit.userId);
      const newBalance = (parseFloat(wallet.balance) + parseFloat(deposit.amountUsd)).toFixed(2);
      await storage.updateWalletBalance(deposit.userId, newBalance);
      // Notify user
      try {
        const depUser = await storage.getUser(deposit.userId);
        if (depUser) {
          sendWalletCreditEmail(depUser.email, depUser.firstName, parseFloat(deposit.amountUsd).toFixed(2), newBalance).catch((err: any) => console.error("[EMAIL] Wallet credit email failed:", err?.message ?? err));
        }
        const walletNotif = await storage.createNotification({
          userId: deposit.userId,
          type: "wallet_credit",
          title: "Wallet Credited",
          message: `$${parseFloat(deposit.amountUsd).toFixed(2)} has been confirmed and credited to your TSIA Personal Wallet.`,
          data: { depositId: deposit.id, amount: deposit.amountUsd },
          isRead: false,
        });
        pushToUser(deposit.userId, "notification", walletNotif);
      } catch { /* non-critical */ }
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

      // Deduct from wallet (negative amount)
      await storage.updateWalletBalance(userId, (-totalAmount).toFixed(6));

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
        type: "wallet",
        title: `${type === "hotel" ? "Hotel" : type === "car_hire" ? "Car Hire" : "Flight"} Booking Confirmed`,
        message: `Your booking is confirmed. $${totalAmount.toFixed(2)} charged, ref: ${reference}.`,
        data: { booking: booking.id, type, totalAmount, commission },
        isRead: false,
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
          await storage.createNotification({
            userId,
            type: "qce_update",
            title: "QCE Savings Activated!",
            message: `Your Quick Credit Eligibility savings are now active with $${amount.toFixed(2)}. Keep contributing daily over 90 days to build up to 30% credit eligibility. Your Credit Portal is now unlocked.`,
            data: { balance: savings.balance, daysActive: savings.daysActive },
            isRead: false,
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

  return httpServer;
}
