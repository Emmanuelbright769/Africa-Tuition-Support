import { eq, desc, and, gt, count, sql, ne, like, or } from "drizzle-orm";
import { db } from "./db";
import {
  users, verifications, sponsorshipPlans, wallets, transactions, disbursements,
  leadershipInquiries, otpCodes, fileUploads, coAffiliates,
  tradeWallets, tradeTransactions, tradeReserveFund, affiliateTradeShares,
  landlordProperties, tenancyLeases, tenancyPayments, loans,
  products, orders, walletDeposits, walletTransfers, billPayments,
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
  type Loan, type InsertLoan,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type WalletDeposit, type InsertWalletDeposit,
  type WalletTransfer, type BillPayment,
  TRADE_MARKET, ECOMMERCE,
} from "@shared/schema";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  getUserByEmailAndRole(email: string, role: string): Promise<User | undefined>;
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

  // Loans
  createLoan(data: InsertLoan): Promise<Loan>;
  getLoansByUser(userId: number): Promise<Loan[]>;
  getActiveLoanByUser(userId: number): Promise<Loan | undefined>;
  updateLoan(id: number, data: Partial<Loan>): Promise<Loan>;

  // Tenancy
  createLandlordProperty(data: InsertLandlordProperty): Promise<LandlordProperty>;
  getLandlordProperties(status?: string): Promise<(LandlordProperty & { owner: Pick<User,"firstName"|"lastName"|"email"> })[]>;
  getLandlordPropertiesByOwner(ownerId: number): Promise<LandlordProperty[]>;
  getLandlordProperty(id: number): Promise<LandlordProperty | undefined>;
  createTenancyLease(data: InsertTenancyLease): Promise<TenancyLease>;
  getTenancyLeasesByTenant(tenantId: number): Promise<(TenancyLease & { property: LandlordProperty })[]>;

  // E-Commerce
  createProduct(data: InsertProduct): Promise<Product>;
  getProducts(opts?: { category?: string; search?: string; sellerId?: number; status?: string }): Promise<(Product & { sellerName: string })[]>;
  getProductById(id: number): Promise<(Product & { sellerName: string }) | undefined>;
  updateProduct(id: number, data: Partial<Product>): Promise<Product>;
  createOrder(data: InsertOrder): Promise<Order>;
  getOrdersByBuyer(buyerId: number): Promise<(Order & { product: Product; sellerName: string })[]>;
  getOrdersBySeller(sellerId: number): Promise<(Order & { product: Product; buyerName: string })[]>;
  updateOrderStatus(id: number, status: string): Promise<Order>;

  // Wallet Deposits (student/user funding)
  createWalletDeposit(data: InsertWalletDeposit): Promise<WalletDeposit>;
  getWalletDepositsByUser(userId: number): Promise<WalletDeposit[]>;
  getPendingWalletDeposits(): Promise<(WalletDeposit & { user: User })[]>;
  updateWalletDeposit(id: number, data: Partial<WalletDeposit>): Promise<WalletDeposit>;

  // Fintech: P2P Transfers
  createWalletTransfer(data: { senderId: number; recipientId: number; amount: number; note?: string }): Promise<WalletTransfer>;
  getWalletTransfersByUser(userId: number): Promise<(WalletTransfer & { recipientName?: string; senderName?: string })[]>;

  // Fintech: Bill Payments
  createBillPayment(data: { userId: number; service: string; amount: number; reference: string }): Promise<BillPayment>;
  getBillPaymentsByUser(userId: number): Promise<BillPayment[]>;
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

  async getUsersByEmail(email: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.email, email));
  }

  async getUserByEmailAndRole(email: string, role: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.email, email), eq(users.role, role)));
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

  async createLoan(data: InsertLoan): Promise<Loan> {
    const [loan] = await db.insert(loans).values(data).returning();
    return loan;
  }

  async getLoansByUser(userId: number): Promise<Loan[]> {
    return db.select().from(loans).where(eq(loans.userId, userId)).orderBy(desc(loans.createdAt));
  }

  async getActiveLoanByUser(userId: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans)
      .where(and(eq(loans.userId, userId), sql`status IN ('pending','approved','active')`))
      .orderBy(desc(loans.createdAt)).limit(1);
    return loan;
  }

  async updateLoan(id: number, data: Partial<Loan>): Promise<Loan> {
    const [updated] = await db.update(loans).set(data as any).where(eq(loans.id, id)).returning();
    return updated;
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

  // ─── E-Commerce ─────────────────────────────────────────────────────────────
  async createProduct(data: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(data).returning();
    return p;
  }

  async getProducts(opts?: { category?: string; search?: string; sellerId?: number; status?: string }): Promise<(Product & { sellerName: string })[]> {
    let query = db.select({
      id: products.id, sellerId: products.sellerId, title: products.title, description: products.description,
      price: products.price, category: products.category, condition: products.condition, images: products.images,
      stock: products.stock, location: products.location, status: products.status, viewCount: products.viewCount, createdAt: products.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    }).from(products).innerJoin(users, eq(products.sellerId, users.id)).$dynamic();

    const conditions: any[] = [];
    if (opts?.category) conditions.push(eq(products.category, opts.category));
    if (opts?.sellerId) conditions.push(eq(products.sellerId, opts.sellerId));
    if (opts?.status) conditions.push(eq(products.status, opts.status as any));
    else if (!opts?.sellerId) conditions.push(eq(products.status, "active"));
    if (opts?.search) conditions.push(or(like(products.title, `%${opts.search}%`), like(products.description, `%${opts.search}%`)));
    if (conditions.length) query = query.where(and(...conditions));

    const rows = await query.orderBy(desc(products.createdAt));
    return rows.map(r => ({ ...r, sellerName: `${r.firstName} ${r.lastName}` })) as any[];
  }

  async getProductById(id: number): Promise<(Product & { sellerName: string }) | undefined> {
    const [row] = await db.select({
      id: products.id, sellerId: products.sellerId, title: products.title, description: products.description,
      price: products.price, category: products.category, condition: products.condition, images: products.images,
      stock: products.stock, location: products.location, status: products.status, viewCount: products.viewCount, createdAt: products.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    }).from(products).innerJoin(users, eq(products.sellerId, users.id)).where(eq(products.id, id));
    if (!row) return undefined;
    await db.update(products).set({ viewCount: (row.viewCount ?? 0) + 1 }).where(eq(products.id, id));
    return { ...row, sellerName: `${row.firstName} ${row.lastName}` } as any;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const [p] = await db.update(products).set(data as any).where(eq(products.id, id)).returning();
    return p;
  }

  async createOrder(data: InsertOrder): Promise<Order> {
    const [o] = await db.insert(orders).values(data).returning();
    return o;
  }

  async getOrdersByBuyer(buyerId: number): Promise<(Order & { product: Product; sellerName: string })[]> {
    const rows = await db.select().from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(users, eq(orders.sellerId, users.id))
      .where(eq(orders.buyerId, buyerId))
      .orderBy(desc(orders.createdAt));
    return rows.map(r => ({ ...(r as any).orders, product: (r as any).products, sellerName: `${(r as any).users.firstName} ${(r as any).users.lastName}` })) as any[];
  }

  async getOrdersBySeller(sellerId: number): Promise<(Order & { product: Product; buyerName: string })[]> {
    const buyerAlias = users;
    const rows = await db.select({
      ...orders, productTitle: products.title, productPrice: products.price,
      buyerFirst: buyerAlias.firstName, buyerLast: buyerAlias.lastName,
    }).from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(buyerAlias, eq(orders.buyerId, buyerAlias.id))
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt));
    return rows.map(r => ({ ...r, product: { title: r.productTitle, price: r.productPrice } as any, buyerName: `${r.buyerFirst} ${r.buyerLast}` })) as any[];
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [o] = await db.update(orders).set({ status: status as any, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return o;
  }

  // ─── Wallet Deposits ─────────────────────────────────────────────────────────
  async createWalletDeposit(data: InsertWalletDeposit): Promise<WalletDeposit> {
    const [d] = await db.insert(walletDeposits).values(data).returning();
    return d;
  }

  async getWalletDepositsByUser(userId: number): Promise<WalletDeposit[]> {
    return db.select().from(walletDeposits).where(eq(walletDeposits.userId, userId)).orderBy(desc(walletDeposits.createdAt));
  }

  async getPendingWalletDeposits(): Promise<(WalletDeposit & { user: User })[]> {
    const rows = await db.select().from(walletDeposits)
      .innerJoin(users, eq(walletDeposits.userId, users.id))
      .where(eq(walletDeposits.status, "pending"))
      .orderBy(desc(walletDeposits.createdAt));
    return rows.map(r => ({ ...(r as any).wallet_deposits, user: (r as any).users })) as any[];
  }

  async updateWalletDeposit(id: number, data: Partial<WalletDeposit>): Promise<WalletDeposit> {
    const [d] = await db.update(walletDeposits).set(data as any).where(eq(walletDeposits.id, id)).returning();
    return d;
  }

  // ── Fintech: P2P Transfers ──────────────────────────────────────────────
  async createWalletTransfer(data: { senderId: number; recipientId: number; amount: number; note?: string }): Promise<WalletTransfer> {
    const [transfer] = await db.insert(walletTransfers).values({
      senderId: data.senderId,
      recipientId: data.recipientId,
      amount: data.amount.toFixed(2),
      note: data.note || null,
      status: "completed",
    }).returning();
    return transfer;
  }

  async getWalletTransfersByUser(userId: number): Promise<(WalletTransfer & { recipientName?: string; senderName?: string })[]> {
    const rows = await db.select().from(walletTransfers)
      .where(or(eq(walletTransfers.senderId, userId), eq(walletTransfers.recipientId, userId)))
      .orderBy(desc(walletTransfers.createdAt))
      .limit(50);
    const userIds = [...new Set(rows.flatMap(r => [r.senderId, r.recipientId]))];
    const usersData = userIds.length ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(sql`id = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]`)})`) : [];
    const userMap = Object.fromEntries(usersData.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
    return rows.map(r => ({
      ...r,
      recipientName: userMap[r.recipientId] || "Unknown",
      senderName: userMap[r.senderId] || "Unknown",
    }));
  }

  // ── Fintech: Bill Payments ──────────────────────────────────────────────
  async createBillPayment(data: { userId: number; service: string; amount: number; reference: string }): Promise<BillPayment> {
    const [payment] = await db.insert(billPayments).values({
      userId: data.userId,
      service: data.service,
      amount: data.amount.toFixed(2),
      reference: data.reference,
      status: "completed",
    }).returning();
    return payment;
  }

  async getBillPaymentsByUser(userId: number): Promise<BillPayment[]> {
    return db.select().from(billPayments)
      .where(eq(billPayments.userId, userId))
      .orderBy(desc(billPayments.createdAt))
      .limit(50);
  }
}

export const storage = new DatabaseStorage();
