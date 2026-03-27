import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, jsonb, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "admin", "affiliate"]);
export const coAffiliateStatusEnum = pgEnum("co_affiliate_status", ["active", "pending", "cancelled"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);
export const tierEnum = pgEnum("tier", ["platinum", "gold", "silver", "none"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["verification_fee", "sponsorship_credit", "withdrawal", "vat_deduction"]);
export const disbursementStatusEnum = pgEnum("disbursement_status", ["pending", "approved", "rejected", "completed"]);
export const tradeWalletTypeEnum = pgEnum("trade_wallet_type", ["trc20", "bep20"]);
export const tradeTransactionTypeEnum = pgEnum("trade_transaction_type", ["deposit", "withdraw_exchange", "withdraw_bank"]);
export const tradeTransactionStatusEnum = pgEnum("trade_transaction_status", ["pending", "completed", "failed"]);

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

export const coAffiliates = pgTable("co_affiliates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  investmentCategory: integer("investment_category").notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  sharePercentage: decimal("share_percentage", { precision: 14, scale: 10 }).notNull(),
  status: coAffiliateStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tradeWallets = pgTable("trade_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  trc20Address: text("trc20_address"),
  bep20Address: text("bep20_address"),
  tradeBalance: decimal("trade_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

export const tradeReserveFund = pgTable("trade_reserve_fund", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  totalBalance: decimal("total_balance", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  totalDeposited: decimal("total_deposited", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const affiliateTradeShares = pgTable("affiliate_trade_shares", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tradeTransactionId: integer("trade_transaction_id").notNull().references(() => tradeTransactions.id),
  totalPoolAmount: decimal("total_pool_amount", { precision: 16, scale: 6 }).notNull(),
  affiliateCount: integer("affiliate_count").notNull().default(0),
  perAffiliateAmount: decimal("per_affiliate_amount", { precision: 16, scale: 6 }).notNull().default("0.000000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const CO_AFFILIATE_PROGRAM = {
  TARGET: 1_000_000,
  MILESTONE_INTERVAL: 150_000,
  PRICE_INCREASE_RATE: 0.20,
  BASE_CATEGORIES: [100, 300, 500] as const,
  SHARE_FACTOR: 0.000005,
  ELITE_MIN: 500,
  ELITE_MAX: 10_000,
} as const;

export type CoAffiliateBaseCategory = 100 | 300;
export type CoAffiliateCategory = 100 | 300 | number; // 500–10000 for elite

export const TRADE_MARKET = {
  FEE_EXCHANGE_WITHDRAW: 0.05,
  FEE_BANK_WITHDRAW: 0.08,
  RESERVE_FUND_RATE: 0.20,
  AFFILIATE_SHARE_RATE: 0.05,
  MIN_DEPOSIT: 10,
  MIN_WITHDRAW: 5,
  TSIA_RECEIVING_TRC20: "TRXTSIAWalletAddressHere",
  TSIA_RECEIVING_BEP20: "0xTSIAWalletAddressHere",
} as const;

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
  status: text("status", { enum: ["pending", "approved", "active", "repaid", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  disbursedAt: timestamp("disbursed_at"),
});

export const insertLoanSchema = createInsertSchema(loans).omit({ id: true, createdAt: true, disbursedAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;

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
  commissionRate:   decimal("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.0500"),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  sellerReceives:   decimal("seller_receives", { precision: 10, scale: 2 }).notNull(),
  status:           orderStatusEnum("status").notNull().default("pending"),
  deliveryAddress:  text("delivery_address"),
  note:             text("note"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

// Student / user wallet deposit requests (for funding main wallet via USDT)
export const walletDeposits = pgTable("wallet_deposits", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:     integer("user_id").notNull().references(() => users.id),
  amountUsd:  decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  txHash:     text("tx_hash"),
  walletType: text("wallet_type").notNull().default("trc20"),
  status:     text("status").notNull().default("pending"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, viewCount: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const insertWalletDepositSchema = createInsertSchema(walletDeposits).omit({ id: true, createdAt: true });
export type InsertWalletDeposit = z.infer<typeof insertWalletDepositSchema>;
export type WalletDeposit = typeof walletDeposits.$inferSelect;

export const ECOMMERCE = {
  COMMISSION_RATE: 0.05,  // 5% platform commission on every sale
  MIN_PRICE: 0.50,
  MAX_PRICE: 10000,
  MAX_IMAGES: 5,
  CATEGORIES: ["electronics", "fashion", "books", "food", "health", "home", "sports", "services", "other"] as const,
  CATEGORY_LABELS: {
    electronics: "Electronics & Tech",
    fashion:     "Fashion & Clothing",
    books:       "Books & Education",
    food:        "Food & Beverages",
    health:      "Health & Beauty",
    home:        "Home & Living",
    sports:      "Sports & Outdoors",
    services:    "Services",
    other:       "Other",
  } as Record<string, string>,
  CATEGORY_ICONS: {
    electronics: "💻",
    fashion:     "👗",
    books:       "📚",
    food:        "🍔",
    health:      "💊",
    home:        "🏡",
    sports:      "⚽",
    services:    "🛠️",
    other:       "📦",
  } as Record<string, string>,
  TSIA_RECEIVING_TRC20: "TRXTSIAWalletAddressHere",
  TSIA_RECEIVING_BEP20: "0xTSIAWalletAddressHere",
  MIN_DEPOSIT: 3,
} as const;

// ─── TRADE BROKERS ────────────────────────────────────────────────────────────
export const TRADE_BROKERS = [
  { id: "binance", name: "Binance", specialty: "Crypto & Futures", rating: 4.9, minDeposit: 10, fee: "0.1%", description: "World's largest crypto exchange with deep liquidity." },
  { id: "exness", name: "Exness", specialty: "Forex & Crypto", rating: 4.8, minDeposit: 10, fee: "0.3 pips", description: "Ultra-low spreads, instant withdrawals, regulated globally." },
  { id: "octafx", name: "OctaFX", specialty: "Forex & CFDs", rating: 4.7, minDeposit: 25, fee: "0.4 pips", description: "Award-winning African forex broker with MT4/MT5 support." },
  { id: "xm_group", name: "XM Group", specialty: "Forex & Metals", rating: 4.6, minDeposit: 5, fee: "0.6 pips", description: "Over 15 years of experience, 3.5M clients worldwide." },
  { id: "etoro", name: "eToro", specialty: "Social Copy Trading", rating: 4.5, minDeposit: 50, fee: "1%", description: "Copy top traders automatically. Best for beginners." },
  { id: "bybit", name: "Bybit", specialty: "Crypto Derivatives", rating: 4.7, minDeposit: 10, fee: "0.1%", description: "Industry-leading derivatives exchange with 100x leverage." },
  { id: "iq_option", name: "IQ Option", specialty: "Options & Crypto", rating: 4.4, minDeposit: 10, fee: "Variable", description: "Intuitive platform with smart trading tools for all levels." },
] as const;
