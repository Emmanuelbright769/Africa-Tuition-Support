import { eq, desc, and, gt, gte, lte, count, sql, ne, like, ilike, or, not, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  users, verifications, sponsorshipPlans, wallets, transactions, disbursements,
  leadershipInquiries, otpCodes, fileUploads, coAffiliates,
  tradeWallets, tradeTransactions, tradeReserveFund, affiliateTradeShares,
  landlordProperties, tenancyLeases, tenancyPayments, loans,
  products, orders, orderTracking, walletDeposits, walletTransfers, billPayments,
  productRatings,
  ecommerceChats, ecommerceChatMessages,
  notifications, callSessions, forumTopics, forumPosts,
  qceSavings, qceTransactions,
  priceAlerts, categorySubscriptions,
  sponsorCohorts, cohortCodes, sponsorshipBatches,
  withdrawalRequests, withdrawalOtps,
  platformSettings, type PlatformSetting, DEFAULT_PLAN_PRICES, DEFAULT_TIER_PAYOUTS,
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
  type ProductRating, type InsertProductRating,
  type Order, type InsertOrder,
  type OrderTracking, type InsertOrderTracking,
  type WalletDeposit, type InsertWalletDeposit,
  type WalletTransfer, type BillPayment,
  type EcommerceChat, type InsertEcommerceChat,
  type EcommerceChatMessage, type InsertEcommerceChatMessage,
  type Notification, type InsertNotification,
  type CallSession, type InsertCallSession,
  type ForumTopic, type InsertForumTopic,
  type ForumPost, type InsertForumPost,
  tourBookings,
  type TourBooking, type InsertTourBooking,
  type QceSavings, type QceTransaction,
  type PriceAlert, type CategorySubscription,
  type SponsorCohort, type InsertSponsorCohort,
  type CohortCode,
  type SponsorshipBatch,
  TRADE_MARKET, ECOMMERCE, QCE, calculateQceEligibility,
} from "@shared/schema";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  deleteUserById(id: number): Promise<void>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  getUserByEmailAndRole(email: string, role: string): Promise<User | undefined>;
  searchMembersByEmail(query: string, excludeUserId: number): Promise<{ id: number; firstName: string; lastName: string; email: string }[]>;
  getAllStudents(): Promise<User[]>;
  updateUserAffiliateCode(userId: number, code: string): Promise<void>;
  getReferralsByCode(affiliateCode: string): Promise<User[]>;
  getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined>;

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
  recordCoAffiliateWithdrawal(userId: number, amount: string): Promise<CoAffiliate>;
  getTotalCoAffiliateFund(): Promise<number>;
  getTotalAffiliatePool(): Promise<number>;

  // Trade Market
  getOrCreateTradeWallet(userId: number): Promise<TradeWallet>;
  updateTradeWalletAddresses(userId: number, trc20?: string, bep20?: string): Promise<TradeWallet>;
  updateTradeBalance(userId: number, delta: string): Promise<TradeWallet>;
  addToTotalInvested(userId: number, amount: string): Promise<TradeWallet>;
  markRoiComplete(userId: number): Promise<TradeWallet>;
  resetRoiForNewCycle(userId: number): Promise<void>;
  addToLockedPrincipal(userId: number, amount: string): Promise<TradeWallet>;
  clearLockedPrincipal(userId: number): Promise<TradeWallet>;
  addReferralCommission(userId: number, amount: string): Promise<TradeWallet>;
  subtractReferralCommission(userId: number, amount: string): Promise<TradeWallet>;
  setBotActivatedAt(userId: number, ts: Date | null): Promise<TradeWallet>;
  creditBotEarnings(userId: number, earningAmount: string): Promise<TradeWallet>;
  applyBotLoss(userId: number, lossAmount: string): Promise<TradeWallet>;
  createTradeTransaction(tx: InsertTradeTransaction): Promise<TradeTransaction>;
  getTradeTransactionsByUser(userId: number): Promise<TradeTransaction[]>;
  getTradeReserveFund(): Promise<{ total_balance: string; total_deposited: string }>;
  addToReserveFund(amount: string): Promise<void>;
  recordAffiliateTradeShare(tradeTransactionId: number | null, poolAmount: string, affiliateCount: number, perAffiliate: string, sourceType?: string): Promise<void>;
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
  rateProduct(data: InsertProductRating): Promise<ProductRating>;
  getProductRatings(productId: number): Promise<(ProductRating & { userName: string })[]>;
  getProductRatingSummary(productId: number): Promise<{ avgRating: number; count: number }>;
  getUserRatingForProduct(productId: number, userId: number): Promise<ProductRating | undefined>;
  createOrder(data: InsertOrder): Promise<Order>;
  getOrderById(id: number): Promise<Order | undefined>;
  getOrdersByBuyer(buyerId: number): Promise<(Order & { product: Product; sellerName: string })[]>;
  getOrdersBySeller(sellerId: number): Promise<(Order & { product: Product; buyerName: string })[]>;
  updateOrderStatus(id: number, status: string, extra?: { trackingNumber?: string; escrowReleased?: boolean }): Promise<Order>;
  createOrderTracking(data: { orderId: number; statusLabel: string; description: string; location?: string }): Promise<OrderTracking>;
  getOrderTracking(orderId: number): Promise<OrderTracking[]>;

  // E-Commerce Chat
  getOrCreateChat(productId: number, buyerId: number, sellerId: number): Promise<EcommerceChat>;
  getChatMessages(chatId: number): Promise<(EcommerceChatMessage & { senderName: string })[]>;
  createChatMessage(data: InsertEcommerceChatMessage): Promise<EcommerceChatMessage>;
  markChatMessagesRead(chatId: number, readerId: number): Promise<void>;
  getUserChats(userId: number): Promise<(EcommerceChat & { productTitle: string; otherPersonName: string; lastMessage?: string; lastMessageAt?: string; unread: number })[]>;

  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  markAllNotificationsRead(userId: number): Promise<void>;
  clearNotifications(userId: number): Promise<void>;
  hasBotReminderToday(userId: number, reminderType: string): Promise<boolean>;

  // Calls
  createCallSession(data: InsertCallSession): Promise<CallSession>;
  getCallSession(id: number): Promise<CallSession | undefined>;
  updateCallSession(id: number, patch: Partial<CallSession>): Promise<CallSession>;
  getIncomingCall(calleeId: number): Promise<CallSession | undefined>;
  endStaleCalls(userId: number): Promise<void>;

  // Forum
  getForumTopics(section: string, search?: string): Promise<(ForumTopic & { authorName: string })[]>;
  getForumTopic(id: number): Promise<(ForumTopic & { authorName: string }) | undefined>;
  createForumTopic(data: InsertForumTopic): Promise<ForumTopic>;
  getForumPosts(topicId: number): Promise<(ForumPost & { authorName: string })[]>;
  createForumPost(data: InsertForumPost): Promise<ForumPost>;
  likeForumTopic(id: number): Promise<void>;
  likeForumPost(id: number): Promise<void>;

  // Wallet Deposits (student/user funding)
  createWalletDeposit(data: InsertWalletDeposit): Promise<WalletDeposit>;
  getWalletDepositsByUser(userId: number): Promise<WalletDeposit[]>;
  getPendingWalletDeposits(): Promise<(WalletDeposit & { user: User })[]>;
  updateWalletDeposit(id: number, data: Partial<WalletDeposit>): Promise<WalletDeposit>;
  deleteWalletDeposit(id: number): Promise<void>;

  // Fintech: P2P Transfers
  createWalletTransfer(data: { senderId: number; recipientId: number; amount: number; note?: string }): Promise<WalletTransfer>;
  getWalletTransfersByUser(userId: number): Promise<(WalletTransfer & { recipientName?: string; senderName?: string })[]>;

  // Fintech: Bill Payments
  createBillPayment(data: { userId: number; service: string; amount: number; reference: string }): Promise<BillPayment>;
  getBillPaymentsByUser(userId: number): Promise<BillPayment[]>;

  // Tour Africa Bookings
  createTourBooking(data: InsertTourBooking): Promise<TourBooking>;
  getTourBookingsByUser(userId: number): Promise<TourBooking[]>;

  // QCE (Quick Credit Eligibility)
  getOrCreateQceSavings(userId: number): Promise<QceSavings>;
  updateQceSavings(userId: number, data: Partial<QceSavings>): Promise<QceSavings>;
  contributeToQce(userId: number, amountUsd: number): Promise<{ savings: QceSavings; transaction: QceTransaction }>;
  withdrawFromQce(userId: number, amountUsd: number): Promise<{ savings: QceSavings; transaction: QceTransaction }>;
  getQceTransactions(userId: number): Promise<QceTransaction[]>;
  tickQceDays(userId: number): Promise<QceSavings>;

  // Price Alerts
  upsertPriceAlert(userId: number, productId: number, lastKnownPrice: string): Promise<PriceAlert>;
  deletePriceAlert(userId: number, productId: number): Promise<void>;
  getUserPriceAlertProductIds(userId: number): Promise<number[]>;
  getPriceAlertsForProduct(productId: number): Promise<PriceAlert[]>;
  updatePriceAlertLastKnown(userId: number, productId: number, price: string): Promise<void>;

  // Category Subscriptions
  upsertCategorySubscription(userId: number, category: string): Promise<CategorySubscription>;
  deleteCategorySubscription(userId: number, category: string): Promise<void>;
  getUserCategorySubscriptions(userId: number): Promise<string[]>;
  getCategorySubscribers(category: string): Promise<number[]>;

  // Sponsor Cohorts
  createSponsorCohort(data: InsertSponsorCohort): Promise<{ cohort: SponsorCohort; codes: CohortCode[] }>;
  getSponsorCohorts(): Promise<(SponsorCohort & { codes: CohortCode[] })[]>;
  getSponsorCohortById(id: number): Promise<(SponsorCohort & { codes: CohortCode[] }) | undefined>;
  validateSponsorCode(code: string): Promise<{ valid: boolean; cohortName?: string; reason?: string }>;
  useSponsorCode(code: string, userId: number): Promise<void>;

  // Sponsorship Batches
  getCurrentBatch(): Promise<SponsorshipBatch | null>;
  getAllBatches(): Promise<SponsorshipBatch[]>;
  createBatch(batchNumber: number): Promise<SponsorshipBatch>;
  incrementBatchEnrollment(id: number, maxSize: number): Promise<{ batch: SponsorshipBatch; wasClosed: boolean }>;

  // Wallet activation
  activateWallet(userId: number): Promise<WalletRecord>;

  // Referral stats (activated vs pending)
  getActivatedReferralsByCode(affiliateCode: string): Promise<User[]>;

  // Withdrawal OTPs
  createWithdrawalOtp(userId: number, code: string, purpose: string): Promise<void>;
  verifyAndConsumeWithdrawalOtp(userId: number, code: string, purpose: string): Promise<boolean>;

  // Platform settings
  getPlatformSetting(key: string): Promise<string | null>;
  getAllPlatformSettings(): Promise<PlatformSetting[]>;
  setPlatformSetting(key: string, value: string): Promise<void>;
  getPlanPrices(): Promise<{ plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }>;
  getTierPayouts(): Promise<{ silver: { min: number; max: number }; gold: { min: number; max: number }; platinum: { min: number; max: number } }>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    await db.insert(wallets).values({ userId: created.id, balance: "0.00" });
    return created;
  }

  async deleteUserById(id: number): Promise<void> {
    // Fetch user email first (needed for OTP codes which are keyed by email, not user_id)
    const [targetUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, id));
    const userEmail = targetUser?.email;

    // Must delete all related records in dependency order before removing the user
    await db.transaction(async (tx) => {
      // 1. ecommerce chat messages — delete any message where this user is the sender
      //    OR the message belongs to a chat they own (buyer/seller). Must do sender first
      //    to avoid FK violation when deleting the user row.
      await tx.execute(sql`
        DELETE FROM ecommerce_chat_messages
        WHERE sender_id = ${id}
           OR chat_id IN (
             SELECT id FROM ecommerce_chats WHERE buyer_id = ${id} OR seller_id = ${id}
           )
      `);
      // 2. ecommerce chats
      await tx.delete(ecommerceChats).where(
        or(eq(ecommerceChats.buyerId, id), eq(ecommerceChats.sellerId, id))
      );
      // 3. product ratings (depends on products)
      await tx.delete(productRatings).where(eq(productRatings.userId, id));
      // Also delete ratings for products owned by this seller
      await tx.execute(sql`
        DELETE FROM product_ratings WHERE product_id IN (SELECT id FROM products WHERE seller_id = ${id})
      `);
      // 4. price alerts
      await tx.delete(priceAlerts).where(eq(priceAlerts.userId, id));
      // 5. orders where user is buyer or seller
      await tx.delete(orders).where(
        or(eq(orders.buyerId, id), eq(orders.sellerId, id))
      );
      // Also delete any orders for products sold by this user (from other buyers)
      await tx.execute(sql`
        DELETE FROM orders WHERE product_id IN (SELECT id FROM products WHERE seller_id = ${id})
      `);
      // 6. products (seller)
      await tx.delete(products).where(eq(products.sellerId, id));
      // 7. call sessions
      await tx.delete(callSessions).where(
        or(eq(callSessions.callerId, id), eq(callSessions.calleeId, id))
      );
      // 8. category subscriptions
      await tx.delete(categorySubscriptions).where(eq(categorySubscriptions.userId, id));
      // 9. bill payments
      await tx.delete(billPayments).where(eq(billPayments.userId, id));
      // 10. wallet transfers
      await tx.delete(walletTransfers).where(
        or(eq(walletTransfers.senderId, id), eq(walletTransfers.recipientId, id))
      );
      // 10a. withdrawal OTPs
      await tx.delete(withdrawalOtps).where(eq(withdrawalOtps.userId, id));
      // 10b. withdrawal requests
      await tx.delete(withdrawalRequests).where(eq(withdrawalRequests.userId, id));
      // 11. transactions
      await tx.delete(transactions).where(eq(transactions.userId, id));
      // 12. disbursements
      await tx.delete(disbursements).where(eq(disbursements.userId, id));
      // 13. wallet deposits
      await tx.delete(walletDeposits).where(eq(walletDeposits.userId, id));
      // 14. trade transactions
      await tx.delete(tradeTransactions).where(eq(tradeTransactions.userId, id));
      // 15. qce transactions
      await tx.delete(qceTransactions).where(eq(qceTransactions.userId, id));
      // 16. qce savings
      await tx.delete(qceSavings).where(eq(qceSavings.userId, id));
      // 17. trade wallets
      await tx.delete(tradeWallets).where(eq(tradeWallets.userId, id));
      // 18. wallets
      await tx.delete(wallets).where(eq(wallets.userId, id));
      // 19. verifications
      await tx.delete(verifications).where(eq(verifications.userId, id));
      // 20. notifications
      await tx.delete(notifications).where(eq(notifications.userId, id));
      // 21. co-affiliates
      await tx.delete(coAffiliates).where(eq(coAffiliates.userId, id));
      // 22. cohort codes (used_by reference)
      await tx.execute(sql`UPDATE cohort_codes SET used_by_user_id = NULL WHERE used_by_user_id = ${id}`);
      // 23. sponsorship plans
      await tx.delete(sponsorshipPlans).where(eq(sponsorshipPlans.userId, id));
      // 24. tenancy payments (depend on leases)
      await tx.execute(sql`
        DELETE FROM tenancy_payments WHERE lease_id IN (
          SELECT id FROM tenancy_leases WHERE tenant_id = ${id}
        )
      `);
      // 25. tenancy leases (as tenant)
      await tx.delete(tenancyLeases).where(eq(tenancyLeases.tenantId, id));
      // 26. landlord properties (tenancy_leases referencing these are already gone)
      await tx.execute(sql`
        DELETE FROM tenancy_payments WHERE lease_id IN (
          SELECT id FROM tenancy_leases WHERE property_id IN (SELECT id FROM landlord_properties WHERE owner_id = ${id})
        )
      `);
      await tx.execute(sql`
        DELETE FROM tenancy_leases WHERE property_id IN (SELECT id FROM landlord_properties WHERE owner_id = ${id})
      `);
      await tx.delete(landlordProperties).where(eq(landlordProperties.ownerId, id));
      // 27. forum posts
      await tx.delete(forumPosts).where(eq(forumPosts.authorId, id));
      // 28. forum topics
      await tx.delete(forumTopics).where(eq(forumTopics.authorId, id));
      // 29. file uploads
      await tx.delete(fileUploads).where(eq(fileUploads.userId, id));
      // 30. loans
      await tx.delete(loans).where(eq(loans.userId, id));
      // 31. otp codes — keyed by email, not user_id
      if (userEmail) {
        await tx.delete(otpCodes).where(eq(otpCodes.email, userEmail));
      }
      // 32. tour bookings
      await tx.delete(tourBookings).where(eq(tourBookings.userId, id));
      // 33. finally delete the user
      await tx.delete(users).where(eq(users.id, id));
    });
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

  async searchMembersByEmail(query: string, excludeUserId: number): Promise<{ id: number; firstName: string; lastName: string; email: string }[]> {
    const rows = await db
      .selectDistinctOn([users.email], {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(ilike(users.email, `%${query}%`), ne(users.id, excludeUserId)))
      .orderBy(users.email)
      .limit(8);
    return rows;
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

  async getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.affiliateCode, affiliateCode)).limit(1);
    return u;
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

  async updateWalletBalance(userId: number, newBalance: string): Promise<WalletRecord> {
    await this.getOrCreateWallet(userId);
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

  async recordCoAffiliateWithdrawal(userId: number, amount: string): Promise<CoAffiliate> {
    const [updated] = await db.update(coAffiliates)
      .set({ withdrawnAmount: sql`withdrawn_amount + ${amount}::decimal` })
      .where(eq(coAffiliates.userId, userId))
      .returning();
    return updated;
  }

  async getTotalCoAffiliateFund(): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(amount_paid), 0)` }).from(coAffiliates).where(eq(coAffiliates.status, "active"));
    return parseFloat(result?.total ?? "0");
  }

  async getTotalAffiliatePool(): Promise<number> {
    const [result] = await db.select({ total: sql<string>`COALESCE(SUM(total_pool_amount), 0)` }).from(affiliateTradeShares);
    return parseFloat(result?.total ?? "0");
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

  async addToTotalInvested(userId: number, amount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ totalInvested: sql`total_invested + ${amount}::decimal`, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async markRoiComplete(userId: number): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ roiComplete: true, lockedPrincipal: "0.000000", botActivatedAt: null, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async addToLockedPrincipal(userId: number, amount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ lockedPrincipal: sql`locked_principal + ${amount}::decimal`, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async clearLockedPrincipal(userId: number): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ lockedPrincipal: "0.000000", updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async resetRoiForNewCycle(userId: number): Promise<void> {
    await db.update(tradeWallets)
      .set({ roiComplete: false, totalBotEarnings: "0.000000", totalInvested: "0.000000", lockedPrincipal: "0.000000", updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId));
  }

  async addReferralCommission(userId: number, amount: string): Promise<TradeWallet> {
    await this.getOrCreateTradeWallet(userId);
    const [updated] = await db.update(tradeWallets)
      .set({ referralCommissionBalance: sql`referral_commission_balance + ${amount}::decimal`, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async subtractReferralCommission(userId: number, amount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ referralCommissionBalance: sql`GREATEST(referral_commission_balance - ${amount}::decimal, 0)`, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async setBotActivatedAt(userId: number, ts: Date | null): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ botActivatedAt: ts, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async creditBotEarnings(userId: number, earningAmount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({
        tradeBalance: sql`trade_balance + ${earningAmount}::decimal`,
        totalBotEarnings: sql`total_bot_earnings + ${earningAmount}::decimal`,
        botActivatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async applyBotLoss(userId: number, lossAmount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({
        tradeBalance: sql`GREATEST(trade_balance - ${lossAmount}::decimal, 0)`,
        botActivatedAt: null,
        updatedAt: new Date(),
      })
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

  async recordAffiliateTradeShare(tradeTransactionId: number | null, poolAmount: string, affiliateCount: number, perAffiliate: string, sourceType = "trade"): Promise<void> {
    await db.insert(affiliateTradeShares).values({ tradeTransactionId: tradeTransactionId ?? null, totalPoolAmount: poolAmount, affiliateCount, perAffiliateAmount: perAffiliate, sourceType });
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

  async getProducts(opts?: { category?: string; search?: string; sellerId?: number; status?: string }): Promise<(Product & { sellerName: string; sellerEmail: string })[]> {
    let query = db.select({
      id: products.id, sellerId: products.sellerId, title: products.title, description: products.description,
      price: products.price, category: products.category, condition: products.condition, images: products.images,
      stock: products.stock, location: products.location, status: products.status, viewCount: products.viewCount, createdAt: products.createdAt,
      firstName: users.firstName, lastName: users.lastName, email: users.email,
    }).from(products).innerJoin(users, eq(products.sellerId, users.id)).$dynamic();

    const conditions: any[] = [];
    if (opts?.category) conditions.push(eq(products.category, opts.category));
    if (opts?.sellerId) conditions.push(eq(products.sellerId, opts.sellerId));
    if (opts?.status) conditions.push(eq(products.status, opts.status as any));
    else if (!opts?.sellerId) conditions.push(eq(products.status, "active"));
    if (opts?.search) conditions.push(or(like(products.title, `%${opts.search}%`), like(products.description, `%${opts.search}%`)));
    if (conditions.length) query = query.where(and(...conditions));

    const rows = await query.orderBy(desc(products.createdAt));
    return rows.map(r => ({ ...r, sellerName: `${r.firstName} ${r.lastName}`, sellerEmail: r.email })) as any[];
  }

  async getProductById(id: number): Promise<(Product & { sellerName: string; sellerEmail: string }) | undefined> {
    const [row] = await db.select({
      id: products.id, sellerId: products.sellerId, title: products.title, description: products.description,
      price: products.price, category: products.category, condition: products.condition, images: products.images,
      stock: products.stock, location: products.location, status: products.status, viewCount: products.viewCount, createdAt: products.createdAt,
      firstName: users.firstName, lastName: users.lastName, email: users.email,
    }).from(products).innerJoin(users, eq(products.sellerId, users.id)).where(eq(products.id, id));
    if (!row) return undefined;
    await db.update(products).set({ viewCount: (row.viewCount ?? 0) + 1 }).where(eq(products.id, id));
    return { ...row, sellerName: `${row.firstName} ${row.lastName}`, sellerEmail: row.email } as any;
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

  async getOrderById(id: number): Promise<Order | undefined> {
    const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return o;
  }

  async updateOrderStatus(id: number, status: string, extra?: { trackingNumber?: string; escrowReleased?: boolean }): Promise<Order> {
    const set: any = { status: status as any, updatedAt: new Date() };
    if (extra?.trackingNumber !== undefined) set.trackingNumber = extra.trackingNumber;
    if (extra?.escrowReleased !== undefined) set.escrowReleased = extra.escrowReleased;
    const [o] = await db.update(orders).set(set).where(eq(orders.id, id)).returning();
    return o;
  }

  async createOrderTracking(data: { orderId: number; statusLabel: string; description: string; location?: string }): Promise<OrderTracking> {
    const [t] = await db.insert(orderTracking).values({
      orderId: data.orderId,
      statusLabel: data.statusLabel,
      description: data.description,
      location: data.location ?? null,
    }).returning();
    return t;
  }

  async getOrderTracking(orderId: number): Promise<OrderTracking[]> {
    return db.select().from(orderTracking).where(eq(orderTracking.orderId, orderId)).orderBy(desc(orderTracking.createdAt));
  }

  async rateProduct(data: InsertProductRating): Promise<ProductRating> {
    const existing = await db.select().from(productRatings)
      .where(and(eq(productRatings.productId, data.productId), eq(productRatings.userId, data.userId)))
      .limit(1);
    if (existing.length > 0) {
      const [r] = await db.update(productRatings)
        .set({ rating: data.rating, comment: data.comment ?? null })
        .where(eq(productRatings.id, existing[0].id)).returning();
      return r;
    }
    const [r] = await db.insert(productRatings).values(data).returning();
    return r;
  }

  async getProductRatings(productId: number): Promise<(ProductRating & { userName: string })[]> {
    const rows = await db.select({ ...productRatings, firstName: users.firstName, lastName: users.lastName })
      .from(productRatings)
      .innerJoin(users, eq(productRatings.userId, users.id))
      .where(eq(productRatings.productId, productId))
      .orderBy(desc(productRatings.createdAt));
    return rows.map(r => ({ ...r, userName: `${r.firstName} ${r.lastName}` }));
  }

  async getProductRatingSummary(productId: number): Promise<{ avgRating: number; count: number }> {
    const rows = await db.select({
      avg: sql<string>`AVG(${productRatings.rating})::numeric(3,2)`,
      cnt: count(productRatings.id),
    }).from(productRatings).where(eq(productRatings.productId, productId));
    return { avgRating: parseFloat(rows[0]?.avg ?? "0"), count: rows[0]?.cnt ?? 0 };
  }

  async getUserRatingForProduct(productId: number, userId: number): Promise<ProductRating | undefined> {
    const [r] = await db.select().from(productRatings)
      .where(and(eq(productRatings.productId, productId), eq(productRatings.userId, userId)));
    return r;
  }

  // ─── E-Commerce Chat ──────────────────────────────────────────────────────────
  async getOrCreateChat(productId: number, buyerId: number, sellerId: number): Promise<EcommerceChat> {
    const existing = await db.select().from(ecommerceChats)
      .where(and(eq(ecommerceChats.productId, productId), eq(ecommerceChats.buyerId, buyerId)))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [chat] = await db.insert(ecommerceChats).values({ productId, buyerId, sellerId }).returning();
    return chat;
  }

  async getChatMessages(chatId: number): Promise<(EcommerceChatMessage & { senderName: string })[]> {
    const rows = await db.select({
      id: ecommerceChatMessages.id,
      chatId: ecommerceChatMessages.chatId,
      senderId: ecommerceChatMessages.senderId,
      content: ecommerceChatMessages.content,
      isFlagged: ecommerceChatMessages.isFlagged,
      isRead: ecommerceChatMessages.isRead,
      createdAt: ecommerceChatMessages.createdAt,
      senderFirst: users.firstName,
      senderLast: users.lastName,
    }).from(ecommerceChatMessages)
      .innerJoin(users, eq(ecommerceChatMessages.senderId, users.id))
      .where(eq(ecommerceChatMessages.chatId, chatId))
      .orderBy(ecommerceChatMessages.createdAt);
    return rows.map(r => ({ ...r, senderName: `${r.senderFirst} ${r.senderLast}` }));
  }

  async markChatMessagesRead(chatId: number, readerId: number): Promise<void> {
    await db.update(ecommerceChatMessages)
      .set({ isRead: true })
      .where(and(
        eq(ecommerceChatMessages.chatId, chatId),
        not(eq(ecommerceChatMessages.senderId, readerId)),
        eq(ecommerceChatMessages.isRead, false),
      ));
  }

  async createChatMessage(data: InsertEcommerceChatMessage): Promise<EcommerceChatMessage> {
    const [msg] = await db.insert(ecommerceChatMessages).values(data).returning();
    return msg;
  }

  async getUserChats(userId: number): Promise<(EcommerceChat & { productTitle: string; otherPersonName: string; lastMessage?: string; unread: number })[]> {
    const chats = await db.select().from(ecommerceChats)
      .where(or(eq(ecommerceChats.buyerId, userId), eq(ecommerceChats.sellerId, userId)))
      .orderBy(desc(ecommerceChats.createdAt));

    const result = await Promise.all(chats.map(async (chat) => {
      const [prod] = await db.select({ title: products.title }).from(products).where(eq(products.id, chat.productId)).limit(1);
      const otherUserId = chat.buyerId === userId ? chat.sellerId : chat.buyerId;
      const [otherUser] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, otherUserId)).limit(1);
      const msgs = await db.select({ content: ecommerceChatMessages.content, createdAt: ecommerceChatMessages.createdAt })
        .from(ecommerceChatMessages).where(eq(ecommerceChatMessages.chatId, chat.id))
        .orderBy(desc(ecommerceChatMessages.createdAt)).limit(1);
      return {
        ...chat,
        productTitle: prod?.title ?? "Unknown product",
        otherPersonName: otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : "Unknown",
        lastMessage: msgs[0]?.content,
        lastMessageAt: msgs[0]?.createdAt?.toISOString(),
        unread: 0,
      };
    }));
    // Sort by last message time (most recent first), fall back to chat creation time
    result.sort((a, b) => {
      const ta = a.lastMessageAt ?? a.createdAt.toISOString();
      const tb = b.lastMessageAt ?? b.createdAt.toISOString();
      return tb.localeCompare(ta);
    });
    return result;
  }

  // ─── Notifications ───────────────────────────────────────────────────────────
  async createNotification(data: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(data).returning();
    return n;
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(60);
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async clearNotifications(userId: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  async hasBotReminderToday(userId: number, reminderType: string): Promise<boolean> {
    // Check if a bot_reminder of this type was created today (UK time)
    const now = new Date();
    const ukDateStr = now.toLocaleDateString("en-GB", { timeZone: "Europe/London" }); // dd/mm/yyyy
    const [day, month, year] = ukDateStr.split("/");
    const startOfUkDay = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const endOfUkDay   = new Date(`${year}-${month}-${day}T23:59:59.999Z`);
    const rows = await db.select({ id: notifications.id }).from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "bot_reminder"),
          eq(notifications.title, reminderType),
          gte(notifications.createdAt, startOfUkDay),
          lte(notifications.createdAt, endOfUkDay),
        )
      ).limit(1);
    return rows.length > 0;
  }

  // ─── Call Sessions ───────────────────────────────────────────────────────────
  async createCallSession(data: InsertCallSession): Promise<CallSession> {
    const [s] = await db.insert(callSessions).values({ ...data, updatedAt: new Date() }).returning();
    return s;
  }

  async getCallSession(id: number): Promise<CallSession | undefined> {
    const [s] = await db.select().from(callSessions).where(eq(callSessions.id, id)).limit(1);
    return s;
  }

  async updateCallSession(id: number, patch: Partial<CallSession>): Promise<CallSession> {
    const [s] = await db.update(callSessions)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(eq(callSessions.id, id))
      .returning();
    return s;
  }

  async getIncomingCall(calleeId: number): Promise<CallSession | undefined> {
    const [s] = await db.select().from(callSessions)
      .where(and(eq(callSessions.calleeId, calleeId), eq(callSessions.status, "ringing")))
      .orderBy(desc(callSessions.createdAt))
      .limit(1);
    return s;
  }

  async endStaleCalls(userId: number): Promise<void> {
    await db.update(callSessions)
      .set({ status: "ended", updatedAt: new Date() } as any)
      .where(
        and(
          or(eq(callSessions.callerId, userId), eq(callSessions.calleeId, userId)),
          or(eq(callSessions.status, "ringing"), eq(callSessions.status, "active"))
        )
      );
  }

  // ─── Forum ───────────────────────────────────────────────────────────────────
  async getForumTopics(section: string, search?: string): Promise<(ForumTopic & { authorName: string })[]> {
    const rows = await db.select({
      id: forumTopics.id, title: forumTopics.title, body: forumTopics.body,
      authorId: forumTopics.authorId, section: forumTopics.section, tags: forumTopics.tags,
      replyCount: forumTopics.replyCount, likeCount: forumTopics.likeCount,
      isPinned: forumTopics.isPinned, createdAt: forumTopics.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    })
      .from(forumTopics)
      .innerJoin(users, eq(forumTopics.authorId, users.id))
      .where(
        section === "both"
          ? undefined
          : or(eq(forumTopics.section, section as any), eq(forumTopics.section, "both"))
      )
      .orderBy(desc(forumTopics.isPinned), desc(forumTopics.createdAt))
      .limit(100);

    return rows
      .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()))
      .map(r => ({ ...r, authorName: `${r.firstName} ${r.lastName}` }));
  }

  async getForumTopic(id: number): Promise<(ForumTopic & { authorName: string }) | undefined> {
    const [r] = await db.select({
      id: forumTopics.id, title: forumTopics.title, body: forumTopics.body,
      authorId: forumTopics.authorId, section: forumTopics.section, tags: forumTopics.tags,
      replyCount: forumTopics.replyCount, likeCount: forumTopics.likeCount,
      isPinned: forumTopics.isPinned, createdAt: forumTopics.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    })
      .from(forumTopics)
      .innerJoin(users, eq(forumTopics.authorId, users.id))
      .where(eq(forumTopics.id, id))
      .limit(1);
    if (!r) return undefined;
    return { ...r, authorName: `${r.firstName} ${r.lastName}` };
  }

  async createForumTopic(data: InsertForumTopic): Promise<ForumTopic> {
    const [t] = await db.insert(forumTopics).values(data).returning();
    return t;
  }

  async getForumPosts(topicId: number): Promise<(ForumPost & { authorName: string })[]> {
    const rows = await db.select({
      id: forumPosts.id, topicId: forumPosts.topicId, content: forumPosts.content,
      authorId: forumPosts.authorId, likeCount: forumPosts.likeCount, createdAt: forumPosts.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .where(eq(forumPosts.topicId, topicId))
      .orderBy(forumPosts.createdAt);
    return rows.map(r => ({ ...r, authorName: `${r.firstName} ${r.lastName}` }));
  }

  async createForumPost(data: InsertForumPost): Promise<ForumPost> {
    const [p] = await db.insert(forumPosts).values(data).returning();
    await db.update(forumTopics)
      .set({ replyCount: sql`${forumTopics.replyCount} + 1` })
      .where(eq(forumTopics.id, data.topicId));
    return p;
  }

  async likeForumTopic(id: number): Promise<void> {
    await db.update(forumTopics)
      .set({ likeCount: sql`${forumTopics.likeCount} + 1` })
      .where(eq(forumTopics.id, id));
  }

  async likeForumPost(id: number): Promise<void> {
    await db.update(forumPosts)
      .set({ likeCount: sql`${forumPosts.likeCount} + 1` })
      .where(eq(forumPosts.id, id));
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

  async deleteWalletDeposit(id: number): Promise<void> {
    await db.delete(walletDeposits).where(eq(walletDeposits.id, id));
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

  // ─── Tour Africa Bookings ─────────────────────────────────────────────────
  async createTourBooking(data: InsertTourBooking): Promise<TourBooking> {
    const [booking] = await db.insert(tourBookings).values(data).returning();
    return booking;
  }

  async getTourBookingsByUser(userId: number): Promise<TourBooking[]> {
    return db.select().from(tourBookings)
      .where(eq(tourBookings.userId, userId))
      .orderBy(desc(tourBookings.createdAt))
      .limit(50);
  }

  // ─── QCE (Quick Credit Eligibility) ───────────────────────────────────────
  async getOrCreateQceSavings(userId: number): Promise<QceSavings> {
    const [existing] = await db.select().from(qceSavings).where(eq(qceSavings.userId, userId));
    if (existing) return existing;
    const [created] = await db.insert(qceSavings).values({ userId, balance: "0.00", activated: false, daysActive: 0, creditPortalUnlocked: false, eligibilityPercent: "0.00" }).returning();
    return created;
  }

  async updateQceSavings(userId: number, data: Partial<QceSavings>): Promise<QceSavings> {
    const [updated] = await db.update(qceSavings).set({ ...data, updatedAt: new Date() }).where(eq(qceSavings.userId, userId)).returning();
    return updated;
  }

  async contributeToQce(userId: number, amountUsd: number): Promise<{ savings: QceSavings; transaction: QceTransaction }> {
    const savings = await this.getOrCreateQceSavings(userId);
    const newBalance = (parseFloat(savings.balance) + amountUsd).toFixed(2);
    const now = new Date();
    const isFirstContribution = !savings.activated;
    const updatedSavings = await this.updateQceSavings(userId, {
      balance: newBalance,
      activated: true,
      activatedAt: savings.activatedAt ?? now,
      startDate: savings.startDate ?? now,
      lastContributionDate: now,
      creditPortalUnlocked: true,
      eligibilityPercent: calculateQceEligibility(savings.daysActive, parseFloat(newBalance)).toString(),
    });
    const [tx] = await db.insert(qceTransactions).values({
      userId, type: "contribution", amountUsd: amountUsd.toFixed(2),
      balanceAfter: newBalance, note: isFirstContribution ? "Initial QCE activation" : "QCE contribution",
    }).returning();
    return { savings: updatedSavings, transaction: tx };
  }

  async withdrawFromQce(userId: number, amountUsd: number): Promise<{ savings: QceSavings; transaction: QceTransaction }> {
    const savings = await this.getOrCreateQceSavings(userId);
    const currentBalance = parseFloat(savings.balance);
    const newBalance = Math.max(currentBalance - amountUsd, 0).toFixed(2);
    if (parseFloat(newBalance) < QCE.MIN_BALANCE && currentBalance > QCE.MIN_BALANCE) {
      throw new Error(`A minimum balance of $${QCE.MIN_BALANCE} must remain in your QCE savings.`);
    }
    const updatedSavings = await this.updateQceSavings(userId, {
      balance: newBalance,
      eligibilityPercent: calculateQceEligibility(savings.daysActive, parseFloat(newBalance)).toString(),
    });
    const [tx] = await db.insert(qceTransactions).values({
      userId, type: "withdrawal", amountUsd: amountUsd.toFixed(2),
      balanceAfter: newBalance, note: "QCE withdrawal",
    }).returning();
    return { savings: updatedSavings, transaction: tx };
  }

  async getQceTransactions(userId: number): Promise<QceTransaction[]> {
    return db.select().from(qceTransactions).where(eq(qceTransactions.userId, userId)).orderBy(desc(qceTransactions.createdAt)).limit(100);
  }

  async tickQceDays(userId: number): Promise<QceSavings> {
    const savings = await this.getOrCreateQceSavings(userId);
    if (!savings.activated) return savings;
    const lastContrib = savings.lastContributionDate ? new Date(savings.lastContributionDate) : null;
    const now = new Date();
    const daysSinceLast = lastContrib ? Math.floor((now.getTime() - lastContrib.getTime()) / 86400000) : 0;
    if (daysSinceLast > 0) {
      const newDays = Math.min(savings.daysActive + daysSinceLast, QCE.PERIOD_DAYS);
      return this.updateQceSavings(userId, {
        daysActive: newDays,
        lastContributionDate: now,
        eligibilityPercent: calculateQceEligibility(newDays, parseFloat(savings.balance)).toString(),
      });
    }
    return savings;
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────
  async upsertPriceAlert(userId: number, productId: number, lastKnownPrice: string): Promise<PriceAlert> {
    const [row] = await db.insert(priceAlerts)
      .values({ userId, productId, lastKnownPrice, active: true })
      .onConflictDoUpdate({
        target: [priceAlerts.userId, priceAlerts.productId],
        set: { lastKnownPrice, active: true },
      })
      .returning();
    return row;
  }

  async deletePriceAlert(userId: number, productId: number): Promise<void> {
    await db.delete(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.productId, productId)));
  }

  async getUserPriceAlertProductIds(userId: number): Promise<number[]> {
    const rows = await db.select({ productId: priceAlerts.productId })
      .from(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.active, true)));
    return rows.map(r => r.productId);
  }

  async getPriceAlertsForProduct(productId: number): Promise<PriceAlert[]> {
    return db.select().from(priceAlerts)
      .where(and(eq(priceAlerts.productId, productId), eq(priceAlerts.active, true)));
  }

  async updatePriceAlertLastKnown(userId: number, productId: number, price: string): Promise<void> {
    await db.update(priceAlerts)
      .set({ lastKnownPrice: price })
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.productId, productId)));
  }

  // ─── Category Subscriptions ───────────────────────────────────────────────
  async upsertCategorySubscription(userId: number, category: string): Promise<CategorySubscription> {
    const [row] = await db.insert(categorySubscriptions)
      .values({ userId, category })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const [existing] = await db.select().from(categorySubscriptions)
      .where(and(eq(categorySubscriptions.userId, userId), eq(categorySubscriptions.category, category)));
    return existing;
  }

  async deleteCategorySubscription(userId: number, category: string): Promise<void> {
    await db.delete(categorySubscriptions)
      .where(and(eq(categorySubscriptions.userId, userId), eq(categorySubscriptions.category, category)));
  }

  async getUserCategorySubscriptions(userId: number): Promise<string[]> {
    const rows = await db.select({ category: categorySubscriptions.category })
      .from(categorySubscriptions)
      .where(eq(categorySubscriptions.userId, userId));
    return rows.map(r => r.category);
  }

  async getCategorySubscribers(category: string): Promise<number[]> {
    const rows = await db.select({ userId: categorySubscriptions.userId })
      .from(categorySubscriptions)
      .where(eq(categorySubscriptions.category, category));
    return rows.map(r => r.userId);
  }

  // ── Sponsor Cohorts ──────────────────────────────────────────────────────────
  async createSponsorCohort(data: InsertSponsorCohort): Promise<{ cohort: SponsorCohort; codes: CohortCode[] }> {
    const [cohort] = await db.insert(sponsorCohorts).values({
      sponsorName: data.sponsorName,
      sponsorEmail: data.sponsorEmail,
      sponsorPhone: data.sponsorPhone ?? null,
      totalSlots: data.totalSlots,
      notes: data.notes ?? null,
      status: data.status ?? "active",
    }).returning();

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generated: string[] = [];
    while (generated.length < data.totalSlots) {
      const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const code = `TSP-${String(cohort.id).padStart(3, "0")}-${rand}`;
      if (!generated.includes(code)) generated.push(code);
    }

    const codeRows = await db.insert(cohortCodes)
      .values(generated.map(c => ({ cohortId: cohort.id, code: c })))
      .returning();

    return { cohort, codes: codeRows };
  }

  async createPublicSponsorCohort(data: { sponsorName: string; sponsorEmail: string; sponsorPhone?: string; totalSlots: number; orgName?: string }): Promise<{ cohort: SponsorCohort; masterCode: string }> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const genCode = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    let masterCode = `TSIA-${genCode()}`;

    const [cohort] = await db.insert(sponsorCohorts).values({
      sponsorName: data.orgName ? `${data.sponsorName} (${data.orgName})` : data.sponsorName,
      sponsorEmail: data.sponsorEmail,
      sponsorPhone: data.sponsorPhone ?? null,
      totalSlots: data.totalSlots,
      notes: `Public cohort payment. Students: ${data.totalSlots}`,
      status: "active",
      masterCode,
    }).returning();

    return { cohort, masterCode };
  }

  async getSponsorCohorts(): Promise<(SponsorCohort & { codes: CohortCode[] })[]> {
    const allCohorts = await db.select().from(sponsorCohorts).orderBy(desc(sponsorCohorts.createdAt));
    const allCodes = await db.select().from(cohortCodes);
    return allCohorts.map(c => ({
      ...c,
      codes: allCodes.filter(code => code.cohortId === c.id),
    }));
  }

  async getSponsorCohortById(id: number): Promise<(SponsorCohort & { codes: CohortCode[] }) | undefined> {
    const [cohort] = await db.select().from(sponsorCohorts).where(eq(sponsorCohorts.id, id));
    if (!cohort) return undefined;
    const codes = await db.select().from(cohortCodes).where(eq(cohortCodes.cohortId, id));
    return { ...cohort, codes };
  }

  async validateSponsorCode(code: string): Promise<{ valid: boolean; cohortName?: string; reason?: string }> {
    const normalised = code.toUpperCase().trim();

    // 1. Check individual cohort codes (admin-created)
    const [row] = await db.select().from(cohortCodes).where(eq(cohortCodes.code, normalised));
    if (row) {
      if (row.used) return { valid: false, reason: "Code has already been used" };
      const [cohort] = await db.select().from(sponsorCohorts).where(eq(sponsorCohorts.id, row.cohortId));
      if (!cohort || cohort.status !== "active") return { valid: false, reason: "Cohort is no longer active" };
      return { valid: true, cohortName: cohort.sponsorName };
    }

    // 2. Check master codes (public-payment-created cohorts)
    const [cohort] = await db.select().from(sponsorCohorts).where(eq(sponsorCohorts.masterCode, normalised));
    if (!cohort) return { valid: false, reason: "Code not found" };
    if (cohort.status !== "active") return { valid: false, reason: "Cohort is no longer active" };
    if (cohort.usedSlots >= cohort.totalSlots) return { valid: false, reason: "All sponsor slots have been filled" };
    return { valid: true, cohortName: cohort.sponsorName };
  }

  async useSponsorCode(code: string, userId: number): Promise<void> {
    const normalised = code.toUpperCase().trim();

    // Determine if this is a masterCode or an individual cohortCode
    const [individualCode] = await db.select().from(cohortCodes).where(eq(cohortCodes.code, normalised));
    const [cohortByMaster] = !individualCode
      ? await db.select().from(sponsorCohorts).where(eq(sponsorCohorts.masterCode, normalised))
      : [undefined];

    if (!individualCode && !cohortByMaster) throw new Error("Invalid sponsor code");
    if (individualCode?.used) throw new Error("This code has already been used");
    if (cohortByMaster && cohortByMaster.usedSlots >= cohortByMaster.totalSlots) throw new Error("All sponsor slots have been filled");

    await db.transaction(async (tx) => {
      if (individualCode) {
        await tx.update(cohortCodes)
          .set({ used: true, usedByUserId: userId, usedAt: new Date() })
          .where(eq(cohortCodes.id, individualCode.id));
        await tx.update(sponsorCohorts)
          .set({ usedSlots: sql`${sponsorCohorts.usedSlots} + 1` })
          .where(eq(sponsorCohorts.id, individualCode.cohortId));
      } else {
        await tx.update(sponsorCohorts)
          .set({ usedSlots: sql`${sponsorCohorts.usedSlots} + 1` })
          .where(eq(sponsorCohorts.id, cohortByMaster!.id));
      }

      let verification = await tx.select().from(verifications).where(eq(verifications.userId, userId)).then(r => r[0]);
      if (!verification) {
        const [v] = await tx.insert(verifications).values({
          userId, status: "pending", portalFeePaid: false, tier: "none",
        }).returning();
        verification = v;
      }
      if (!verification.portalFeePaid) {
        await tx.update(verifications)
          .set({ portalFeePaid: true, commitmentStartDate: new Date() })
          .where(eq(verifications.id, verification.id));
      }

      // Activate the wallet so sponsored students skip the $5 deposit requirement
      const [existingWallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
      if (!existingWallet) {
        await tx.insert(wallets).values({ userId, balance: "0.00", activated: true });
      } else if (!existingWallet.activated) {
        await tx.update(wallets).set({ activated: true }).where(eq(wallets.userId, userId));
      }
    });
  }

  // ─── Sponsorship Batches ────────────────────────────────────────────────────
  async getCurrentBatch(): Promise<SponsorshipBatch | null> {
    // Return open batch first
    const [open] = await db.select().from(sponsorshipBatches)
      .where(eq(sponsorshipBatches.status, "open"))
      .orderBy(desc(sponsorshipBatches.id))
      .limit(1);
    if (open) return open;
    // Return closed batch only if its reopen window has NOT yet passed
    // Once nextOpenAt has passed, return null so a new batch will be created
    const [closed] = await db.select().from(sponsorshipBatches)
      .where(eq(sponsorshipBatches.status, "closed"))
      .orderBy(desc(sponsorshipBatches.id))
      .limit(1);
    if (!closed) return null;
    if (closed.nextOpenAt && new Date() >= new Date(closed.nextOpenAt)) return null;
    return closed;
  }

  async getAllBatches(): Promise<SponsorshipBatch[]> {
    return db.select().from(sponsorshipBatches).orderBy(desc(sponsorshipBatches.id));
  }

  async createBatch(batchNumber: number): Promise<SponsorshipBatch> {
    const [batch] = await db.insert(sponsorshipBatches)
      .values({ batchNumber, status: "open", enrollmentCount: 0, openedAt: new Date() })
      .returning();
    return batch;
  }

  async incrementBatchEnrollment(id: number, maxSize: number): Promise<{ batch: SponsorshipBatch; wasClosed: boolean }> {
    const [updated] = await db.update(sponsorshipBatches)
      .set({ enrollmentCount: sql`${sponsorshipBatches.enrollmentCount} + 1` })
      .where(eq(sponsorshipBatches.id, id))
      .returning();

    if (updated.enrollmentCount >= maxSize) {
      const closedAt = new Date();
      const nextOpenAt = new Date(closedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const [closed] = await db.update(sponsorshipBatches)
        .set({ status: "closed", closedAt, nextOpenAt })
        .where(eq(sponsorshipBatches.id, id))
        .returning();
      return { batch: closed, wasClosed: true };
    }
    return { batch: updated, wasClosed: false };
  }

  // ─── Wallet activation ──────────────────────────────────────────────────────
  async activateWallet(userId: number): Promise<WalletRecord> {
    const [wallet] = await db.update(wallets)
      .set({ activated: true, activatedAt: new Date() })
      .where(and(eq(wallets.userId, userId), eq(wallets.activated, false)))
      .returning();
    if (!wallet) {
      const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));
      return existing;
    }
    return wallet;
  }

  // ─── Referral stats ─────────────────────────────────────────────────────────
  async getActivatedReferralsByCode(affiliateCode: string): Promise<User[]> {
    // A referral is "active" if they have completed wallet KYC (biometricVerified),
    // funded their wallet to $5+ (wallets.activated), OR paid their portal/subscription fee.
    // Deduped by user id.
    const kycActivated = await db.select({ u: users })
      .from(users)
      .innerJoin(verifications, eq(verifications.userId, users.id))
      .where(and(eq(users.referredBy, affiliateCode), eq(verifications.biometricVerified, true)));

    const feeActivated = await db.select({ u: users })
      .from(users)
      .innerJoin(verifications, eq(verifications.userId, users.id))
      .where(and(eq(users.referredBy, affiliateCode), eq(verifications.portalFeePaid, true)));

    const walletActivated = await db.select({ u: users })
      .from(users)
      .innerJoin(wallets, eq(wallets.userId, users.id))
      .where(and(eq(users.referredBy, affiliateCode), eq(wallets.activated, true)));

    const seen = new Set<number>();
    const all: User[] = [];
    for (const r of [...kycActivated, ...feeActivated, ...walletActivated]) {
      if (!seen.has(r.u.id)) { seen.add(r.u.id); all.push(r.u); }
    }
    return all;
  }

  // ─── Withdrawal Requests ─────────────────────────────────────────────────────
  async createWithdrawalRequest(data: {
    userId: number; type: "bank" | "crypto"; amount: string; fee: string; netAmount: string;
    bankName?: string; bankCode?: string; accountNumber?: string; accountName?: string;
    network?: string; address?: string;
  }) {
    const [req] = await db.insert(withdrawalRequests).values({
      userId: data.userId, type: data.type,
      amount: data.amount, fee: data.fee, netAmount: data.netAmount,
      bankName: data.bankName, bankCode: data.bankCode,
      accountNumber: data.accountNumber, accountName: data.accountName,
      network: data.network, address: data.address,
      status: "pending",
    }).returning();
    return req;
  }

  async getWithdrawalRequestById(id: number) {
    const [req] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return req ?? null;
  }

  async updateWithdrawalRequest(id: number, updates: Partial<{ status: string; adminNote: string; processedAt: Date }>) {
    const [req] = await db.update(withdrawalRequests).set(updates as any).where(eq(withdrawalRequests.id, id)).returning();
    return req;
  }

  async getAllWithdrawalRequests() {
    const rows = await db.select({
      wr: withdrawalRequests,
      u: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, phone: users.phone },
    })
    .from(withdrawalRequests)
    .innerJoin(users, eq(users.id, withdrawalRequests.userId))
    .orderBy(desc(withdrawalRequests.createdAt));
    return rows.map(r => ({ ...r.wr, user: r.u }));
  }

  async getPendingWithdrawalsOlderThan24h() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db.select().from(withdrawalRequests)
      .where(and(eq(withdrawalRequests.status, "pending"), lte(withdrawalRequests.createdAt, cutoff)));
  }

  // ─── Withdrawal OTPs ─────────────────────────────────────────────────────────
  async createWithdrawalOtp(userId: number, code: string, purpose: string): Promise<void> {
    // Invalidate any existing unused OTPs for this user + purpose first
    await db.delete(withdrawalOtps)
      .where(and(eq(withdrawalOtps.userId, userId), eq(withdrawalOtps.purpose, purpose), isNull(withdrawalOtps.usedAt)));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db.insert(withdrawalOtps).values({ userId, code, purpose, expiresAt });
  }

  async verifyAndConsumeWithdrawalOtp(userId: number, code: string, purpose: string): Promise<boolean> {
    const now = new Date();
    const [otp] = await db.select().from(withdrawalOtps)
      .where(and(
        eq(withdrawalOtps.userId, userId),
        eq(withdrawalOtps.code, code),
        eq(withdrawalOtps.purpose, purpose),
        isNull(withdrawalOtps.usedAt),
        gt(withdrawalOtps.expiresAt, now),
      )).limit(1);
    if (!otp) return false;
    await db.update(withdrawalOtps).set({ usedAt: now }).where(eq(withdrawalOtps.id, otp.id));
    return true;
  }

  // ── Platform settings ─────────────────────────────────────────────────────
  async getPlatformSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return row?.value ?? null;
  }

  async getAllPlatformSettings(): Promise<PlatformSetting[]> {
    return db.select().from(platformSettings);
  }

  async setPlatformSetting(key: string, value: string): Promise<void> {
    await db.insert(platformSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
  }

  async getPlanPrices(): Promise<{ plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }> {
    const rows = await db.select().from(platformSettings)
      .where(sql`key IN ('plan_1yr_base','plan_2yr_base','plan_3yr_base','plan_service_charge_rate')`);
    const map = Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]));
    return {
      plan1yr:           map["plan_1yr_base"]            ?? DEFAULT_PLAN_PRICES.plan_1yr_base,
      plan2yr:           map["plan_2yr_base"]            ?? DEFAULT_PLAN_PRICES.plan_2yr_base,
      plan3yr:           map["plan_3yr_base"]            ?? DEFAULT_PLAN_PRICES.plan_3yr_base,
      serviceChargeRate: map["plan_service_charge_rate"] ?? DEFAULT_PLAN_PRICES.plan_service_charge_rate,
    };
  }

  async getTierPayouts(): Promise<{ silver: { min: number; max: number }; gold: { min: number; max: number }; platinum: { min: number; max: number } }> {
    const rows = await db.select().from(platformSettings)
      .where(sql`key IN ('tier_silver_min','tier_silver_max','tier_gold_min','tier_gold_max','tier_platinum_min','tier_platinum_max')`);
    const map = Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]));
    return {
      silver:   { min: map["tier_silver_min"]   ?? DEFAULT_TIER_PAYOUTS.tier_silver_min,   max: map["tier_silver_max"]   ?? DEFAULT_TIER_PAYOUTS.tier_silver_max },
      gold:     { min: map["tier_gold_min"]     ?? DEFAULT_TIER_PAYOUTS.tier_gold_min,     max: map["tier_gold_max"]     ?? DEFAULT_TIER_PAYOUTS.tier_gold_max },
      platinum: { min: map["tier_platinum_min"] ?? DEFAULT_TIER_PAYOUTS.tier_platinum_min, max: map["tier_platinum_max"] ?? DEFAULT_TIER_PAYOUTS.tier_platinum_max },
    };
  }
}

export const storage = new DatabaseStorage();
