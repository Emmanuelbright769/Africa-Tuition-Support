import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date, pgEnum, jsonb, serial, numeric, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "admin", "affiliate"]);
export const coAffiliateStatusEnum = pgEnum("co_affiliate_status", ["active", "pending", "cancelled"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);
export const identityVerificationStatusEnum = pgEnum("identity_verification_status", ["pending", "verified", "failed", "expired", "manual_review"]);
export const tierEnum = pgEnum("tier", ["platinum", "gold", "silver", "none"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["verification_fee", "plan_payment", "sponsorship_credit", "withdrawal", "vat_deduction", "deposit", "transfer", "bill", "trade_transfer", "loan", "admin_credit", "admin_adjustment", "crypto_withdrawal", "refund", "subscription_fee", "maintenance_fee"]);
export const disbursementStatusEnum = pgEnum("disbursement_status", ["pending", "approved", "rejected", "completed"]);
export const tradeWalletTypeEnum = pgEnum("trade_wallet_type", ["trc20", "bep20"]);
export const tradeTransactionTypeEnum = pgEnum("trade_transaction_type", ["deposit", "topup", "withdraw_exchange", "withdraw_bank", "bot_earning", "admin_credit"]);
export const tradeTransactionStatusEnum = pgEnum("trade_transaction_status", ["pending", "completed", "failed"]);
export const backToSchoolVestStatusEnum = pgEnum("back_to_school_vest_status", ["active", "qualified", "expired"]);
export const backToSchoolAttemptStatusEnum = pgEnum("back_to_school_attempt_status", ["started", "completed", "expired"]);
export const backToSchoolAwardStatusEnum = pgEnum("back_to_school_award_status", ["recommended", "approved", "paid", "declined", "not_eligible"]);
export const backToSchoolCertificateStatusEnum = pgEnum("back_to_school_certificate_status", ["pending", "approved", "declined"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  password: text("password").notNull().default("otp-only"),
  country: text("country").notNull().default("ng"),
  role: roleEnum("role").notNull().default("student"),
  accountStatus: text("account_status").notNull().default("active"),
  affiliateCode: text("affiliate_code").unique(),
  referredBy: text("referred_by"),
  walletFundDeadline: timestamp("wallet_fund_deadline"),
  activeSessionId: text("active_session_id"),
  transactionPinHash: text("transaction_pin_hash"),
  transactionPinSetAt: timestamp("transaction_pin_set_at"),
  transactionPinFailedAttempts: integer("transaction_pin_failed_attempts").notNull().default(0),
  transactionPinLockedUntil: timestamp("transaction_pin_locked_until"),
  transactionPinAnnouncementSeenAt: timestamp("transaction_pin_announcement_seen_at"),
  transactionPinAnnouncementNotifiedAt: timestamp("transaction_pin_announcement_notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailRoleUnique: uniqueIndex("users_email_role_unique").on(table.email, table.role),
}));

export const otpCodes = pgTable("otp_codes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Administrative actions are append-only so staff can explain and review
// sensitive changes without relying on the mutable domain records alone.
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  actorUserId: integer("actor_user_id").notNull().references(() => users.id),
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  reason: text("reason"),
  reference: text("reference"),
  outcome: text("outcome").notNull().default("success"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminManualCreditGuards = pgTable("admin_manual_credit_guards", {
  reference: text("reference").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  nin: text("nin"),
  idType: text("id_type").default("nin"),
  waecRegNumber: text("waec_reg_number"),
  waecYear: text("waec_year"),
  waecSubjects: text("waec_subjects"),
  schoolName: text("school_name"),
  schoolLocation: text("school_location"),
  biometricVerified: boolean("biometric_verified").notNull().default(false),
  ageDisqualified: boolean("age_disqualified").notNull().default(false),
  sponsorshipReason: text("sponsorship_reason"),
  status: verificationStatusEnum("status").notNull().default("pending"),
  portalFeePaid: boolean("portal_fee_paid").notNull().default(false),
  commitmentStartDate: timestamp("commitment_start_date"),
  tier: tierEnum("tier").notNull().default("none"),
  waecGrades: text("waec_grades"),
  waecPercentage: decimal("waec_percentage", { precision: 5, scale: 2 }),
  payoutMin: decimal("payout_min", { precision: 10, scale: 2 }),
  payoutMax: decimal("payout_max", { precision: 10, scale: 2 }),
  paidBatchId: integer("paid_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Provider-backed identity records are intentionally separate from academic
// verification. They never retain the document or selfie image itself.
export const identityVerifications = pgTable("identity_verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  signupTokenHash: text("signup_token_hash").unique(),
  documentCountry: varchar("document_country", { length: 2 }).notNull(),
  documentType: text("document_type").notNull(),
  documentNumberHash: text("document_number_hash"),
  provider: text("provider").notNull().default("prembly"),
  providerReference: text("provider_reference"),
  providerStatus: text("provider_status"),
  providerEvidence: jsonb("provider_evidence"),
  status: identityVerificationStatusEnum("status").notNull().default("pending"),
  livenessStatus: text("liveness_status").notNull().default("pending"),
  faceMatchScore: decimal("face_match_score", { precision: 6, scale: 3 }),
  failureReason: text("failure_reason"),
  documentExpiresAt: timestamp("document_expires_at"),
  expiresAt: timestamp("expires_at"),
  verifiedAt: timestamp("verified_at"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Back to School is guardian-managed. Child records are separate from account
// users and retain only the information required for this programme.
export const backToSchoolChildren = pgTable("back_to_school_children", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  fullName: text("full_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  schoolName: text("school_name"),
  gradeLevel: text("grade_level"),
  birthCertificateUploadId: integer("birth_certificate_upload_id").references(() => fileUploads.id),
  certificateStatus: backToSchoolCertificateStatusEnum("certificate_status").notNull().default("pending"),
  certificateReviewReason: text("certificate_review_reason"),
  certificateReviewedBy: integer("certificate_reviewed_by").references(() => users.id),
  certificateReviewedAt: timestamp("certificate_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const backToSchoolVests = pgTable("back_to_school_vests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => backToSchoolChildren.id).unique(),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull().default("30.00"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  fundedAt: timestamp("funded_at"),
  cbtUnlockedAt: timestamp("cbt_unlocked_at"),
  maturesAt: timestamp("matures_at").notNull(),
  status: backToSchoolVestStatusEnum("status").notNull().default("active"),
  qualifiedAt: timestamp("qualified_at"),
  returnedAmount: decimal("returned_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const backToSchoolVestTransactions = pgTable("back_to_school_vest_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vestId: integer("vest_id").notNull().references(() => backToSchoolVests.id),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 30 }).notNull().default("contribution"),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  grossAmountUsd: decimal("gross_amount_usd", { precision: 10, scale: 2 }),
  feeAmountUsd: decimal("fee_amount_usd", { precision: 10, scale: 2 }).notNull().default("0.00"),
  netAmountUsd: decimal("net_amount_usd", { precision: 10, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A persisted replay guard for money-moving kiddies requests. The response is
// retained with the request key so retrying a lost client response cannot debit
// or credit a wallet a second time.
export const backToSchoolOperations = pgTable("back_to_school_operations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  childId: integer("child_id").notNull().references(() => backToSchoolChildren.id),
  operation: varchar("operation", { length: 24 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  response: jsonb("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  guardianChildOperationKey: uniqueIndex("back_to_school_operations_replay_guard").on(
    table.guardianUserId, table.childId, table.operation, table.idempotencyKey,
  ),
}));

export const backToSchoolAttempts = pgTable("back_to_school_attempts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => backToSchoolChildren.id).unique(),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  questionIds: jsonb("question_ids").notNull(),
  status: backToSchoolAttemptStatusEnum("status").notNull().default("started"),
  score: integer("score"),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  cheatingEvents: jsonb("cheating_events").notNull().default([]),
  autoSubmitted: boolean("auto_submitted").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const backToSchoolAwards = pgTable("back_to_school_awards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => backToSchoolChildren.id).unique(),
  guardianUserId: integer("guardian_user_id").notNull().references(() => users.id),
  scorePercentage: decimal("score_percentage", { precision: 5, scale: 2 }).notNull(),
  awardAmount: decimal("award_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: backToSchoolAwardStatusEnum("status").notNull().default("not_eligible"),
  reviewReason: text("review_reason"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  paidAt: timestamp("paid_at"),
  paymentReference: text("payment_reference"),
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
  activated: boolean("activated").notNull().default(false),
  activatedAt: timestamp("activated_at"),
  cashbackBalance: decimal("cashback_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lienAmount: decimal("lien_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lienReason: text("lien_reason"),
  lienPlacedAt: timestamp("lien_placed_at"),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentMethod: text("payment_method"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monthlyBillingCycles = pgTable("monthly_billing_cycles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthKey: varchar("month_key", { length: 7 }).notNull(),
  subscriptionFee: decimal("subscription_fee", { precision: 10, scale: 2 }).notNull().default("1.50"),
  maintenanceFee: decimal("maintenance_fee", { precision: 10, scale: 2 }).notNull().default("0.50"),
  totalFee: decimal("total_fee", { precision: 10, scale: 2 }).notNull().default("2.00"),
  status: text("status").notNull().default("payment_required"),
  balanceAtAttempt: decimal("balance_at_attempt", { precision: 10, scale: 2 }).notNull().default("0.00"),
  attemptCount: integer("attempt_count").notNull().default(1),
  chargedAt: timestamp("charged_at"),
  lastAttemptAt: timestamp("last_attempt_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userMonthUnique: uniqueIndex("monthly_billing_cycles_user_month_uq").on(table.userId, table.monthKey),
}));

export type MonthlyBillingCycle = typeof monthlyBillingCycles.$inferSelect;

export const disbursements = pgTable("disbursements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: disbursementStatusEnum("status").notNull().default("pending"),
  semesterNum: integer("semester_num").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const coAffiliates = pgTable("co_affiliates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  investmentCategory: integer("investment_category").notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  sharePercentage: decimal("share_percentage", { precision: 14, scale: 10 }).notNull(),
  withdrawnAmount: decimal("withdrawn_amount", { precision: 14, scale: 6 }).notNull().default("0"),
  status: coAffiliateStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeWallets = pgTable("trade_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  trc20Address: text("trc20_address"),
  bep20Address: text("bep20_address"),
  tradeBalance: decimal("trade_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  exchangeBalance: decimal("exchange_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  totalBotEarnings: decimal("total_bot_earnings", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  totalInvested: decimal("total_invested", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  roiComplete: boolean("roi_complete").notNull().default(false),
  lockedPrincipal: decimal("locked_principal", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  referralCommissionBalance: decimal("referral_commission_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  botActivatedAt: timestamp("bot_activated_at"),
  botLocked: boolean("bot_locked").notNull().default(false),
  tradingDayNumber: integer("trading_day_number").notNull().default(0),
  lossDayNumbers: integer("loss_day_numbers").array().notNull().default(sql`ARRAY[]::integer[]`),
  tradingPlanDays: integer("trading_plan_days").notNull().default(120),
  cycleStartedAt: timestamp("cycle_started_at"),   // set on every deposit / reinvest; null = never deposited
  earlyExitCompleted: boolean("early_exit_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Independent balances for services which must never share the Trade bot ledger.
export const serviceWallets = pgTable("service_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  serviceType: text("service_type").notNull(),
  balance: decimal("balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userServiceUnique: uniqueIndex("service_wallets_user_service_uq").on(table.userId, table.serviceType),
}));

export const serviceWalletTransactions = pgTable("service_wallet_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletId: integer("wallet_id").notNull().references(() => serviceWallets.id),
  userId: integer("user_id").notNull().references(() => users.id),
  serviceType: text("service_type").notNull(),
  // Signed: credits are positive and debits are negative.
  amount: decimal("amount", { precision: 16, scale: 6 }).notNull(),
  reference: text("reference").notNull(),
  kind: text("kind").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  serviceReferenceUnique: uniqueIndex("service_wallet_transactions_service_reference_uq").on(table.serviceType, table.reference),
}));

export const tradeTransactions = pgTable("trade_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: tradeTransactionTypeEnum("type").notNull(),
  walletType: tradeWalletTypeEnum("wallet_type"),
  amountUsd: decimal("amount_usd", { precision: 16, scale: 6 }).notNull(),
  feeUsd: decimal("fee_usd", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  reserveFundDeduction: decimal("reserve_fund_deduction", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  affiliateShareDeduction: decimal("affiliate_share_deduction", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  netAmount: decimal("net_amount", { precision: 16, scale: 6 }).notNull(),
  txHash: text("tx_hash"),
  status: tradeTransactionStatusEnum("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // NULL remains permitted for legacy/imported rows. Keyed financial events
  // use a non-NULL durable id and are unique per account.
  userTxHashUnique: uniqueIndex("trade_transactions_user_tx_hash_unique").on(table.userId, table.txHash),
}));

export const tradeReserveFund = pgTable("trade_reserve_fund", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  totalBalance: decimal("total_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  totalDeposited: decimal("total_deposited", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const affiliateTradeShares = pgTable("affiliate_trade_shares", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tradeTransactionId: integer("trade_transaction_id"),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  totalPoolAmount: decimal("total_pool_amount", { precision: 16, scale: 6 }).notNull(),
  affiliateCount: integer("affiliate_count").notNull().default(0),
  perAffiliateAmount: decimal("per_affiliate_amount", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  sourceType: text("source_type").default("trade"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tourBookingTypeEnum = pgEnum("tour_booking_type", ["hotel", "car_hire", "flight"]);
export const tourBookingStatusEnum = pgEnum("tour_booking_status", ["pending", "confirmed", "cancelled"]);

export const tourBookings = pgTable("tour_bookings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: tourBookingTypeEnum("type").notNull(),
  details: jsonb("details").notNull(),
  totalAmount: decimal("total_amount", { precision: 16, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 16, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: tourBookingStatusEnum("status").notNull().default("pending"),
  reference: text("reference").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTourBookingSchema = createInsertSchema(tourBookings).omit({ id: true, createdAt: true });
export type InsertTourBooking = z.infer<typeof insertTourBookingSchema>;
export type TourBooking = typeof tourBookings.$inferSelect;

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
export const insertIdentityVerificationSchema = createInsertSchema(identityVerifications).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIdentityVerification = z.infer<typeof insertIdentityVerificationSchema>;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type BackToSchoolChild = typeof backToSchoolChildren.$inferSelect;
export type BackToSchoolVest = typeof backToSchoolVests.$inferSelect;
export type BackToSchoolAttempt = typeof backToSchoolAttempts.$inferSelect;
export type BackToSchoolAward = typeof backToSchoolAwards.$inferSelect;

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

export const insertCoAffiliateSchema = createInsertSchema(coAffiliates).omit({ id: true, createdAt: true });
export type InsertCoAffiliate = z.infer<typeof insertCoAffiliateSchema>;
export type CoAffiliate = typeof coAffiliates.$inferSelect;

export const insertTradeWalletSchema = createInsertSchema(tradeWallets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTradeWallet = z.infer<typeof insertTradeWalletSchema>;
export type TradeWallet = typeof tradeWallets.$inferSelect;

export const insertTradeTransactionSchema = createInsertSchema(tradeTransactions).omit({ id: true, createdAt: true });
export type InsertTradeTransaction = z.infer<typeof insertTradeTransactionSchema>;
export type TradeTransaction = typeof tradeTransactions.$inferSelect;

export type WalletRecord = typeof wallets.$inferSelect;

export const WAEC_GRADE_WEIGHTS: Record<string, number> = {
  A1: 12, B2: 11.5, B3: 11, C4: 10.5, C5: 10, C6: 9.5, D7: 9, E8: 8.5, F9: 8,
};

export const WAEC_GRADE_KEYS = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"] as const;
export type WaecGrade = typeof WAEC_GRADE_KEYS[number];

export const CURRENCY_RATES = {
  USD_TO_NGN_PAYMENT: 1480,
  USD_TO_NGN_PAYOUT: 1280,
  CRYPTO_WITHDRAW_FEE: 0.08,
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

export function calculateWaecPercentage(
  grades: string[],
  customWeights?: Record<string, number> | null,
): number {
  // Normalize custom weights: uppercase keys, fall back to defaults if empty/null
  let weights: Record<string, number> = WAEC_GRADE_WEIGHTS;
  if (customWeights && Object.keys(customWeights).length > 0) {
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(customWeights)) {
      normalized[k.toUpperCase()] = v;
    }
    weights = normalized;
  }
  const gradePoints = grades.map(g => weights[g.toUpperCase()] ?? 0);
  const totalWeight = gradePoints.reduce((sum, w) => sum + w, 0);
  // Direct sum: the admin sets each grade's point value as its direct percentage
  // contribution per subject. The score is the raw sum (capped at 100).
  return Math.min(Math.round(totalWeight * 100) / 100, 100);
}

export function getPayoutTier(percentage: number): { min: number; max: number; label: string } {
  if (percentage >= 75) return { min: 225, max: 230, label: "platinum" };
  if (percentage >= 60) return { min: 160, max: 180, label: "gold" };
  if (percentage >= 51) return { min: 110, max: 130, label: "silver" };
  return { min: 0, max: 0, label: "none" };
}

export function generateAffiliateCode(firstName: string, id: number): string {
  return `TSIA-${firstName.toUpperCase().slice(0, 3)}${id.toString().padStart(4, '0')}`;
}

export const CO_AFFILIATE_PROGRAM = {
  TARGET: 1_000_000,
  MILESTONE_INTERVAL: 150_000,
  PRICE_INCREASE_RATE: 0.20,
  BASE_CATEGORIES: [100, 300, 500] as const,
  SHARE_FACTOR: 0.00002,
  ELITE_MIN: 500,
  ELITE_MAX: 10_000,
} as const;

export type CoAffiliateBaseCategory = 100 | 300;
export type CoAffiliateCategory = 100 | 300 | number; // 500–10000 for elite

export const TRADE_MARKET = {
  FEE_EXCHANGE_WITHDRAW: 0.08,
  FEE_BANK_WITHDRAW: 0.08,
  RESERVE_FUND_RATE: 0.20,
  AFFILIATE_SHARE_RATE: 0.05,
  MIN_DEPOSIT: 10,
  MAX_DEPOSIT: 1200,
  MIN_WITHDRAW: 2,
  TSIA_RECEIVING_TRC20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  TSIA_RECEIVING_BEP20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
} as const;

export const TRADING_PLANS = [
  { days: 60, label: "60-Day Sprint", description: "Shorter cycle · Higher market volatility" },
  { days: 90, label: "90-Day Standard", description: "Balanced cycle · Moderate market volatility" },
  { days: 120, label: "120-Day Classic", description: "Longer cycle · Lower market volatility (recommended)" },
] as const;

export type TradingPlanDays = 60 | 90 | 120;

/**
 * Dynamic co-affiliate transactional pool rate, tiered by total enrolled count.
 * 20% for the first 10,000 · 15% up to 50,000 · 10% up to 100,000 · 5% thereafter.
 */
export function getCoAffiliateTransactionRate(totalCoAffiliates: number): number {
  if (totalCoAffiliates <= 10_000) return 0.20;
  if (totalCoAffiliates <= 50_000) return 0.15;
  if (totalCoAffiliates <= 100_000) return 0.10;
  return 0.05;
}

export interface CoAffiliateTier {
  category: number;
  label: string;
  currentPrice: number;
  sharePercentage: number;
  shareLabel: string;
  isElite?: boolean;
}

export function getCoAffiliatePricing(totalEnrolled: number): CoAffiliateTier[] {
  const milestones = Math.floor(totalEnrolled / CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
  const multiplier = Math.pow(1 + CO_AFFILIATE_PROGRAM.PRICE_INCREASE_RATE, milestones);
  const labels: Record<number, string> = { 100: "Starter", 300: "Growth" };
  const bases = [100, 300];
  const result: CoAffiliateTier[] = bases.map(base => {
    const sharePct = CO_AFFILIATE_PROGRAM.SHARE_FACTOR * (base / 100);
    return {
      category: base,
      label: labels[base],
      currentPrice: Math.round(base * multiplier),
      sharePercentage: sharePct,
      shareLabel: (sharePct * 100).toFixed(6) + "%",
    };
  });
  // Elite tier — base $500, scales with multiplier
  const eliteBase = 500;
  const eliteSharePct = CO_AFFILIATE_PROGRAM.SHARE_FACTOR * (eliteBase / 100);
  result.push({
    category: eliteBase,
    label: "Elite",
    currentPrice: Math.round(eliteBase * multiplier),
    sharePercentage: eliteSharePct,
    shareLabel: (eliteSharePct * 100).toFixed(6) + "%",
    isElite: true,
  });
  return result;
}

export function getEliteSharePercentage(customAmount: number): number {
  return CO_AFFILIATE_PROGRAM.SHARE_FACTOR * (customAmount / 100);
}

export function getMilestoneProgress(totalEnrolled: number) {
  const milestones = Math.floor(totalEnrolled / CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
  const nextMilestone = (milestones + 1) * CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL;
  const progressInCurrentMilestone = totalEnrolled % CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL;
  const pctToNext = (progressInCurrentMilestone / CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL) * 100;
  const overallPct = Math.min((totalEnrolled / CO_AFFILIATE_PROGRAM.TARGET) * 100, 100);
  return { milestones, nextMilestone: Math.min(nextMilestone, CO_AFFILIATE_PROGRAM.TARGET), pctToNext, overallPct };
}

// ─── TENANCY MODULE ────────────────────────────────────────────────────────────
export const tenancyPropertyStatusEnum = pgEnum("tenancy_property_status", ["pending_review", "available", "leased", "expired"]);
export const tenancyLeaseStatusEnum = pgEnum("tenancy_lease_status", ["active", "completed", "defaulted"]);
export const tenancyPaymentStatusEnum = pgEnum("tenancy_payment_status", ["pending", "paid", "overdue"]);

export const landlordProperties = pgTable("landlord_properties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  propertyName: text("property_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("ng"),
  propertyType: text("property_type").notNull().default("apartment"),
  bedrooms: integer("bedrooms").notNull().default(1),
  bathrooms: integer("bathrooms").notNull().default(1),
  annualRentNgn: decimal("annual_rent_ngn", { precision: 14, scale: 2 }).notNull(),
  leasePeriodYears: integer("lease_period_years").notNull().default(5),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }).notNull().default("12.00"),
  tsiaPaymentNgn: decimal("tsia_payment_ngn", { precision: 14, scale: 2 }).notNull(),
  tenantInterestRate: decimal("tenant_interest_rate", { precision: 5, scale: 2 }).notNull().default("5.00"),
  description: text("description"),
  amenities: text("amenities").array(),
  status: tenancyPropertyStatusEnum("status").notNull().default("pending_review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tenancyLeases = pgTable("tenancy_leases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  propertyId: integer("property_id").notNull().references(() => landlordProperties.id),
  tenantId: integer("tenant_id").notNull().references(() => users.id),
  monthlyPaymentNgn: decimal("monthly_payment_ngn", { precision: 14, scale: 2 }).notNull(),
  totalPayableNgn: decimal("total_payable_ngn", { precision: 14, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: tenancyLeaseStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tenancyPayments = pgTable("tenancy_payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leaseId: integer("lease_id").notNull().references(() => tenancyLeases.id),
  amountNgn: decimal("amount_ngn", { precision: 14, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: tenancyPaymentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLandlordPropertySchema = createInsertSchema(landlordProperties).omit({ id: true, createdAt: true });
export type InsertLandlordProperty = z.infer<typeof insertLandlordPropertySchema>;
export type LandlordProperty = typeof landlordProperties.$inferSelect;

export const insertTenancyLeaseSchema = createInsertSchema(tenancyLeases).omit({ id: true, createdAt: true });
export type InsertTenancyLease = z.infer<typeof insertTenancyLeaseSchema>;
export type TenancyLease = typeof tenancyLeases.$inferSelect;

export function calculateTenancyDeal(annualRentNgn: number, leasePeriodYears: number, discountRate: number, tenantInterestRate: number) {
  const totalGross = annualRentNgn * leasePeriodYears;
  const tsiaPayment = totalGross * (1 - discountRate / 100);
  const totalTenantPayable = annualRentNgn * (1 + tenantInterestRate / 100) * leasePeriodYears;
  const monthlyTenantPayment = totalTenantPayable / (leasePeriodYears * 12);
  const tsiaRevenue = totalTenantPayable - tsiaPayment;
  return { totalGross, tsiaPayment, totalTenantPayable, monthlyTenantPayment, tsiaRevenue };
}

// ─── LOANS ───────────────────────────────────────────────────────────────────
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  userRole: text("user_role", { enum: ["student", "affiliate"] }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPaymentUsd: numeric("monthly_payment_usd", { precision: 12, scale: 2 }).notNull(),
  totalPayableUsd: numeric("total_payable_usd", { precision: 12, scale: 2 }).notNull(),
  totalPaidUsd: numeric("total_paid_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  purpose: text("purpose"),
  bvn: text("bvn"),
  nin: text("nin"),
  fullAddress: text("full_address"),
  termDays: integer("term_days"),
  status: text("status", { enum: ["pending", "approved", "active", "repaid", "rejected"] }).notNull().default("pending"),
  repaymentDueDate: date("repayment_due_date"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  disbursedAt: timestamp("disbursed_at"),
});

export const insertLoanSchema = createInsertSchema(loans).omit({ id: true, createdAt: true, disbursedAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;

// ─── BENEFICIARIES ────────────────────────────────────────────────────────────
export const beneficiaries = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  bankCode: text("bank_code").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  nickname: text("nickname"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Beneficiary = typeof beneficiaries.$inferSelect;

export function calculateStudentLoanLimit(tier: string): number {
  if (tier === "platinum") return 200;
  if (tier === "gold") return 150;
  if (tier === "silver") return 100;
  return 0;
}

export function calculateAffiliateLoanLimit(referralCount: number, tradeBalance: number, coAffiliateAmount: number): number {
  const base = 500;
  const fromReferrals = Math.min(referralCount * 50, 2000);
  const fromTrade = Math.min(tradeBalance * 0.5, 3000);
  let multiplier = 1;
  if (coAffiliateAmount >= 500) multiplier = 2;
  else if (coAffiliateAmount >= 300) multiplier = 1.5;
  return Math.min((base + fromReferrals + fromTrade) * multiplier, 5000);
}

// Day-based loan term options with flat interest rates
export const LOAN_TERM_OPTIONS = [
  { days: 7,   label: "7 days",   flatRate: 3,  installments: 1  },  // 3% flat  (~156% APR)
  { days: 14,  label: "14 days",  flatRate: 5,  installments: 1  },  // 5% flat  (~130% APR)
  { days: 30,  label: "30 days",  flatRate: 10, installments: 1  },  // 10% flat (~122% APR)
  { days: 90,  label: "90 days",  flatRate: 15, installments: 3  },  // 15% flat (~61%  APR) — 3 monthly
  { days: 365, label: "365 days", flatRate: 25, installments: 12 },  // 25% flat (25%   APR) — 12 monthly
] as const;

export function calculateLoanByDays(principalUsd: number, termDays: number) {
  const opt = LOAN_TERM_OPTIONS.find(t => t.days === termDays);
  if (!opt) throw new Error(`Invalid term: ${termDays} days`);
  const totalInterest = principalUsd * (opt.flatRate / 100);
  const totalPayable  = principalUsd + totalInterest;
  const installmentAmount = totalPayable / opt.installments;
  return {
    flatRate: opt.flatRate,
    totalInterest,
    totalPayable,
    installments: opt.installments,
    installmentAmount,
    termMonths: opt.installments,     // stored as number-of-installments
    label: opt.label,
  };
}

export function calculateLoanMonthly(principalUsd: number, annualRatePercent: number, termMonths: number) {
  const totalInterest = principalUsd * (annualRatePercent / 100) * (termMonths / 12);
  const totalPayable = principalUsd + totalInterest;
  const monthly = totalPayable / termMonths;
  return { totalInterest, totalPayable, monthly };
}

// ─── ECOMMERCE ───────────────────────────────────────────────────────────────
export const productStatusEnum = pgEnum("product_status", ["active", "sold", "paused"]);
export const orderStatusEnum   = pgEnum("order_status", ["pending", "confirmed", "shipped", "delivered", "cancelled"]);

export const products = pgTable("products", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sellerId:    integer("seller_id").notNull().references(() => users.id),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  price:       decimal("price", { precision: 10, scale: 2 }).notNull(),
  category:    text("category").notNull().default("other"),
  condition:   text("condition").notNull().default("new"),
  images:      text("images").array(),
  stock:       integer("stock").notNull().default(1),
  location:    text("location").notNull().default("London, UK"),
  status:      productStatusEnum("status").notNull().default("active"),
  viewCount:   integer("view_count").notNull().default(0),
  negotiable:  boolean("negotiable").notNull().default(false),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id:               integer("id").primaryKey().generatedAlwaysAsIdentity(),
  buyerId:          integer("buyer_id").notNull().references(() => users.id),
  sellerId:         integer("seller_id").notNull().references(() => users.id),
  productId:        integer("product_id").notNull().references(() => products.id),
  quantity:         integer("quantity").notNull().default(1),
  unitPrice:        decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount:      decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  commissionRate:   decimal("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.0800"),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  sellerReceives:   decimal("seller_receives", { precision: 10, scale: 2 }).notNull(),
  status:           orderStatusEnum("status").notNull().default("pending"),
  escrowReleased:   boolean("escrow_released").notNull().default(false),
  trackingNumber:   text("tracking_number"),
  deliveryAddress:  text("delivery_address"),
  note:             text("note"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export const orderTracking = pgTable("order_tracking", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId:     integer("order_id").notNull().references(() => orders.id),
  statusLabel: text("status_label").notNull(),
  description: text("description").notNull(),
  location:    text("location"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderTrackingSchema = createInsertSchema(orderTracking).omit({ id: true, createdAt: true });
export type InsertOrderTracking = z.infer<typeof insertOrderTrackingSchema>;
export type OrderTracking = typeof orderTracking.$inferSelect;

// Student / user wallet deposit requests (for funding main wallet via USDT)
export const walletDeposits = pgTable("wallet_deposits", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:     integer("user_id").notNull().references(() => users.id),
  amountUsd:  decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  txHash:     text("tx_hash"),
  walletType: text("wallet_type").notNull().default("trc20"),
  status:     text("status").notNull().default("pending"),
  metadata:   jsonb("metadata"),
  failureReason: text("failure_reason"),
  verifiedAt: timestamp("verified_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const walletCreditClaims = pgTable("wallet_credit_claims", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  provider: text("provider").notNull(),
  reference: text("reference").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  depositId: integer("deposit_id").references(() => walletDeposits.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  providerReferenceUnique: uniqueIndex("wallet_credit_claims_provider_reference_uq").on(table.provider, table.reference),
}));

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, viewCount: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const insertWalletDepositSchema = createInsertSchema(walletDeposits).omit({ id: true, createdAt: true });
export type InsertWalletDeposit = z.infer<typeof insertWalletDepositSchema>;
export type WalletDeposit = typeof walletDeposits.$inferSelect;

// ─── PRODUCT RATINGS ─────────────────────────────────────────────────────────
export const productRatings = pgTable("product_ratings", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => products.id),
  userId:    integer("user_id").notNull().references(() => users.id),
  rating:    integer("rating").notNull(), // 1–5
  comment:   text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [{ name: "product_ratings_product_user_unique", columns: [t.productId, t.userId] }]);

export const insertProductRatingSchema = createInsertSchema(productRatings).omit({ id: true, createdAt: true });
export type InsertProductRating = z.infer<typeof insertProductRatingSchema>;
export type ProductRating = typeof productRatings.$inferSelect;

export const ECOMMERCE = {
  COMMISSION_RATE: 0.08,  // 8% platform commission on every sale
  MIN_PRICE: 0.50,
  MAX_PRICE: 10000,
  MAX_IMAGES: 5,
  CATEGORIES: [
    "phones", "computers", "electronics", "tvs_audio", "gaming", "appliances",
    "fashion_women", "fashion_men", "fashion_kids", "shoes", "bags", "watches", "jewelry",
    "beauty", "health", "baby", "toys",
    "home", "kitchen", "furniture", "garden",
    "groceries", "food",
    "sports", "automotive", "books", "music", "art",
    "services", "fashion", "other",
  ] as const,
  CATEGORY_LABELS: {
    phones:         "Phones & Tablets",
    computers:      "Computers & Laptops",
    electronics:    "Electronics & Gadgets",
    tvs_audio:      "TVs & Audio",
    gaming:         "Gaming & Consoles",
    appliances:     "Home Appliances",
    fashion_women:  "Women's Fashion",
    fashion_men:    "Men's Fashion",
    fashion_kids:   "Kids' Fashion",
    shoes:          "Shoes & Footwear",
    bags:           "Bags & Luggage",
    watches:        "Watches",
    jewelry:        "Jewelry & Accessories",
    beauty:         "Beauty & Personal Care",
    health:         "Health & Wellness",
    baby:           "Baby & Mum",
    toys:           "Toys & Games",
    home:           "Home & Living",
    kitchen:        "Kitchen & Dining",
    furniture:      "Furniture",
    garden:         "Garden & Outdoor",
    groceries:      "Groceries",
    food:           "Food & Beverages",
    sports:         "Sports & Fitness",
    automotive:     "Automotive",
    books:          "Books & Education",
    music:          "Musical Instruments",
    art:            "Art & Crafts",
    services:       "Services",
    fashion:        "Fashion (general)",
    other:          "Other",
  } as Record<string, string>,
  CATEGORY_ICONS: {
    phones:         "📱",
    computers:      "💻",
    electronics:    "🔌",
    tvs_audio:      "📺",
    gaming:         "🎮",
    appliances:     "🧊",
    fashion_women:  "👗",
    fashion_men:    "👔",
    fashion_kids:   "🧒",
    shoes:          "👟",
    bags:           "👜",
    watches:        "⌚",
    jewelry:        "💎",
    beauty:         "💄",
    health:         "💊",
    baby:           "👶",
    toys:           "🧸",
    home:           "🏡",
    kitchen:        "🍳",
    furniture:      "🛋️",
    garden:         "🌿",
    groceries:      "🛒",
    food:           "🍔",
    sports:         "⚽",
    automotive:     "🚗",
    books:          "📚",
    music:          "🎸",
    art:            "🎨",
    services:       "🛠️",
    fashion:        "🧥",
    other:          "📦",
  } as Record<string, string>,
  TSIA_RECEIVING_TRC20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  TSIA_RECEIVING_BEP20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
  MIN_DEPOSIT: 3,
} as const;

// ─── FINTECH / WALLET TRANSFERS ──────────────────────────────────────────────
export const walletTransfers = pgTable("wallet_transfers", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  senderId:    integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  amount:      decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee:         decimal("fee",    { precision: 10, scale: 2 }).notNull().default("0.00"),
  note:        text("note"),
  status:      text("status").notNull().default("completed"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const billPayments = pgTable("bill_payments", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  service:   text("service").notNull(),
  amount:    decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reference: text("reference").notNull(),
  status:    text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWalletTransferSchema = createInsertSchema(walletTransfers).omit({ id: true, createdAt: true });
export type InsertWalletTransfer = z.infer<typeof insertWalletTransferSchema>;
export type WalletTransfer = typeof walletTransfers.$inferSelect;

export const insertBillPaymentSchema = createInsertSchema(billPayments).omit({ id: true, createdAt: true });
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type BillPayment = typeof billPayments.$inferSelect;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationTypeEnum = pgEnum("notification_type", [
  "bot_reminder", "chat_message", "order_update", "wallet_credit",
  "loan_update", "verification_update", "referral", "trade_deposit", "system",
  "wallet_activation", "qce_update", "price_drop", "new_arrival"
]);

export const notifications = pgTable("notifications", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  financialEventKey: text("financial_event_key"),
  type:      notificationTypeEnum("type").notNull(),
  title:     text("title").notNull(),
  message:   text("message").notNull(),
  data:      jsonb("data"),
  isRead:    boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  financialEventKeyUnique: uniqueIndex("notifications_financial_event_key_uq").on(table.financialEventKey),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export const financialEvents = pgTable("financial_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventKey: text("event_key").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventKeyUnique: uniqueIndex("financial_events_event_key_uq").on(table.eventKey),
}));

export const financialEventOutbox = pgTable("financial_event_outbox", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  financialEventId: integer("financial_event_id").notNull().references(() => financialEvents.id, { onDelete: "cascade" }),
  deliveryType: text("delivery_type").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
  claimedBy: text("claimed_by"),
  deliveredAt: timestamp("delivered_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  eventDeliveryUnique: uniqueIndex("financial_event_outbox_event_delivery_uq").on(table.financialEventId, table.deliveryType),
}));
export type FinancialEvent = typeof financialEvents.$inferSelect;
export type FinancialEventOutbox = typeof financialEventOutbox.$inferSelect;

// ─── CALL SESSIONS (WebRTC signaling via polling) ─────────────────────────────
export const callStatusEnum = pgEnum("call_status", ["ringing","active","ended","rejected"]);

export const callSessions = pgTable("call_sessions", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  callerId:    integer("caller_id").notNull().references(() => users.id),
  calleeId:    integer("callee_id").notNull().references(() => users.id),
  productId:   integer("product_id").references(() => products.id),
  chatId:      integer("chat_id"),
  status:      callStatusEnum("status").notNull().default("ringing"),
  callerSdp:   text("caller_sdp"),
  calleeSdp:   text("callee_sdp"),
  callerIce:   jsonb("caller_ice").default([]),
  calleeIce:   jsonb("callee_ice").default([]),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export type CallSession = typeof callSessions.$inferSelect;
export const insertCallSessionSchema = createInsertSchema(callSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;

// ─── FORUM ────────────────────────────────────────────────────────────────────
export const forumSectionEnum = pgEnum("forum_section", ["student","affiliate","both"]);

export const forumTopics = pgTable("forum_topics", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title:       text("title").notNull(),
  body:        text("body").notNull(),
  authorId:    integer("author_id").notNull().references(() => users.id),
  section:     forumSectionEnum("section").notNull().default("both"),
  tags:        text("tags").array().default([]),
  replyCount:  integer("reply_count").notNull().default(0),
  likeCount:   integer("like_count").notNull().default(0),
  isPinned:    boolean("is_pinned").notNull().default(false),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const forumPosts = pgTable("forum_posts", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  topicId:    integer("topic_id").notNull().references(() => forumTopics.id),
  content:    text("content").notNull(),
  authorId:   integer("author_id").notNull().references(() => users.id),
  likeCount:  integer("like_count").notNull().default(0),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export type ForumTopic = typeof forumTopics.$inferSelect;
export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({ id: true, replyCount: true, likeCount: true, isPinned: true, createdAt: true });
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;

export type ForumPost = typeof forumPosts.$inferSelect;
export const insertForumPostSchema = createInsertSchema(forumPosts).omit({ id: true, likeCount: true, createdAt: true });
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;

// Per-user like tracking (prevents multiple likes from one account)
export const forumTopicLikes = pgTable("forum_topic_likes", {
  topicId: integer("topic_id").notNull().references(() => forumTopics.id, { onDelete: "cascade" }),
  userId:  integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.topicId, t.userId] }) }));

export const forumPostLikes = pgTable("forum_post_likes", {
  postId: integer("post_id").notNull().references(() => forumPosts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.postId, t.userId] }) }));

// ─── ECOMMERCE CHAT ───────────────────────────────────────────────────────────
export const ecommerceChats = pgTable("ecommerce_chats", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => products.id),
  buyerId:   integer("buyer_id").notNull().references(() => users.id),
  sellerId:  integer("seller_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ecommerceChatMessages = pgTable("ecommerce_chat_messages", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chatId:     integer("chat_id").notNull().references(() => ecommerceChats.id),
  senderId:   integer("sender_id").notNull().references(() => users.id),
  content:    text("content").notNull(),
  isFlagged:  boolean("is_flagged").notNull().default(false),
  isRead:     boolean("is_read").notNull().default(false),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export const insertEcommerceChatSchema = createInsertSchema(ecommerceChats).omit({ id: true, createdAt: true });
export type InsertEcommerceChat = z.infer<typeof insertEcommerceChatSchema>;
export type EcommerceChat = typeof ecommerceChats.$inferSelect;

export const insertEcommerceChatMessageSchema = createInsertSchema(ecommerceChatMessages).omit({ id: true, createdAt: true });
export type InsertEcommerceChatMessage = z.infer<typeof insertEcommerceChatMessageSchema>;
export type EcommerceChatMessage = typeof ecommerceChatMessages.$inferSelect;

// Patterns that must be censored in chat to keep all activity on-platform
export const OFFPLATFORM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi, label: "email address" },
  { pattern: /https?:\/\/[^\s]+/gi, label: "external link" },
  { pattern: /wa\.me\/[^\s]*/gi, label: "WhatsApp link" },
  { pattern: /\b(whatsapp|wts)\b/gi, label: "WhatsApp" },
  { pattern: /\b(telegram|tg)\b/gi, label: "Telegram" },
  { pattern: /\b(instagram|insta)\b/gi, label: "Instagram" },
  { pattern: /\b(facebook|fb\.com)\b/gi, label: "Facebook" },
  { pattern: /\b(twitter|x\.com)\b/gi, label: "Twitter/X" },
  { pattern: /\b(snapchat|snap)\b/gi, label: "Snapchat" },
  { pattern: /\b(tiktok)\b/gi, label: "TikTok" },
  { pattern: /\b(signal|wechat|kik|viber|skype|discord)\b/gi, label: "messaging app" },
  { pattern: /\b(paypal|venmo|cashapp|cash\s*app|zelle)\b/gi, label: "external payment" },
  { pattern: /\b(bank\s*transfer|wire\s*transfer)\b/gi, label: "bank transfer" },
  { pattern: /\b(my\s+(number|phone|cell|mobile)\s+is)\b/gi, label: "phone number" },
  { pattern: /\b(call\s+me|text\s+me|add\s+me\s+on|find\s+me\s+on|reach\s+me\s+(on|at|via)|contact\s+me\s+(on|at|via|outside|directly))\b/gi, label: "external contact" },
  { pattern: /(?<![a-zA-Z0-9])@[a-zA-Z0-9_.]{3,30}\b/g, label: "social handle" },
  { pattern: /\b\+?(?:\d[\s.\-()\u00AD]?){8,}[\d]\b/g, label: "phone number" },
];

export function censorOffPlatform(text: string): { censored: string; flagged: boolean; labels: string[] } {
  let censored = text;
  let flagged = false;
  const labels: string[] = [];
  for (const { pattern, label } of OFFPLATFORM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      flagged = true;
      if (!labels.includes(label)) labels.push(label);
    }
    pattern.lastIndex = 0;
    censored = censored.replace(pattern, "[REMOVED]");
  }
  return { censored, flagged, labels };
}

// ─── QCE (QUICK CREDIT ELIGIBILITY) ──────────────────────────────────────────
export const QCE = {
  MIN_ACTIVATION: 2,      // $2 minimum to activate wallet and QCE
  MIN_BALANCE: 2,         // $2 minimum balance must always remain
  PERIOD_DAYS: 90,        // 90-day savings period
  MAX_ELIGIBILITY: 30,    // Up to 30% credit eligibility
} as const;

export const qceSavings = pgTable("qce_savings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  activated: boolean("activated").notNull().default(false),
  activatedAt: timestamp("activated_at"),
  startDate: timestamp("start_date"),
  daysActive: integer("days_active").notNull().default(0),
  creditPortalUnlocked: boolean("credit_portal_unlocked").notNull().default(false),
  eligibilityPercent: decimal("eligibility_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  lastContributionDate: timestamp("last_contribution_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qceTransactions = pgTable("qce_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["contribution", "withdrawal"] }).notNull(),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQceSavingsSchema = createInsertSchema(qceSavings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQceSavings = z.infer<typeof insertQceSavingsSchema>;
export type QceSavings = typeof qceSavings.$inferSelect;

export const insertQceTransactionSchema = createInsertSchema(qceTransactions).omit({ id: true, createdAt: true });
export type InsertQceTransaction = z.infer<typeof insertQceTransactionSchema>;
export type QceTransaction = typeof qceTransactions.$inferSelect;

export function calculateQceEligibility(daysActive: number, balance: number): number {
  if (balance < QCE.MIN_BALANCE) return 0;
  // Instant 30% credit eligibility on first deposit — no waiting period
  return QCE.MAX_ELIGIBILITY;
}

// ─── PRICE ALERTS & CATEGORY SUBSCRIPTIONS ───────────────────────────────────
export const priceAlerts = pgTable("price_alerts", {
  id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:         integer("user_id").notNull().references(() => users.id),
  productId:      integer("product_id").notNull().references(() => products.id),
  lastKnownPrice: decimal("last_known_price", { precision: 10, scale: 2 }).notNull(),
  active:         boolean("active").notNull().default(true),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userProductUniq: uniqueIndex("price_alerts_user_product_uq").on(table.userId, table.productId),
}));

export const categorySubscriptions = pgTable("category_subscriptions", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  category:  text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCategoryUniq: uniqueIndex("category_subs_user_category_uq").on(table.userId, table.category),
}));

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({ id: true, createdAt: true });
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;

export const insertCategorySubscriptionSchema = createInsertSchema(categorySubscriptions).omit({ id: true, createdAt: true });
export type InsertCategorySubscription = z.infer<typeof insertCategorySubscriptionSchema>;
export type CategorySubscription = typeof categorySubscriptions.$inferSelect;

// ─── SPONSOR COHORTS ─────────────────────────────────────────────────────────
export const sponsorCohorts = pgTable("sponsor_cohorts", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sponsorName: text("sponsor_name").notNull(),
  sponsorEmail: text("sponsor_email").notNull(),
  sponsorPhone: text("sponsor_phone"),
  totalSlots:  integer("total_slots").notNull(),
  usedSlots:   integer("used_slots").notNull().default(0),
  notes:       text("notes"),
  status:      text("status").notNull().default("active"),
  masterCode:  text("master_code").unique(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const cohortCodes = pgTable("cohort_codes", {
  id:           integer("id").primaryKey().generatedAlwaysAsIdentity(),
  cohortId:     integer("cohort_id").notNull().references(() => sponsorCohorts.id),
  code:         text("code").notNull().unique(),
  used:         boolean("used").notNull().default(false),
  usedByUserId: integer("used_by_user_id").references(() => users.id),
  usedAt:       timestamp("used_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const sponsorCodePurchases = pgTable("sponsor_code_purchases", {
  id:               integer("id").primaryKey().generatedAlwaysAsIdentity(),
  affiliateUserId:  integer("affiliate_user_id").references(() => users.id, { onDelete: "set null" }),
  cohortId:         integer("cohort_id").notNull().references(() => sponsorCohorts.id).unique(),
  transactionId:    integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }).unique(),
  code:             text("code").notNull().unique(),
  amountUsd:        decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  currency:         text("currency").notNull().default("USD"),
  reference:        text("reference").notNull().unique(),
  idempotencyKey:   text("idempotency_key").notNull(),
  status:           text("status").notNull().default("available"),
  redeemedByUserId: integer("redeemed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  redeemedAt:       timestamp("redeemed_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  affiliateRequestUnique: uniqueIndex("sponsor_code_purchases_affiliate_request_uq")
    .on(table.affiliateUserId, table.idempotencyKey),
}));

export const insertSponsorCohortSchema = createInsertSchema(sponsorCohorts).omit({ id: true, createdAt: true, usedSlots: true });
export type InsertSponsorCohort = z.infer<typeof insertSponsorCohortSchema>;
export type SponsorCohort = typeof sponsorCohorts.$inferSelect;

export const insertCohortCodeSchema = createInsertSchema(cohortCodes).omit({ id: true, createdAt: true });
export type InsertCohortCode = z.infer<typeof insertCohortCodeSchema>;
export type CohortCode = typeof cohortCodes.$inferSelect;
export type SponsorCodePurchase = typeof sponsorCodePurchases.$inferSelect;

// ─── SPONSORSHIP BATCHES ─────────────────────────────────────────────────────
// Tracks enrollment windows. Max per batch is server-side only — never exposed.
export const sponsorshipBatches = pgTable("sponsorship_batches", {
  id:              integer("id").primaryKey().generatedAlwaysAsIdentity(),
  batchNumber:     integer("batch_number").notNull(),
  status:          text("status").notNull().default("open"),   // "open" | "closed"
  enrollmentCount: integer("enrollment_count").notNull().default(0),
  extraSlots:      integer("extra_slots").notNull().default(0), // admin-granted overflow seats
  openedAt:        timestamp("opened_at").defaultNow().notNull(),
  closedAt:        timestamp("closed_at"),
  nextOpenAt:      timestamp("next_open_at"),                  // closedAt + 30 days
});
export type SponsorshipBatch = typeof sponsorshipBatches.$inferSelect;

// ─── WITHDRAWAL REQUESTS ──────────────────────────────────────────────────────
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:        integer("user_id").notNull().references(() => users.id),
  type:          text("type", { enum: ["bank", "crypto", "trade_bank"] }).notNull(),
  amount:        decimal("amount",     { precision: 14, scale: 2 }).notNull(),
  fee:           decimal("fee",        { precision: 14, scale: 2 }).notNull().default("0"),
  netAmount:     decimal("net_amount", { precision: 14, scale: 2 }).notNull(),
  // Bank-specific
  bankName:      text("bank_name"),
  bankCode:      text("bank_code"),
  accountNumber: text("account_number"),
  accountName:   text("account_name"),
  // Crypto-specific
  network:       text("network"),
  address:       text("address"),
  // Admin
  status:        text("status", { enum: ["pending", "approved", "declined", "refunded"] }).notNull().default("pending"),
  adminNote:     text("admin_note"),
  processedAt:   timestamp("processed_at"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({ id: true, createdAt: true });
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

// ─── WITHDRAWAL OTPs ──────────────────────────────────────────────────────────
export const withdrawalOtps = pgTable("withdrawal_otps", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id),
  code:      varchar("code", { length: 6 }).notNull(),
  purpose:   varchar("purpose", { length: 50 }).notNull().default("withdrawal"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WithdrawalOtp = typeof withdrawalOtps.$inferSelect;

// ─── PLATFORM SETTINGS ───────────────────────────────────────────────────────
export const platformSettings = pgTable("platform_settings", {
  key:       varchar("key", { length: 100 }).primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PlatformSetting = typeof platformSettings.$inferSelect;

// ─── PERSONAL ENROLLMENT INVITATIONS ─────────────────────────────────────────
// Admin can invite a specific student by email to enroll even while the batch
// is closed.  The batch's nextOpenAt countdown is untouched.
export const personalInvitations = pgTable("personal_invitations", {
  id:               serial("id").primaryKey(),
  email:            text("email").notNull(),
  name:             text("name"),
  note:             text("note"),
  used:             boolean("used").notNull().default(false),
  usedAt:           timestamp("used_at"),
  usedByUserId:     integer("used_by_user_id"),
  createdByAdminId: integer("created_by_admin_id"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});
export type PersonalInvitation = typeof personalInvitations.$inferSelect;
export const insertPersonalInvitationSchema = createInsertSchema(personalInvitations).omit({ id: true, createdAt: true });
export type InsertPersonalInvitation = z.infer<typeof insertPersonalInvitationSchema>;

// Default plan prices & tier payouts — used as fallback if DB record absent
export const DEFAULT_PLAN_PRICES = {
  plan_1yr_base: 35,
  plan_2yr_base: 45,
  plan_3yr_base: 50,
  plan_service_charge_rate: 0.10,
} as const;

export const DEFAULT_TIER_PAYOUTS = {
  tier_silver_min:   110,
  tier_silver_max:   130,
  tier_gold_min:     160,
  tier_gold_max:     180,
  tier_platinum_min: 225,
  tier_platinum_max: 230,
} as const;

// ─── VIRTUAL CARDS ────────────────────────────────────────────────────────────
export const virtualCards = pgTable("virtual_cards", {
  id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:         integer("user_id").notNull().references(() => users.id),
  cardNumber:     text("card_number").notNull(),
  cardHolder:     text("card_holder").notNull(),
  expiryMonth:    text("expiry_month").notNull(),
  expiryYear:     text("expiry_year").notNull(),
  cvv:            text("cvv").notNull(),
  status:         text("status").notNull().default("active"),
  balance:        decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  billingAddress: text("billing_address"),
  billingCity:    text("billing_city"),
  billingRegion:  text("billing_region"),
  billingZip:     text("billing_zip"),
  pin:            text("pin"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const insertVirtualCardSchema = createInsertSchema(virtualCards).omit({ id: true, createdAt: true });
export type InsertVirtualCard = z.infer<typeof insertVirtualCardSchema>;
export type VirtualCard = typeof virtualCards.$inferSelect;

// ─── MOVIE SUBSCRIPTIONS ──────────────────────────────────────────────────────
export const movieSubscriptions = pgTable("movie_subscriptions", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:     integer("user_id").notNull().references(() => users.id),
  plan:       text("plan").notNull().default("netflix"),
  status:     text("status").notNull().default("active"),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  renewedAt:  timestamp("renewed_at"),
});

export const insertMovieSubscriptionSchema = createInsertSchema(movieSubscriptions).omit({ id: true, createdAt: true });
export type InsertMovieSubscription = z.infer<typeof insertMovieSubscriptionSchema>;
export type MovieSubscription = typeof movieSubscriptions.$inferSelect;

// ─── SAVINGS GOALS ───────────────────────────────────────────────────────────
export const savingsGoals = pgTable("savings_goals", {
  id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:        integer("user_id").notNull().references(() => users.id),
  name:          text("name").notNull(),
  type:          text("type").notNull().default("flexible"),
  emoji:         text("emoji").notNull().default("🎯"),
  targetAmount:  decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  targetDate:    timestamp("target_date"),
  status:        text("status").notNull().default("active"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const savingsTransactions = pgTable("savings_transactions", {
  id:           integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:       integer("user_id").notNull().references(() => users.id),
  goalId:       integer("goal_id").notNull().references(() => savingsGoals.id),
  type:         text("type").notNull(),
  amountUsd:    decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  note:         text("note"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

export const insertSavingsTransactionSchema = createInsertSchema(savingsTransactions).omit({ id: true, createdAt: true });
export type InsertSavingsTransaction = z.infer<typeof insertSavingsTransactionSchema>;
export type SavingsTransaction = typeof savingsTransactions.$inferSelect;

// ─── TRADE BROKERS ────────────────────────────────────────────────────────────
export const TRADE_BROKERS = [
  { id: "binance",  name: "Binance",  specialty: "Crypto & Futures",    rating: 4.9, minDeposit: 50,  fee: "0.1%",      description: "World's largest crypto exchange with deep liquidity." },
  { id: "exness",   name: "Exness",   specialty: "Forex & Crypto",       rating: 4.8, minDeposit: 30,  fee: "0.3 pips",  description: "Ultra-low spreads, instant withdrawals, regulated globally." },
  { id: "octafx",   name: "OctaFX",   specialty: "Forex & CFDs",         rating: 4.7, minDeposit: 100, fee: "0.4 pips",  description: "Award-winning African forex broker with MT4/MT5 support." },
  { id: "xm_group", name: "XM Group", specialty: "Forex & Metals",       rating: 4.6, minDeposit: 50,  fee: "0.6 pips",  description: "Over 15 years of experience, 3.5M clients worldwide." },
  { id: "etoro",    name: "eToro",    specialty: "Social Copy Trading",   rating: 4.5, minDeposit: 20,  fee: "1%",        description: "Copy top traders automatically. Best for beginners." },
  { id: "bybit",    name: "Bybit",    specialty: "Crypto Derivatives",    rating: 4.7, minDeposit: 50,  fee: "0.1%",      description: "Industry-leading derivatives exchange with 100x leverage." },
  { id: "iq_option",name: "IQ Option",specialty: "Options & Crypto",     rating: 4.4, minDeposit: 30,  fee: "Variable",  description: "Intuitive platform with smart trading tools for all levels." },
  { id: "vantage",  name: "Vantage",  specialty: "Multi-Asset Trading",   rating: 4.6, minDeposit: 50,  fee: "0.2%",      description: "Next-gen multi-asset platform with AI-powered signals and zero-commission crypto." },
] as const;

// ─── SCHOLARSHIPS ─────────────────────────────────────────────────────────────
export const scholarships = pgTable("scholarships", {
  id:                  integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:              integer("user_id").notNull().references(() => users.id),
  type:                text("type").notNull(),
  status:              text("status").notNull().default("started"),
  waecRegNumber:       text("waec_reg_number"),
  waecYear:            text("waec_year"),
  waecSubjects:        text("waec_subjects"),
  waecGrades:          text("waec_grades"),
  waecPercentage:      decimal("waec_percentage", { precision: 5, scale: 2 }),
  schoolName:          text("school_name"),
  schoolLocation:      text("school_location"),
  ageDisqualified:     boolean("age_disqualified").notNull().default(false),
  portalFeePaid:       boolean("portal_fee_paid").notNull().default(false),
  commitmentFeePaid:   boolean("commitment_fee_paid").notNull().default(false),
  commitmentStartDate: timestamp("commitment_start_date"),
  testStartedAt:       timestamp("test_started_at"),
  testCompletedAt:     timestamp("test_completed_at"),
  verbalScore:         integer("verbal_score"),
  quantScore:          integer("quant_score"),
  testData:            jsonb("test_data"),
  cheatingFlag:        boolean("cheating_flag").notNull().default(false),
  prizePaid:           boolean("prize_paid").notNull().default(false),
  prizeAmount:         decimal("prize_amount", { precision: 10, scale: 2 }),
  // Masters-specific tertiary education details
  tertiarySchool:      text("tertiary_school"),
  tertiaryType:        text("tertiary_type"),    // "university" | "polytechnic"
  tertiaryYear:        text("tertiary_year"),
  tertiaryGrade:       text("tertiary_grade"),   // "first_class" | "second_upper" | "second_lower"
  // Masters MSc duration choice & year-2 renewal
  mscDuration:         text("msc_duration"),     // "1year" | "2year"
  renewalPaid:         boolean("renewal_paid").default(false),
  renewalPaidAt:       timestamp("renewal_paid_at"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});

// Recording bytes are deliberately not represented here: they live only in
// private App Storage. PostgreSQL retains the minimal immutable index needed
// for access control, retention and an auditable playback trail.
export const proctoringSessions = pgTable("proctoring_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
  assessmentType: text("assessment_type").$type<"kiddies" | "student" | "masters">().notNull(),
  childId: integer("child_id").references(() => backToSchoolChildren.id),
  backToSchoolAttemptId: integer("back_to_school_attempt_id").references(() => backToSchoolAttempts.id),
  scholarshipId: integer("scholarship_id").references(() => scholarships.id),
  consentedAt: timestamp("consented_at").notNull(),
  consentPolicyVersion: varchar("consent_policy_version", { length: 80 }).notNull(),
  status: text("status").$type<"created" | "ready" | "running" | "completed" | "interrupted" | "failed" | "deleted">().notNull().default("created"),
  cameraAvailable: boolean("camera_available").notNull().default(false),
  microphoneAvailable: boolean("microphone_available").notNull().default(false),
  deviceHealth: jsonb("device_health").notNull().default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  heartbeatCount: integer("heartbeat_count").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  totalBytes: integer("total_bytes").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  audioBytes: integer("audio_bytes").notNull().default(0),
  videoBytes: integer("video_bytes").notNull().default(0),
  audioChunkCount: integer("audio_chunk_count").notNull().default(0),
  videoChunkCount: integer("video_chunk_count").notNull().default(0),
  failureReason: text("failure_reason"),
  retentionUntil: timestamp("retention_until"),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proctoringMediaChunks = pgTable("proctoring_media_chunks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: integer("session_id").notNull().references(() => proctoringSessions.id),
  track: text("track").$type<"audio" | "video">().notNull(),
  sequence: integer("sequence").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  byteLength: integer("byte_length").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionTrackSequence: uniqueIndex("proctoring_media_chunks_session_track_sequence_uq").on(table.sessionId, table.track, table.sequence),
}));

export const proctoringPlaybackAudits = pgTable("proctoring_playback_audits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  sessionId: integer("session_id").notNull().references(() => proctoringSessions.id),
  chunkId: integer("chunk_id").references(() => proctoringMediaChunks.id),
  action: varchar("action", { length: 24 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScholarshipSchema = createInsertSchema(scholarships).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScholarship = z.infer<typeof insertScholarshipSchema>;
export type Scholarship = typeof scholarships.$inferSelect;

// ─── RESEARCH GRANTS ─────────────────────────────────────────────────────────
export const researchGrants = pgTable("research_grants", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id").notNull().references(() => users.id),
  title:              text("title").notNull(),
  fieldOfResearch:    text("field_of_research").notNull(),
  description:        text("description").notNull(),
  proposal:           text("proposal").notNull(),
  requestedAmountUsd: numeric("requested_amount_usd", { precision: 12, scale: 2 }).notNull(),
  grantedAmountUsd:   numeric("granted_amount_usd", { precision: 12, scale: 2 }),
  status:             text("status", { enum: ["pending", "under_review", "approved", "rejected"] }).notNull().default("pending"),
  adminNote:          text("admin_note"),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
});
export const insertResearchGrantSchema = createInsertSchema(researchGrants).omit({ id: true, createdAt: true, grantedAmountUsd: true, status: true, adminNote: true });
export type InsertResearchGrant = z.infer<typeof insertResearchGrantSchema>;
export type ResearchGrant = typeof researchGrants.$inferSelect;

// ─── EXCHANGE MARKET ──────────────────────────────────────────────────────────
export const exchangeOrderTypeEnum = pgEnum("exchange_order_type", ["buy", "sell"]);

export const exchangeHoldings = pgTable("exchange_holdings", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:     integer("user_id").notNull().references(() => users.id),
  ticker:     text("ticker").notNull(),
  shares:     decimal("shares",       { precision: 18, scale: 8 }).notNull().default("0"),
  avgCostUsd: decimal("avg_cost_usd", { precision: 16, scale: 6 }).notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({ uq: uniqueIndex("exch_holding_user_ticker").on(t.userId, t.ticker) }));

export const exchangeOrders = pgTable("exchange_orders", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  ticker:    text("ticker").notNull(),
  stockName: text("stock_name").notNull(),
  type:      exchangeOrderTypeEnum("type").notNull(),
  shares:    decimal("shares",    { precision: 18, scale: 8 }).notNull(),
  priceUsd:  decimal("price_usd", { precision: 16, scale: 6 }).notNull(),
  totalUsd:  decimal("total_usd", { precision: 16, scale: 6 }).notNull(),
  feeUsd:    decimal("fee_usd",   { precision: 16, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const exchangeWatchlist = pgTable("exchange_watchlist", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  ticker:    text("ticker").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uq: uniqueIndex("exch_watchlist_user_ticker").on(t.userId, t.ticker) }));

export const insertExchangeHoldingSchema = createInsertSchema(exchangeHoldings).omit({ id: true, updatedAt: true });
export type InsertExchangeHolding = z.infer<typeof insertExchangeHoldingSchema>;
export type ExchangeHolding = typeof exchangeHoldings.$inferSelect;

export const insertExchangeOrderSchema = createInsertSchema(exchangeOrders).omit({ id: true, createdAt: true });
export type InsertExchangeOrder = z.infer<typeof insertExchangeOrderSchema>;
export type ExchangeOrder = typeof exchangeOrders.$inferSelect;

export const insertExchangeWatchlistSchema = createInsertSchema(exchangeWatchlist).omit({ id: true, createdAt: true });
export type InsertExchangeWatchlist = z.infer<typeof insertExchangeWatchlistSchema>;
export type ExchangeWatchlistItem = typeof exchangeWatchlist.$inferSelect;

export const signalTradeStatusEnum = pgEnum("signal_trade_status", ["open", "won", "lost", "cancelled"]);
export const tradeDirectionEnum = pgEnum("trade_direction", ["long", "short"]);

export const signalTrades = pgTable("signal_trades", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  symbolLabel: text("symbol_label").notNull(),
  direction: tradeDirectionEnum("direction").notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
  amountUsd: decimal("amount_usd", { precision: 16, scale: 6 }).notNull(),
  pnlUsd: decimal("pnl_usd", { precision: 16, scale: 6 }),
  pnlPct: decimal("pnl_pct", { precision: 10, scale: 4 }),
  confidence: integer("confidence").notNull().default(70),
  timeframe: text("timeframe").notNull().default("15m"),
  status: signalTradeStatusEnum("status").notNull().default("open"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const manualTrades = pgTable("manual_trades", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  symbolLabel: text("symbol_label").notNull(),
  direction: tradeDirectionEnum("direction").notNull(),
  leverage: integer("leverage").notNull().default(1),
  marginUsd: decimal("margin_usd", { precision: 16, scale: 6 }).notNull(),
  sizeUsd: decimal("size_usd", { precision: 16, scale: 6 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
  stopLossPrice: decimal("stop_loss_price", { precision: 20, scale: 8 }),
  takeProfitPrice: decimal("take_profit_price", { precision: 20, scale: 8 }),
  pnlUsd: decimal("pnl_usd", { precision: 16, scale: 6 }),
  pnlPct: decimal("pnl_pct", { precision: 10, scale: 4 }),
  status: signalTradeStatusEnum("status").notNull().default("open"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── P2P USD EXCHANGE ────────────────────────────────────────────────────────
export const p2pOfferStatusEnum = pgEnum("p2p_offer_status", ["active", "paused", "completed", "cancelled"]);
export const p2pOrderStatusEnum = pgEnum("p2p_order_status", ["pending", "paid", "completed", "cancelled"]);

export const p2pOffers = pgTable("p2p_offers", {
  id:              integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sellerId:        integer("seller_id").notNull().references(() => users.id),
  amountUsd:       decimal("amount_usd",    { precision: 10, scale: 2 }).notNull(),
  availableUsd:    decimal("available_usd", { precision: 10, scale: 2 }).notNull(),
  ratePerUsd:      decimal("rate_per_usd",  { precision: 12, scale: 2 }).notNull(),
  localCurrency:   text("local_currency").notNull().default("NGN"),
  minOrderUsd:     decimal("min_order_usd", { precision: 10, scale: 2 }).notNull().default("5.00"),
  maxOrderUsd:     decimal("max_order_usd", { precision: 10, scale: 2 }).notNull(),
  paymentMethod:   text("payment_method").notNull(),
  paymentDetails:  text("payment_details").notNull(),
  status:          p2pOfferStatusEnum("status").notNull().default("active"),
  completedTrades: integer("completed_trades").notNull().default(0),
  sellerName:      text("seller_name").notNull(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const p2pOrders = pgTable("p2p_orders", {
  id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
  offerId:        integer("offer_id").notNull().references(() => p2pOffers.id),
  sellerId:       integer("seller_id").notNull().references(() => users.id),
  buyerId:        integer("buyer_id").notNull().references(() => users.id),
  amountUsd:      decimal("amount_usd",   { precision: 10, scale: 2 }).notNull(),
  ratePerUsd:     decimal("rate_per_usd", { precision: 12, scale: 2 }).notNull(),
  localCurrency:  text("local_currency").notNull(),
  localAmount:    decimal("local_amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod:  text("payment_method").notNull(),
  paymentDetails: text("payment_details").notNull(),
  status:         p2pOrderStatusEnum("status").notNull().default("pending"),
  buyerNote:      text("buyer_note"),
  paidAt:         timestamp("paid_at"),
  completedAt:    timestamp("completed_at"),
  cancelledAt:    timestamp("cancelled_at"),
  sellerName:     text("seller_name").notNull(),
  buyerName:      text("buyer_name").notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const insertP2pOfferSchema = createInsertSchema(p2pOffers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertP2pOffer = z.infer<typeof insertP2pOfferSchema>;
export type P2pOffer = typeof p2pOffers.$inferSelect;

export const insertP2pOrderSchema = createInsertSchema(p2pOrders).omit({ id: true, createdAt: true });
export type InsertP2pOrder = z.infer<typeof insertP2pOrderSchema>;
export type P2pOrder = typeof p2pOrders.$inferSelect;
