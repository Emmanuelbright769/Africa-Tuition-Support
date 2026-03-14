import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "admin", "affiliate"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);
export const tierEnum = pgEnum("tier", ["platinum", "gold", "silver", "none"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["verification_fee", "sponsorship_credit", "withdrawal", "vat_deduction"]);
export const disbursementStatusEnum = pgEnum("disbursement_status", ["pending", "approved", "rejected", "completed"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull().default("otp-only"),
  country: text("country").notNull().default("ng"),
  role: roleEnum("role").notNull().default("student"),
  affiliateCode: text("affiliate_code").unique(),
  referredBy: text("referred_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  nin: text("nin"),
  waecRegNumber: text("waec_reg_number"),
  waecYear: text("waec_year"),
  waecSubjects: text("waec_subjects"),
  schoolName: text("school_name"),
  schoolLocation: text("school_location"),
  biometricVerified: boolean("biometric_verified").notNull().default(false),
  status: verificationStatusEnum("status").notNull().default("pending"),
  portalFeePaid: boolean("portal_fee_paid").notNull().default(false),
  commitmentStartDate: timestamp("commitment_start_date"),
  tier: tierEnum("tier").notNull().default("none"),
  waecGrades: text("waec_grades"),
  waecPercentage: decimal("waec_percentage", { precision: 5, scale: 2 }),
  payoutMin: decimal("payout_min", { precision: 10, scale: 2 }),
  payoutMax: decimal("payout_max", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fileUploads = pgTable("file_uploads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data").notNull(),
  category: text("category").notNull().default("document"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sponsorshipPlans = pgTable("sponsorship_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  planYears: integer("plan_years").notNull(),
  annualCost: decimal("annual_cost", { precision: 10, scale: 2 }).notNull(),
  maxPayout: decimal("max_payout", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const disbursements = pgTable("disbursements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: disbursementStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const leadershipInquiries = pgTable("leadership_inquiries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull(),
  cohortSize: text("cohort_size").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertOtpSchema = createInsertSchema(otpCodes).omit({ id: true, createdAt: true });
export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true, createdAt: true });
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({ id: true, createdAt: true });
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type FileUpload = typeof fileUploads.$inferSelect;

export const insertSponsorshipPlanSchema = createInsertSchema(sponsorshipPlans).omit({ id: true, createdAt: true });
export type InsertSponsorshipPlan = z.infer<typeof insertSponsorshipPlanSchema>;
export type SponsorshipPlan = typeof sponsorshipPlans.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertDisbursementSchema = createInsertSchema(disbursements).omit({ id: true, createdAt: true, processedAt: true });
export type InsertDisbursement = z.infer<typeof insertDisbursementSchema>;
export type Disbursement = typeof disbursements.$inferSelect;

export const insertLeadershipInquirySchema = createInsertSchema(leadershipInquiries).omit({ id: true, createdAt: true });
export type InsertLeadershipInquiry = z.infer<typeof insertLeadershipInquirySchema>;
export type LeadershipInquiry = typeof leadershipInquiries.$inferSelect;

export type WalletRecord = typeof wallets.$inferSelect;

export const WAEC_GRADE_WEIGHTS: Record<string, number> = {
  A1: 15, B2: 13, B3: 12, C4: 11, C5: 10, C6: 9, D7: 8, E8: 7, F9: 6,
};

export const CURRENCY_RATES = {
  USD_TO_NGN_PAYMENT: 1460,
  USD_TO_NGN_PAYOUT: 1280,
};

export const WAEC_COMPULSORY_SUBJECTS = ["Mathematics", "English Language"];

export const WAEC_ELECTIVE_SUBJECTS = [
  "Physics", "Chemistry", "Biology", "Economics", "Geography",
  "Agricultural Science", "Civic Education", "Government",
  "Literature in English", "Commerce", "Financial Accounting",
  "Further Mathematics", "Computer Studies", "Technical Drawing",
  "Food and Nutrition", "Christian Religious Studies", "Islamic Studies",
  "Visual Arts", "Music", "Health Education",
];

export function calculateWaecPercentage(grades: string[]): number {
  const weights = grades.map(g => WAEC_GRADE_WEIGHTS[g.toUpperCase()] || 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const maxPossible = grades.length * 15;
  if (maxPossible === 0) return 0;
  return Math.round((totalWeight / maxPossible) * 100 * 100) / 100;
}

export function getPayoutTier(percentage: number): { min: number; max: number; label: string } {
  if (percentage >= 75) return { min: 225, max: 230, label: "platinum" };
  if (percentage >= 60) return { min: 160, max: 180, label: "gold" };
  if (percentage >= 50) return { min: 110, max: 130, label: "silver" };
  return { min: 0, max: 0, label: "none" };
}

export function generateAffiliateCode(firstName: string, id: number): string {
  return `TSIA-${firstName.toUpperCase().slice(0, 3)}${id.toString().padStart(4, '0')}`;
}
