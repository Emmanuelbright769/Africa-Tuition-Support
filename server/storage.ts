import { eq, desc, and, gt, count, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, verifications, sponsorshipPlans, wallets, transactions, disbursements,
  leadershipInquiries, otpCodes, fileUploads, coAffiliates,
  tradeWallets, tradeTransactions, tradeReserveFund, affiliateTradeShares,
  landlordProperties, tenancyLeases, tenancyPayments,
  type User, type InsertUser,
  type Verification, type InsertVerification,
  type SponsorshipPlan, type InsertSponsorshipPlan,
  type Transaction, type InsertTransaction,
  type Disbursement, type InsertDisbursement,
  type LeadershipInquiry, type InsertLeadershipInquiry,
  type WalletRecord,
  type OtpCode, type InsertOtp,
  type FileUpload, type InsertFileUpload,
  type CoAffiliate, type InsertCoAffiliate,
  type TradeWallet, type InsertTradeWallet,
  type TradeTransaction, type InsertTradeTransaction,
  type LandlordProperty, type InsertLandlordProperty,
  type TenancyLease, type InsertTenancyLease,
  TRADE_MARKET,
} from "@shared/schema";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllStudents(): Promise<User[]>;
  updateUserAffiliateCode(userId: number, code: string): Promise<void>;
  getReferralsByCode(affiliateCode: string): Promise<User[]>;

  createOtp(otp: InsertOtp): Promise<OtpCode>;
  getValidOtp(email: string, code: string): Promise<OtpCode | undefined>;
  markOtpUsed(id: number): Promise<void>;

  createVerification(v: InsertVerification): Promise<Verification>;
  getVerificationByUser(userId: number): Promise<Verification | undefined>;
  updateVerification(id: number, data: Partial<Verification>): Promise<Verification>;
  getPendingVerifications(): Promise<(Verification & { user: User })[]>;

  createFileUpload(file: InsertFileUpload): Promise<FileUpload>;
  getFilesByUser(userId: number): Promise<FileUpload[]>;

  createSponsorshipPlan(plan: InsertSponsorshipPlan): Promise<SponsorshipPlan>;
  getSponsorshipPlanByUser(userId: number): Promise<SponsorshipPlan | undefined>;

  getOrCreateWallet(userId: number): Promise<WalletRecord>;
  updateWalletBalance(userId: number, amount: string): Promise<WalletRecord>;

  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;

  createDisbursement(d: InsertDisbursement): Promise<Disbursement>;
  getPendingDisbursements(): Promise<(Disbursement & { user: User })[]>;
  updateDisbursement(id: number, data: Partial<Disbursement>): Promise<Disbursement>;

  createLeadershipInquiry(inquiry: InsertLeadershipInquiry): Promise<LeadershipInquiry>;

  createCoAffiliate(data: InsertCoAffiliate): Promise<CoAffiliate>;
  getCoAffiliateByUser(userId: number): Promise<CoAffiliate | undefined>;
  getCoAffiliateCount(): Promise<number>;
  getAllCoAffiliates(): Promise<CoAffiliate[]>;
  updateCoAffiliate(userId: number, data: Partial<InsertCoAffiliate>): Promise<CoAffiliate>;

  // Trade Market
  getOrCreateTradeWallet(userId: number): Promise<TradeWallet>;
  updateTradeWalletAddresses(userId: number, trc20?: string, bep20?: string): Promise<TradeWallet>;
  updateTradeBalance(userId: number, delta: string): Promise<TradeWallet>;
  createTradeTransaction(tx: InsertTradeTransaction): Promise<TradeTransaction>;
  getTradeTransactionsByUser(userId: number): Promise<TradeTransaction[]>;
  getTradeReserveFund(): Promise<{ total_balance: string; total_deposited: string }>;
  addToReserveFund(amount: string): Promise<void>;
  recordAffiliateTradeShare(tradeTransactionId: number, poolAmount: string, affiliateCount: number, perAffiliate: string): Promise<void>;
  getAffiliateCount(): Promise<number>;

  // Tenancy
  createLandlordProperty(data: InsertLandlordProperty): Promise<LandlordProperty>;
  getLandlordProperties(status?: string): Promise<(LandlordProperty & { owner: Pick<User,"firstName"|"lastName"|"email"> })[]>;
  getLandlordPropertiesByOwner(ownerId: number): Promise<LandlordProperty[]>;
  getLandlordProperty(id: number): Promise<LandlordProperty | undefined>;
  createTenancyLease(data: InsertTenancyLease): Promise<TenancyLease>;
  getTenancyLeasesByTenant(tenantId: number): Promise<(TenancyLease & { property: LandlordProperty })[]>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    await db.insert(wallets).values({ userId: created.id, balance: "0.00" });
    return created;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllStudents(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "student")).orderBy(desc(users.createdAt));
  }

  async updateUserAffiliateCode(userId: number, code: string): Promise<void> {
    await db.update(users).set({ affiliateCode: code }).where(eq(users.id, userId));
  }

  async getReferralsByCode(affiliateCode: string): Promise<User[]> {
    if (!affiliateCode) return [];
    return db.select().from(users).where(eq(users.referredBy, affiliateCode)).orderBy(desc(users.createdAt));
  }

  async createOtp(otp: InsertOtp): Promise<OtpCode> {
    const [created] = await db.insert(otpCodes).values(otp).returning();
    return created;
  }

  async getValidOtp(email: string, code: string): Promise<OtpCode | undefined> {
    const [otp] = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.email, email),
        eq(otpCodes.code, code),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date())
      ))
      .orderBy(desc(otpCodes.createdAt));
    return otp;
  }

  async markOtpUsed(id: number): Promise<void> {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, id));
  }

  async createVerification(v: InsertVerification): Promise<Verification> {
    const [created] = await db.insert(verifications).values(v).returning();
    return created;
  }

  async getVerificationByUser(userId: number): Promise<Verification | undefined> {
    const [v] = await db.select().from(verifications).where(eq(verifications.userId, userId));
    return v;
  }

  async updateVerification(id: number, data: Partial<Verification>): Promise<Verification> {
    const [updated] = await db.update(verifications).set(data).where(eq(verifications.id, id)).returning();
    return updated;
  }

  async getPendingVerifications(): Promise<(Verification & { user: User })[]> {
    const results = await db
      .select()
      .from(verifications)
      .innerJoin(users, eq(verifications.userId, users.id))
      .where(eq(verifications.status, "pending"));
    return results.map(r => ({ ...r.verifications, user: r.users }));
  }

  async createFileUpload(file: InsertFileUpload): Promise<FileUpload> {
    const [created] = await db.insert(fileUploads).values(file).returning();
    return created;
  }

  async getFilesByUser(userId: number): Promise<FileUpload[]> {
    return db.select().from(fileUploads).where(eq(fileUploads.userId, userId)).orderBy(desc(fileUploads.createdAt));
  }

  async createSponsorshipPlan(plan: InsertSponsorshipPlan): Promise<SponsorshipPlan> {
    const [created] = await db.insert(sponsorshipPlans).values(plan).returning();
    return created;
  }

  async getSponsorshipPlanByUser(userId: number): Promise<SponsorshipPlan | undefined> {
    const [plan] = await db.select().from(sponsorshipPlans).where(eq(sponsorshipPlans.userId, userId)).orderBy(desc(sponsorshipPlans.createdAt));
    return plan;
  }

  async getOrCreateWallet(userId: number): Promise<WalletRecord> {
    const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (existing) return existing;
    const [created] = await db.insert(wallets).values({ userId, balance: "0.00" }).returning();
    return created;
  }

  async updateWalletBalance(userId: number, amount: string): Promise<WalletRecord> {
    const wallet = await this.getOrCreateWallet(userId);
    const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);
    const [updated] = await db.update(wallets).set({ balance: newBalance }).where(eq(wallets.userId, userId)).returning();
    return updated;
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(tx).returning();
    return created;
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }

  async createDisbursement(d: InsertDisbursement): Promise<Disbursement> {
    const [created] = await db.insert(disbursements).values(d).returning();
    return created;
  }

  async getPendingDisbursements(): Promise<(Disbursement & { user: User })[]> {
    const results = await db
      .select()
      .from(disbursements)
      .innerJoin(users, eq(disbursements.userId, users.id))
      .where(eq(disbursements.status, "pending"));
    return results.map(r => ({ ...r.disbursements, user: r.users }));
  }

  async updateDisbursement(id: number, data: Partial<Disbursement>): Promise<Disbursement> {
    const [updated] = await db.update(disbursements).set(data).where(eq(disbursements.id, id)).returning();
    return updated;
  }

  async createLeadershipInquiry(inquiry: InsertLeadershipInquiry): Promise<LeadershipInquiry> {
    const [created] = await db.insert(leadershipInquiries).values(inquiry).returning();
    return created;
  }

  async createCoAffiliate(data: InsertCoAffiliate): Promise<CoAffiliate> {
    const [created] = await db.insert(coAffiliates).values(data).returning();
    return created;
  }

  async getCoAffiliateByUser(userId: number): Promise<CoAffiliate | undefined> {
    const [row] = await db.select().from(coAffiliates).where(eq(coAffiliates.userId, userId));
    return row;
  }

  async getCoAffiliateCount(): Promise<number> {
    const [result] = await db.select({ total: count() }).from(coAffiliates).where(eq(coAffiliates.status, "active"));
    return result?.total ?? 0;
  }

  async getAllCoAffiliates(): Promise<CoAffiliate[]> {
    return db.select().from(coAffiliates).orderBy(desc(coAffiliates.createdAt));
  }

  async updateCoAffiliate(userId: number, data: Partial<InsertCoAffiliate>): Promise<CoAffiliate> {
    const [updated] = await db.update(coAffiliates).set({ ...data, updatedAt: new Date() }).where(eq(coAffiliates.userId, userId)).returning();
    return updated;
  }

  async getOrCreateTradeWallet(userId: number): Promise<TradeWallet> {
    const [existing] = await db.select().from(tradeWallets).where(eq(tradeWallets.userId, userId));
    if (existing) return existing;
    const [created] = await db.insert(tradeWallets).values({ userId, tradeBalance: "0.000000" }).returning();
    return created;
  }

  async updateTradeWalletAddresses(userId: number, trc20?: string, bep20?: string): Promise<TradeWallet> {
    const updates: any = { updatedAt: new Date() };
    if (trc20 !== undefined) updates.trc20Address = trc20;
    if (bep20 !== undefined) updates.bep20Address = bep20;
    const [updated] = await db.update(tradeWallets).set(updates).where(eq(tradeWallets.userId, userId)).returning();
    return updated;
  }

  async updateTradeBalance(userId: number, delta: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ tradeBalance: sql`trade_balance + ${delta}::decimal`, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async createTradeTransaction(tx: InsertTradeTransaction): Promise<TradeTransaction> {
    const [created] = await db.insert(tradeTransactions).values(tx).returning();
    return created;
  }

  async getTradeTransactionsByUser(userId: number): Promise<TradeTransaction[]> {
    return db.select().from(tradeTransactions).where(eq(tradeTransactions.userId, userId)).orderBy(desc(tradeTransactions.createdAt));
  }

  async getTradeReserveFund(): Promise<{ total_balance: string; total_deposited: string }> {
    const [row] = await db.select().from(tradeReserveFund);
    return { total_balance: row?.totalBalance ?? "0", total_deposited: row?.totalDeposited ?? "0" };
  }

  async addToReserveFund(amount: string): Promise<void> {
    await db.update(tradeReserveFund).set({
      totalBalance: sql`total_balance + ${amount}::decimal`,
      totalDeposited: sql`total_deposited + ${amount}::decimal`,
      updatedAt: new Date(),
    });
  }

  async recordAffiliateTradeShare(tradeTransactionId: number, poolAmount: string, affiliateCount: number, perAffiliate: string): Promise<void> {
    await db.insert(affiliateTradeShares).values({ tradeTransactionId, totalPoolAmount: poolAmount, affiliateCount, perAffiliateAmount: perAffiliate });
  }

  async getAffiliateCount(): Promise<number> {
    const [result] = await db.select({ total: count() }).from(users).where(eq(users.role, "affiliate"));
    return result?.total ?? 0;
  }

  async createLandlordProperty(data: InsertLandlordProperty): Promise<LandlordProperty> {
    const [prop] = await db.insert(landlordProperties).values(data).returning();
    return prop;
  }

  async getLandlordProperties(status?: string): Promise<(LandlordProperty & { owner: Pick<User,"firstName"|"lastName"|"email"> })[]> {
    const rows = await db.select({
      id: landlordProperties.id, ownerId: landlordProperties.ownerId,
      propertyName: landlordProperties.propertyName, address: landlordProperties.address,
      city: landlordProperties.city, state: landlordProperties.state, country: landlordProperties.country,
      propertyType: landlordProperties.propertyType, bedrooms: landlordProperties.bedrooms, bathrooms: landlordProperties.bathrooms,
      annualRentNgn: landlordProperties.annualRentNgn, leasePeriodYears: landlordProperties.leasePeriodYears,
      discountRate: landlordProperties.discountRate, tsiaPaymentNgn: landlordProperties.tsiaPaymentNgn,
      tenantInterestRate: landlordProperties.tenantInterestRate, description: landlordProperties.description,
      amenities: landlordProperties.amenities, status: landlordProperties.status, createdAt: landlordProperties.createdAt,
      ownerFirstName: users.firstName, ownerLastName: users.lastName, ownerEmail: users.email,
    }).from(landlordProperties).innerJoin(users, eq(landlordProperties.ownerId, users.id))
      .where(status ? eq(landlordProperties.status, status as any) : undefined)
      .orderBy(desc(landlordProperties.createdAt));
    return rows.map(r => ({ ...r, owner: { firstName: r.ownerFirstName, lastName: r.ownerLastName, email: r.ownerEmail } })) as any;
  }

  async getLandlordPropertiesByOwner(ownerId: number): Promise<LandlordProperty[]> {
    return db.select().from(landlordProperties).where(eq(landlordProperties.ownerId, ownerId)).orderBy(desc(landlordProperties.createdAt));
  }

  async getLandlordProperty(id: number): Promise<LandlordProperty | undefined> {
    const [prop] = await db.select().from(landlordProperties).where(eq(landlordProperties.id, id));
    return prop;
  }

  async createTenancyLease(data: InsertTenancyLease): Promise<TenancyLease> {
    const [lease] = await db.insert(tenancyLeases).values(data).returning();
    return lease;
  }

  async getTenancyLeasesByTenant(tenantId: number): Promise<(TenancyLease & { property: LandlordProperty })[]> {
    const rows = await db.select().from(tenancyLeases)
      .innerJoin(landlordProperties, eq(tenancyLeases.propertyId, landlordProperties.id))
      .where(eq(tenancyLeases.tenantId, tenantId))
      .orderBy(desc(tenancyLeases.createdAt));
    return rows.map(r => ({ ...(r as any).tenancyLeases, property: (r as any).landlordProperties }));
  }
}

export const storage = new DatabaseStorage();
