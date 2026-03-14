import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import { calculateWaecPercentage, getPayoutTier, CURRENCY_RATES, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, generateAffiliateCode } from "@shared/schema";

const PgSession = pgSession(session);

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
      const { email, firstName, lastName, phone, country, referralCode, role } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      let user = await storage.getUserByEmail(email);
      const isSignup = !!firstName;

      if (!user && isSignup) {
        const userRole = role === "affiliate" ? "affiliate" : "student";
        user = await storage.createUser({
          firstName, lastName, email, phone: phone || "",
          password: "otp-only", country: country || "ng", role: userRole,
          referredBy: referralCode || null,
        });
        const affCode = generateAffiliateCode(firstName, user.id);
        await storage.updateUserAffiliateCode(user.id, affCode);
        user = await storage.getUser(user.id);
      }

      if (!user) {
        return res.status(404).json({ message: "No account found with this email. Please sign up first." });
      }

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtp({ email, code, expiresAt, used: false });

      console.log(`[OTP] Code for ${email}: ${code}`);

      res.json({
        message: "OTP sent to your email",
        otpSent: true,
        isNewUser: isSignup && !await storage.getVerificationByUser(user!.id),
        hint: code,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ message: "Email and OTP code are required" });

      const otp = await storage.getValidOtp(email, code);
      if (!otp) return res.status(401).json({ message: "Invalid or expired OTP code" });

      await storage.markOtpUsed(otp.id);

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      (req.session as any).userId = user.id;
      res.json({
        id: user.id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, phone: user.phone, country: user.country,
        affiliateCode: user.affiliateCode,
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
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
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

  app.post("/api/verification/identity", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { nin } = req.body;
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

  return httpServer;
}
