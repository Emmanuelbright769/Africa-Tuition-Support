import { eq, desc, and, gt } from "drizzle-orm";
import { db } from "./db";
import {
  users, verifications, sponsorshipPlans, wallets, transactions, disbursements, leadershipInquiries, otpCodes, fileUploads,
  type User, type InsertUser,
  type Verification, type InsertVerification,
  type SponsorshipPlan, type InsertSponsorshipPlan,
  type Transaction, type InsertTransaction,
  type Disbursement, type InsertDisbursement,
  type LeadershipInquiry, type InsertLeadershipInquiry,
  type WalletRecord,
  type OtpCode, type InsertOtp,
  type FileUpload, type InsertFileUpload,
} from "@shared/schema";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllStudents(): Promise<User[]>;

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
}

export const storage = new DatabaseStorage();
