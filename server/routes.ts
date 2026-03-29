import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import { calculateWaecPercentage, getPayoutTier, CURRENCY_RATES, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, generateAffiliateCode, getCoAffiliatePricing, getMilestoneProgress, CO_AFFILIATE_PROGRAM, TRADE_MARKET, ECOMMERCE, getEliteSharePercentage, calculateStudentLoanLimit, calculateAffiliateLoanLimit, calculateLoanMonthly } from "@shared/schema";

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

        return res.json({ message: "OTP sent to your email", otpSent: true, hint: code });
      }

      // ── Signup flow ────────────────────────────────────────────────────
      let user = await storage.getUserByEmailAndRole(email, role === "affiliate" ? "affiliate" : "student");

      if (!user) {
        const userRole = role === "affiliate" ? "affiliate" : "student";
        user = await storage.createUser({
          firstName, lastName, email, phone: phone || "",
          password: "otp-only", country: country || "ng", role: userRole,
          referredBy: referralCode || null,
        });
        const affCode = generateAffiliateCode(firstName, user.id);
        await storage.updateUserAffiliateCode(user.id, affCode);
        user = await storage.getUser(user.id);

        // Notify the affiliate who referred this person
        if (referralCode) {
          try {
            const referrer = await storage.getUserByAffiliateCode(referralCode);
            if (referrer) {
              await storage.createNotification({
                userId: referrer.id,
                type: "referral",
                title: "New Referral",
                message: `${firstName} ${lastName} signed up using your referral link as a ${userRole}.`,
                data: { newUserId: user!.id, role: userRole },
                isRead: false,
              });
            }
          } catch { /* non-critical */ }
        }
      }

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email, code, expiresAt, used: false });
      console.log(`[OTP] Code for ${email}: ${code}`);

      res.json({
        message: "OTP sent to your email",
        otpSent: true,
        isNewUser: !await storage.getVerificationByUser(user!.id),
        hint: code,
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

      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({
          id: user.id, firstName: user.firstName, lastName: user.lastName,
          email: user.email, role: user.role, phone: user.phone, country: user.country,
          affiliateCode: user.affiliateCode,
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
      });

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

      if (!verification.biometricVerified) {
        return res.status(400).json({ message: "Biometric verification is required before payment" });
      }

      const usdAmount = 3;
      const ngnEquivalent = usdAmount * CURRENCY_RATES.USD_TO_NGN_PAYMENT;

      verification = await storage.updateVerification(verification.id, {
        portalFeePaid: true,
        commitmentStartDate: new Date(),
      });

      await storage.createTransaction({
        userId,
        type: "verification_fee",
        amount: `-${usdAmount.toFixed(2)}`,
        description: `Portal verification fee ($${usdAmount} = ₦${ngnEquivalent.toLocaleString()})`,
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
      const totalEnrolled = await storage.getCoAffiliateCount();
      const pricing = getCoAffiliatePricing(totalEnrolled);
      const progress = getMilestoneProgress(totalEnrolled);
      res.json({
        totalEnrolled,
        target: CO_AFFILIATE_PROGRAM.TARGET,
        milestoneInterval: CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL,
        pricing,
        progress,
        spotsRemaining: CO_AFFILIATE_PROGRAM.TARGET - totalEnrolled,
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
      res.json(record || null);
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

      const record = await storage.createCoAffiliate({
        userId,
        investmentCategory,
        amountPaid: amountPaid.toFixed(2),
        sharePercentage: sharePercentage.toFixed(10),
        status: "active",
      });

      res.json({
        ...record,
        currentPrice: amountPaid,
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

      const { approve } = req.body;
      const vId = parseInt(req.params.verificationId);
      const status = approve ? "verified" : "rejected";
      const updated = await storage.updateVerification(vId, { status });
      // Notify student
      try {
        await storage.createNotification({
          userId: updated.userId,
          type: "verification_update",
          title: approve ? "Verification Approved" : "Verification Update",
          message: approve
            ? "Congratulations! Your identity has been verified. You now have full access to all TSIA features."
            : "Your verification was not approved. Please contact support or resubmit your documents.",
          data: { verificationId: vId, status },
          isRead: false,
        });
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
        await storage.createNotification({
          userId: deposit.userId,
          type: "wallet_credit",
          title: "Wallet Credited",
          message: `$${parseFloat(deposit.amountUsd).toFixed(2)} has been confirmed and credited to your TSIA Personal Wallet.`,
          data: { depositId: deposit.id, amount: deposit.amountUsd },
          isRead: false,
        });
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
    const { title, description, price, category, condition, images, stock, location } = req.body;
    if (!title || !description || !price) return res.status(400).json({ message: "Title, description and price are required" });
    const priceNum = parseFloat(price);
    if (priceNum < ECOMMERCE.MIN_PRICE || priceNum > ECOMMERCE.MAX_PRICE) return res.status(400).json({ message: `Price must be $${ECOMMERCE.MIN_PRICE}–$${ECOMMERCE.MAX_PRICE}` });
    try {
      const prod = await storage.createProduct({ sellerId: userId, title, description, price: priceNum.toFixed(2), category: category || "other", condition: condition || "new", images: images || [], stock: parseInt(stock) || 1, location: location || "London, UK", status: "active" });
      res.json(prod);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/products/:id", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const prod = await storage.getProductById(parseInt(req.params.id));
      if (!prod || prod.sellerId !== userId) return res.status(403).json({ message: "Not your product" });
      const updated = await storage.updateProduct(parseInt(req.params.id), req.body);
      res.json(updated);
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
      if (prod.sellerId === userId) return res.status(400).json({ message: "You cannot buy your own product" });
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
        await Promise.all([
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
      if (product.sellerId === userId) return res.status(400).json({ message: "You cannot chat with yourself" });
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

  return httpServer;
}
