import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "admin"]);
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
  password: text("password").notNull(),
  country: text("country").notNull().default("ng"),
  role: roleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  nin: text("nin"),
  waecRegNumber: text("waec_reg_number"),
  waecYear: text("waec_year"),
  status: verificationStatusEnum("status").notNull().default("pending"),
  portalFeePaid: boolean("portal_fee_paid").notNull().default(false),
  commitmentStartDate: timestamp("commitment_start_date"),
  tier: tierEnum("tier").notNull().default("none"),
  waecGrades: text("waec_grades"),
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

export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true, createdAt: true });
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

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
