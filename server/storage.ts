import { eq, desc, and, gt, gte, lte, lt, count, sql, ne, like, ilike, or, not, isNull, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "./db";
import { calculateBackToSchoolDeposit, calculateBackToSchoolWithdrawal } from "./backToSchoolRules";
import { executeSponsorCodePurchase } from "./sponsorCodePurchase";
import {
  users, verifications, identityVerifications, sponsorshipPlans, wallets, transactions, disbursements,
  adminAuditLogs,
  leadershipInquiries, otpCodes, fileUploads, coAffiliates,
  tradeWallets, tradeTransactions, tradeReserveFund, affiliateTradeShares,
  landlordProperties, tenancyLeases, tenancyPayments, loans,
  products, orders, orderTracking, walletDeposits, walletTransfers, billPayments,
  productRatings,
  ecommerceChats, ecommerceChatMessages,
  notifications, callSessions, forumTopics, forumPosts, forumTopicLikes, forumPostLikes,
  qceSavings, qceTransactions,
  priceAlerts, categorySubscriptions,
  sponsorCohorts, cohortCodes, sponsorCodePurchases, sponsorshipBatches,
  withdrawalRequests, withdrawalOtps,
  personalInvitations, type PersonalInvitation,
  virtualCards, type VirtualCard, type InsertVirtualCard,
  movieSubscriptions, type MovieSubscription,
  savingsGoals, savingsTransactions,
  backToSchoolChildren, backToSchoolVests, backToSchoolVestTransactions,
  backToSchoolOperations, backToSchoolAttempts, backToSchoolAwards,
  proctoringSessions,
  scholarships, type Scholarship, type InsertScholarship,
  researchGrants, type ResearchGrant, type InsertResearchGrant,
  platformSettings, type PlatformSetting, DEFAULT_PLAN_PRICES, DEFAULT_TIER_PAYOUTS,
  type User, type InsertUser,
  type Verification, type InsertVerification, type IdentityVerification, type InsertIdentityVerification,
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
  type BackToSchoolChild, type BackToSchoolAttempt,
  type PriceAlert, type CategorySubscription,
  type SponsorCohort, type InsertSponsorCohort,
  type CohortCode,
  type SponsorCodePurchase,
  type SponsorshipBatch,
  TRADE_MARKET, ECOMMERCE, QCE, calculateQceEligibility,
} from "@shared/schema";

export type SponsorCodeRecord = {
  purchaseId: number | null;
  code: string;
  cohortId: number;
  amountUsd: string | null;
  currency: string;
  transactionId: number | null;
  reference: string | null;
  status: "available" | "disabled" | "redeemed";
  purchasedAt: Date;
  redeemedAt: Date | null;
  purchaser: { id: number | null; firstName: string; lastName: string; email: string } | null;
  redeemedBy: { id: number | null; firstName: string; lastName: string; email: string } | null;
  legacy: boolean;
};

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  deleteUserById(id: number, audit?: { actorUserId: number; reason: string; metadata?: Record<string, unknown> }): Promise<void>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByEmail(email: string): Promise<User[]>;
  getUserByEmailAndRole(email: string, role: string): Promise<User | undefined>;
  searchMembersByEmail(query: string, excludeUserId: number): Promise<{ id: number; firstName: string; lastName: string; email: string; role: string; isDual: boolean; roles: string[] }[]>;
  getAllStudents(): Promise<User[]>;
  updateUserAffiliateCode(userId: number, code: string): Promise<void>;
  updateUserCountry(userId: number, country: string): Promise<void>;
  updateUserActiveSession(userId: number, sessionId: string | null): Promise<void>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  updateUserEmail(userId: number, email: string): Promise<void>;
  updateUserProfile(userId: number, updates: { firstName?: string; lastName?: string; phone?: string }): Promise<void>;
  updateUserProfileAdmin(userId: number, updates: { email?: string; firstName?: string; lastName?: string; passwordHash?: string }): Promise<void>;
  setWalletFundDeadline(userId: number, deadline: Date | null): Promise<void>;
  getStudentsPastFundDeadline(): Promise<User[]>;
  resetStudentEnrollment(userId: number): Promise<void>;
  getReferralsByCode(affiliateCode: string): Promise<User[]>;
  getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined>;

  createOtp(otp: InsertOtp): Promise<OtpCode>;
  getValidOtp(email: string, code: string): Promise<OtpCode | undefined>;
  markOtpUsed(id: number): Promise<void>;

  createVerification(v: InsertVerification): Promise<Verification>;
  getVerificationByUser(userId: number): Promise<Verification | undefined>;
  updateVerification(id: number, data: Partial<Verification>): Promise<Verification>;
  getPendingVerifications(): Promise<(Verification & { user: User })[]>;
  getAllVerifications(): Promise<(Verification & { user: User })[]>;
  createIdentityVerification(v: InsertIdentityVerification): Promise<IdentityVerification>;
  getIdentityVerificationBySignupTokenHash(tokenHash: string): Promise<IdentityVerification | undefined>;
  consumeIdentityVerificationSignupToken(tokenHash: string): Promise<IdentityVerification | undefined>;
  getVerifiedIdentityVerificationByUser(userId: number): Promise<IdentityVerification | undefined>;
  bindIdentityVerificationToUser(id: number, userId: number): Promise<IdentityVerification>;
  getIdentityVerificationsDueForReview(asOf: Date): Promise<IdentityVerification[]>;
  markIdentityVerificationReviewed(id: number, reviewedAt: Date): Promise<void>;
  hasCompletedIdentityVerification(userId: number): Promise<boolean>;

  createFileUpload(file: InsertFileUpload): Promise<FileUpload>;
  getFilesByUser(userId: number): Promise<FileUpload[]>;

  createSponsorshipPlan(plan: InsertSponsorshipPlan): Promise<SponsorshipPlan>;
  getSponsorshipPlanByUser(userId: number): Promise<SponsorshipPlan | undefined>;

  getOrCreateWallet(userId: number): Promise<WalletRecord>;
  updateWalletBalance(userId: number, amount: string): Promise<WalletRecord>;
  setWalletLien(userId: number, amount: string, reason: string): Promise<WalletRecord>;
  releaseWalletLien(userId: number): Promise<WalletRecord>;
  getStudentsWithLiens(): Promise<(WalletRecord & { user: User })[]>;
  getStudentsWithProcessedDisbursements(): Promise<(WalletRecord & { user: User; completedDisbursementCount: number; totalDisbursed: string })[]>;

  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;

  createDisbursement(d: InsertDisbursement): Promise<Disbursement>;
  getPendingDisbursements(): Promise<(Disbursement & { user: User })[]>;
  getAllDisbursements(): Promise<(Disbursement & { user: User })[]>;
  getDisbursementsByUser(userId: number): Promise<Disbursement[]>;
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
  updateExchangeBalance(userId: number, delta: number): Promise<TradeWallet>;
  addToTotalInvested(userId: number, amount: string): Promise<TradeWallet>;
  markRoiComplete(userId: number): Promise<TradeWallet>;
  restoreTradeWalletFromPrematureComplete(userId: number, tradeBalance: string, lockedPrincipal: string): Promise<TradeWallet>;
  setTradingPlanDays(userId: number, planDays: number): Promise<TradeWallet>;
  resetRoiForNewCycle(userId: number): Promise<void>;
  resetTradingDayForTopUp(userId: number, newLossDays: number[]): Promise<void>;
  addToLockedPrincipal(userId: number, amount: string): Promise<TradeWallet>;
  clearLockedPrincipal(userId: number): Promise<TradeWallet>;
  addReferralCommission(userId: number, amount: string): Promise<TradeWallet>;
  subtractReferralCommission(userId: number, amount: string): Promise<TradeWallet>;
  setBotActivatedAt(userId: number, ts: Date | null): Promise<TradeWallet>;
  setBotLocked(userId: number, locked: boolean): Promise<TradeWallet>;
  creditBotEarnings(userId: number, earningAmount: string): Promise<TradeWallet>;
  applyBotLoss(userId: number, lossAmount: string): Promise<TradeWallet>;
  assignLossDays(userId: number, days: number[]): Promise<TradeWallet>;
  incrementTradingDay(userId: number): Promise<TradeWallet>;
  createTradeTransaction(tx: InsertTradeTransaction): Promise<TradeTransaction>;
  getTradeTransactionsByUser(userId: number): Promise<TradeTransaction[]>;
  getTradeReserveFund(): Promise<{ total_balance: string; total_deposited: string }>;
  addToReserveFund(amount: string): Promise<void>;
  recordAffiliateTradeShare(tradeTransactionId: number | null, poolAmount: string, affiliateCount: number, perAffiliate: string, sourceType?: string): Promise<void>;
  getAffiliateCount(): Promise<number>;

  // Loans
  createLoan(data: InsertLoan): Promise<Loan>;
  getLoan(id: number): Promise<Loan | undefined>;
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
  deleteProduct(id: number): Promise<void>;
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
  getForumTopics(section: string, userId: number, search?: string): Promise<(ForumTopic & { authorName: string; userLiked: boolean })[]>;
  getForumTopic(id: number): Promise<(ForumTopic & { authorName: string }) | undefined>;
  createForumTopic(data: InsertForumTopic): Promise<ForumTopic>;
  getForumPosts(topicId: number, userId: number): Promise<(ForumPost & { authorName: string; userLiked: boolean })[]>;
  createForumPost(data: InsertForumPost): Promise<ForumPost>;
  toggleForumTopicLike(topicId: number, userId: number): Promise<{ liked: boolean; likeCount: number }>;
  toggleForumPostLike(postId: number, userId: number): Promise<{ liked: boolean; likeCount: number }>;

  // Wallet Deposits (student/user funding)
  createWalletDeposit(data: InsertWalletDeposit): Promise<WalletDeposit>;
  getWalletDepositsByUser(userId: number): Promise<WalletDeposit[]>;
  getWalletDepositByTxHash(txHash: string): Promise<WalletDeposit | null>;
  getPendingWalletDeposits(): Promise<(WalletDeposit & { user: User })[]>;
  updateWalletDeposit(id: number, data: Partial<WalletDeposit>): Promise<WalletDeposit>;
  getCryptoDepositsNeedingVerification(): Promise<WalletDeposit[]>;
  deleteWalletDeposit(id: number): Promise<void>;

  // Fintech: P2P Transfers
  createWalletTransfer(data: { senderId: number; recipientId: number; amount: number; note?: string }): Promise<WalletTransfer>;
  getWalletTransfersByUser(userId: number): Promise<(WalletTransfer & { recipientName?: string; senderName?: string })[]>;

  // Fintech: Bill Payments
  createBillPayment(data: { userId: number; service: string; amount: number; reference: string; status?: string }): Promise<BillPayment>;
  getBillPaymentsByUser(userId: number): Promise<BillPayment[]>;
  getPendingBankTransfers(): Promise<(BillPayment & { userName?: string; userEmail?: string })[]>;
  updateBillPaymentStatus(id: number, status: string): Promise<BillPayment>;

  // Scholarships
  getScholarship(userId: number, type: string): Promise<Scholarship | undefined>;
  createScholarship(data: Partial<InsertScholarship> & { userId: number; type: string }): Promise<Scholarship>;
  updateScholarship(id: number, data: Partial<Scholarship>): Promise<Scholarship>;
  deleteScholarship(id: number): Promise<void>;
  getAllScholarships(): Promise<(Scholarship & { user: User })[]>;

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
  createPublicSponsorCohort(data: { sponsorName: string; sponsorEmail: string; sponsorPhone?: string; totalSlots: number; orgName?: string }): Promise<{ cohort: SponsorCohort; masterCode: string }>;
  purchaseAffiliateSponsorCode(data: { affiliate: User; amountUsd: number; idempotencyKey: string }): Promise<SponsorCodeRecord & { walletBalance: string }>;
  getAffiliateSponsorCodePurchases(userId: number): Promise<SponsorCodeRecord[]>;
  getSponsorCodeAdminReport(filters?: { q?: string; status?: string }): Promise<{
    summary: { totalPurchases: number; totalRevenue: number; availableCodes: number; redeemedCodes: number; disabledCodes: number };
    records: SponsorCodeRecord[];
  }>;
  setSponsorCodePurchaseStatus(data: { purchaseId: number; status: "available" | "disabled"; adminUserId: number; reason: string }): Promise<SponsorCodeRecord>;
  getSponsorCohorts(): Promise<(SponsorCohort & { codes: CohortCode[] })[]>;
  getSponsorCohortById(id: number): Promise<(SponsorCohort & { codes: CohortCode[] }) | undefined>;
  validateSponsorCode(code: string): Promise<{ valid: boolean; cohortName?: string; reason?: string }>;
  useSponsorCode(code: string, userId: number): Promise<void>;

  // Sponsorship Batches
  getCurrentBatch(): Promise<SponsorshipBatch | null>;
  getAllBatches(): Promise<SponsorshipBatch[]>;
  createBatch(batchNumber: number): Promise<SponsorshipBatch>;
  incrementBatchEnrollment(id: number, maxSize: number): Promise<{ batch: SponsorshipBatch; wasClosed: boolean }>;
  openBatchSlots(slots: number): Promise<{ batch: SponsorshipBatch; totalCapacity: number; remaining: number }>;
  getAdminBatchStatus(baseMax: number): Promise<{ batch: SponsorshipBatch | null; totalCapacity: number; remaining: number; enrolled: number } | null>;
  createPersonalInvitation(data: { email: string; name?: string; note?: string; createdByAdminId: number }): Promise<PersonalInvitation>;
  getPersonalInvitationByEmail(email: string): Promise<PersonalInvitation | null>;
  usePersonalInvitation(email: string, userId: number): Promise<void>;
  listPersonalInvitations(): Promise<PersonalInvitation[]>;

  // Wallet activation
  activateWallet(userId: number): Promise<WalletRecord>;

  // Referral stats (activated vs pending)
  getActivatedReferralsByCode(affiliateCode: string): Promise<User[]>;

  // Withdrawal OTPs
  createWithdrawalOtp(userId: number, code: string, purpose: string): Promise<void>;
  verifyAndConsumeWithdrawalOtp(userId: number, code: string, purpose: string): Promise<boolean>;

  // Savings Goals
  getSavingsGoalsByUser(userId: number): Promise<any[]>;
  getSavingsGoal(id: number, userId: number): Promise<any | null>;
  createSavingsGoal(data: { userId: number; name: string; type: string; emoji: string; targetAmount: string; targetDate?: Date | null }): Promise<any>;
  depositToSavings(userId: number, goalId: number, amountUsd: number): Promise<{ goal: any; walletBalance: string }>;
  withdrawFromSavings(userId: number, goalId: number, amountUsd: number): Promise<{ goal: any; walletBalance: string }>;
  getSavingsTransactions(goalId: number, userId: number): Promise<any[]>;
  deleteSavingsGoal(id: number, userId: number): Promise<void>;

  // Affiliate Back to School
  createBackToSchoolChild(data: { guardianUserId: number; fullName: string; dateOfBirth: string; schoolName?: string; gradeLevel?: string; birthCertificateUploadId: number }): Promise<BackToSchoolChild>;
  getBackToSchoolProgramme(guardianUserId: number): Promise<any[]>;
  settleMaturedBackToSchoolVests(guardianUserId: number): Promise<number>;
  settleAllMaturedBackToSchoolVests(): Promise<number>;
  getBackToSchoolChild(childId: number, guardianUserId: number): Promise<BackToSchoolChild | undefined>;
  updateBackToSchoolChild(childId: number, guardianUserId: number, data: { fullName?: string; schoolName?: string; gradeLevel?: string; birthCertificateUploadId?: number }): Promise<BackToSchoolChild>;
  contributeToBackToSchoolVest(guardianUserId: number, childId: number, amountUsd: number, idempotencyKey: string): Promise<any>;
  withdrawFromBackToSchoolVest(guardianUserId: number, childId: number, amountUsd: number, idempotencyKey: string): Promise<any>;
  getBackToSchoolAttempt(childId: number, guardianUserId: number): Promise<BackToSchoolAttempt | undefined>;
  createBackToSchoolAttempt(data: { childId: number; guardianUserId: number; questionIds: string[] }): Promise<BackToSchoolAttempt>;
  recordBackToSchoolCheatingEvent(data: { childId: number; guardianUserId: number; eventType: string; description: string }): Promise<{ eventCount: number; shouldAutoSubmit: boolean; terminalResult?: any }>;
  completeBackToSchoolAttempt(data: { childId: number; guardianUserId: number; score: number; percentage: number; awardAmount: number; expired?: boolean }): Promise<any>;
  getBackToSchoolAdminProgramme(): Promise<any[]>;
  getBackToSchoolCertificate(childId: number): Promise<{ child: BackToSchoolChild; file: FileUpload } | undefined>;
  reviewBackToSchoolCertificate(data: { childId: number; adminUserId: number; approved: boolean; reason?: string }): Promise<BackToSchoolChild>;
  reviewBackToSchoolAward(data: { awardId: number; adminUserId: number; approved: boolean; reason?: string }): Promise<any>;
  payBackToSchoolAward(data: { awardId: number; adminUserId: number; reference: string }): Promise<any>;

  // Cashback
  getCashbackBalance(userId: number): Promise<string>;
  addCashback(userId: number, amountUsd: number): Promise<void>;
  withdrawCashbackToWallet(userId: number, amountUsd: number): Promise<{ cashbackBalance: string; walletBalance: string }>;

  // Research Grants
  createResearchGrant(data: InsertResearchGrant): Promise<ResearchGrant>;
  getResearchGrantsByUser(userId: number): Promise<ResearchGrant[]>;
  getAllResearchGrants(): Promise<(ResearchGrant & { user: Pick<User, "firstName"|"lastName"|"email"> })[]>;
  updateResearchGrant(id: number, data: Partial<ResearchGrant>): Promise<ResearchGrant>;

  // Platform settings
  getPlatformSetting(key: string): Promise<string | null>;
  getAllPlatformSettings(): Promise<PlatformSetting[]>;
  setPlatformSetting(key: string, value: string): Promise<void>;
  getPlanPrices(): Promise<{ plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }>;
  getTierPayouts(): Promise<{ silver: { min: number; max: number }; gold: { min: number; max: number }; platinum: { min: number; max: number } }>;

  // Virtual Cards
  getVirtualCard(userId: number): Promise<VirtualCard | null>;
  createVirtualCard(data: InsertVirtualCard): Promise<VirtualCard>;

  // Movie Subscriptions
  getMovieSubscription(userId: number): Promise<MovieSubscription | null>;
  createOrRenewMovieSubscription(userId: number): Promise<MovieSubscription>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    await db.insert(wallets).values({ userId: created.id, balance: "0.00" });
    return created;
  }

  async deleteUserById(id: number, audit?: { actorUserId: number; reason: string; metadata?: Record<string, unknown> }): Promise<void> {
    // Fetch user email first (needed for OTP codes which are keyed by email, not user_id)
    const [targetUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, id));
    const userEmail = targetUser?.email;

    // Must delete all related records in dependency order before removing the user
    await db.transaction(async (tx) => {
      if (audit) {
        await tx.insert(adminAuditLogs).values({
          actorUserId: audit.actorUserId,
          targetUserId: id,
          action: "account.deleted",
          reason: audit.reason,
          metadata: audit.metadata ?? {},
        });
      }
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
      // 32a. scholarships
      await tx.delete(scholarships).where(eq(scholarships.userId, id));
      // 32b. savings transactions (must come before savings goals)
      await tx.delete(savingsTransactions).where(eq(savingsTransactions.userId, id));
      // 32c. savings goals
      await tx.delete(savingsGoals).where(eq(savingsGoals.userId, id));
      // 32d. movie subscriptions
      await tx.delete(movieSubscriptions).where(eq(movieSubscriptions.userId, id));
      // 32e. virtual cards
      await tx.delete(virtualCards).where(eq(virtualCards.userId, id));
      // 32f. Back to School award and CBT records (depend on child profiles)
      await tx.delete(backToSchoolAwards).where(eq(backToSchoolAwards.guardianUserId, id));
      await tx.delete(backToSchoolAttempts).where(eq(backToSchoolAttempts.guardianUserId, id));
      await tx.delete(backToSchoolVestTransactions).where(eq(backToSchoolVestTransactions.guardianUserId, id));
      await tx.delete(backToSchoolVests).where(eq(backToSchoolVests.guardianUserId, id));
      await tx.delete(backToSchoolChildren).where(eq(backToSchoolChildren.guardianUserId, id));
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

  async searchMembersByEmail(query: string, excludeUserId: number): Promise<{ id: number; firstName: string; lastName: string; email: string; role: string; isDual: boolean; roles: string[] }[]> {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(ilike(users.email, `%${query}%`), ne(users.id, excludeUserId)))
      .orderBy(users.email)
      .limit(30);

    // Group by email to detect dual accounts
    const grouped = new Map<string, { id: number; firstName: string; lastName: string; email: string; roles: string[] }>();
    for (const row of rows) {
      const key = row.email.toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        if (!existing.roles.includes(row.role)) existing.roles.push(row.role);
      } else {
        grouped.set(key, { id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email, roles: [row.role] });
      }
    }

    return [...grouped.values()].slice(0, 8).map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.roles[0],
      isDual: u.roles.includes("student") && u.roles.includes("affiliate"),
      roles: u.roles,
    }));
  }

  async getAllStudents(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "student")).orderBy(desc(users.createdAt));
  }

  async updateUserAffiliateCode(userId: number, code: string): Promise<void> {
    await db.update(users).set({ affiliateCode: code }).where(eq(users.id, userId));
  }

  async updateUserCountry(userId: number, country: string): Promise<void> {
    await db.update(users).set({ country }).where(eq(users.id, userId));
  }

  async updateUserActiveSession(userId: number, sessionId: string | null): Promise<void> {
    await db.update(users).set({ activeSessionId: sessionId }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, userId));
  }

  async updateUserEmail(userId: number, email: string): Promise<void> {
    await db.update(users).set({ email }).where(eq(users.id, userId));
  }

  async updateUserProfileAdmin(userId: number, updates: { email?: string; firstName?: string; lastName?: string; passwordHash?: string }): Promise<void> {
    const fields: Record<string, any> = {};
    if (updates.email) fields.email = updates.email;
    if (updates.firstName) fields.firstName = updates.firstName;
    if (updates.lastName) fields.lastName = updates.lastName;
    if (updates.passwordHash) fields.password = updates.passwordHash;
    if (Object.keys(fields).length > 0) {
      await db.update(users).set(fields).where(eq(users.id, userId));
    }
  }

  async updateUserProfile(userId: number, updates: { firstName?: string; lastName?: string; phone?: string }): Promise<void> {
    const fields: Record<string, string> = {};
    if (updates.firstName) fields.firstName = updates.firstName;
    if (updates.lastName) fields.lastName = updates.lastName;
    if (updates.phone) fields.phone = updates.phone;
    if (Object.keys(fields).length > 0) {
      await db.update(users).set(fields as any).where(eq(users.id, userId));
    }
  }

  async setWalletFundDeadline(userId: number, deadline: Date | null): Promise<void> {
    await db.update(users).set({ walletFundDeadline: deadline } as any).where(eq(users.id, userId));
  }

  async getStudentsPastFundDeadline(): Promise<User[]> {
    const now = new Date();
    return db.select().from(users).where(
      and(
        eq(users.role, "student"),
        sql`${users.walletFundDeadline} IS NOT NULL`,
        sql`${users.walletFundDeadline} < ${now}`,
      )
    );
  }

  async resetStudentEnrollment(userId: number): Promise<void> {
    // Delete ONLY the verification/enrollment record — account and wallet are preserved.
    // The student must redo onboarding (NIN → WAEC → portal fee) when they return.
    await db.delete(verifications).where(eq(verifications.userId, userId));
    // Clear the deadline so they won't be re-triggered
    await db.update(users).set({ walletFundDeadline: null } as any).where(eq(users.id, userId));
  }

  async getReferralsByCode(affiliateCode: string): Promise<User[]> {
    if (!affiliateCode) return [];
    return db.select().from(users).where(sql`UPPER(TRIM(${users.referredBy})) = ${affiliateCode.trim().toUpperCase()}`).orderBy(desc(users.createdAt));
  }

  async getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(sql`UPPER(TRIM(${users.affiliateCode})) = ${affiliateCode.trim().toUpperCase()}`).limit(1);
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
      .where(eq(verifications.status, "pending"))
      .orderBy(desc(verifications.id));
    return results.map(r => ({ ...r.verifications, user: r.users }));
  }

  async getAllVerifications(): Promise<(Verification & { user: User })[]> {
    const results = await db
      .select()
      .from(verifications)
      .innerJoin(users, eq(verifications.userId, users.id))
      .orderBy(desc(verifications.id));
    return results.map(r => ({ ...r.verifications, user: r.users }));
  }

  async createIdentityVerification(v: InsertIdentityVerification): Promise<IdentityVerification> {
    const [created] = await db.insert(identityVerifications).values(v).returning();
    return created;
  }

  async getIdentityVerificationBySignupTokenHash(tokenHash: string): Promise<IdentityVerification | undefined> {
    const [record] = await db.select().from(identityVerifications)
      .where(eq(identityVerifications.signupTokenHash, tokenHash));
    return record;
  }

  async consumeIdentityVerificationSignupToken(tokenHash: string): Promise<IdentityVerification | undefined> {
    const now = new Date();
    const [claimed] = await db.update(identityVerifications)
      .set({ signupTokenHash: null, updatedAt: now })
      .where(and(
        eq(identityVerifications.signupTokenHash, tokenHash),
        isNull(identityVerifications.userId),
        eq(identityVerifications.status, "verified"),
        or(
          eq(identityVerifications.livenessStatus, "verified"),
          eq(identityVerifications.livenessStatus, "not_required"),
        ),
        gt(identityVerifications.expiresAt, now),
      ))
      .returning();
    return claimed;
  }

  async getVerifiedIdentityVerificationByUser(userId: number): Promise<IdentityVerification | undefined> {
    const now = new Date();
    const [record] = await db.select().from(identityVerifications).where(and(
      eq(identityVerifications.userId, userId),
      eq(identityVerifications.status, "verified"),
      or(
        eq(identityVerifications.livenessStatus, "verified"),
        eq(identityVerifications.livenessStatus, "not_required"),
      ),
      or(isNull(identityVerifications.documentExpiresAt), gt(identityVerifications.documentExpiresAt, now)),
    ));
    return record;
  }

  async bindIdentityVerificationToUser(id: number, userId: number): Promise<IdentityVerification> {
    const [updated] = await db.update(identityVerifications)
      .set({ userId, updatedAt: new Date() })
      .where(and(
        eq(identityVerifications.id, id),
        isNull(identityVerifications.userId),
        isNull(identityVerifications.signupTokenHash),
      ))
      .returning();
    if (!updated) throw new Error("Identity verification token has already been used.");
    return updated;
  }

  async getIdentityVerificationsDueForReview(asOf: Date): Promise<IdentityVerification[]> {
    const expiryWindow = new Date(asOf.getTime() + 45 * 24 * 60 * 60 * 1000);
    return db.select().from(identityVerifications).where(and(
      or(
        ne(identityVerifications.status, "verified"),
        lte(identityVerifications.documentExpiresAt, expiryWindow),
      ),
      or(isNull(identityVerifications.reviewedAt), lt(identityVerifications.reviewedAt, new Date(asOf.getFullYear(), asOf.getMonth(), 1))),
    ));
  }

  async markIdentityVerificationReviewed(id: number, reviewedAt: Date): Promise<void> {
    await db.update(identityVerifications)
      .set({ reviewedAt, updatedAt: new Date() })
      .where(eq(identityVerifications.id, id));
  }

  async hasCompletedIdentityVerification(userId: number): Promise<boolean> {
    return !!await this.getVerifiedIdentityVerificationByUser(userId);
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

  async setWalletLien(userId: number, amount: string, reason: string): Promise<WalletRecord> {
    await this.getOrCreateWallet(userId);
    const [updated] = await db.update(wallets)
      .set({ lienAmount: amount, lienReason: reason, lienPlacedAt: new Date() })
      .where(eq(wallets.userId, userId))
      .returning();
    return updated;
  }

  async releaseWalletLien(userId: number): Promise<WalletRecord> {
    await this.getOrCreateWallet(userId);
    const [updated] = await db.update(wallets)
      .set({ lienAmount: "0.00", lienReason: null, lienPlacedAt: null })
      .where(eq(wallets.userId, userId))
      .returning();
    return updated;
  }

  async getStudentsWithLiens(): Promise<(WalletRecord & { user: User })[]> {
    const rows = await db
      .select({ wallet: wallets, user: users })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(gt(wallets.lienAmount, "0"))
      .orderBy(desc(wallets.lienPlacedAt));
    return rows.map(r => ({ ...r.wallet, user: r.user }));
  }

  async getStudentsWithProcessedDisbursements(): Promise<(WalletRecord & { user: User; completedDisbursementCount: number; totalDisbursed: string })[]> {
    // Find all students who have at least one completed (processed) disbursement
    const completedDisbs = await db
      .select({ userId: disbursements.userId, amount: disbursements.amount })
      .from(disbursements)
      .where(eq(disbursements.status, "completed"));
    // Group by userId
    const byUser: Record<number, number> = {};
    const countByUser: Record<number, number> = {};
    for (const d of completedDisbs) {
      byUser[d.userId] = (byUser[d.userId] ?? 0) + parseFloat(d.amount);
      countByUser[d.userId] = (countByUser[d.userId] ?? 0) + 1;
    }
    const userIds = Object.keys(byUser).map(Number);
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ wallet: wallets, user: users })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(inArray(wallets.userId, userIds))
      .orderBy(desc(wallets.lienPlacedAt));
    return rows.map(r => ({
      ...r.wallet,
      user: r.user,
      completedDisbursementCount: countByUser[r.user.id] ?? 0,
      totalDisbursed: (byUser[r.user.id] ?? 0).toFixed(2),
    }));
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
      .where(eq(disbursements.status, "pending"))
      .orderBy(desc(disbursements.createdAt));
    return results.map(r => ({ ...r.disbursements, user: r.users }));
  }

  async getAllDisbursements(): Promise<(Disbursement & { user: User })[]> {
    const results = await db
      .select()
      .from(disbursements)
      .innerJoin(users, eq(disbursements.userId, users.id))
      .orderBy(desc(disbursements.createdAt));
    return results.map(r => ({ ...r.disbursements, user: r.users }));
  }

  async getDisbursementsByUser(userId: number): Promise<Disbursement[]> {
    return db.select().from(disbursements).where(eq(disbursements.userId, userId)).orderBy(disbursements.semesterNum);
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
    const [updated] = await db.update(coAffiliates).set({ ...data }).where(eq(coAffiliates.userId, userId)).returning();
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

  async updateExchangeBalance(userId: number, delta: number): Promise<TradeWallet> {
    await this.getOrCreateTradeWallet(userId);
    const [updated] = await db.update(tradeWallets)
      .set({ exchangeBalance: sql`GREATEST(0, exchange_balance + ${delta.toFixed(6)}::decimal)`, updatedAt: new Date() })
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
      .set({ roiComplete: true, tradeBalance: "0.000000", lockedPrincipal: "0.000000", botActivatedAt: null, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async restoreTradeWalletFromPrematureComplete(userId: number, tradeBalance: string, lockedPrincipal: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ roiComplete: false, tradeBalance, lockedPrincipal, botActivatedAt: null, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async setTradingPlanDays(userId: number, planDays: number): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ tradingPlanDays: planDays, updatedAt: new Date() })
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
      .set({ roiComplete: false, earlyExitCompleted: false, totalBotEarnings: "0.000000", totalInvested: "0.000000", lockedPrincipal: "0.000000", tradingDayNumber: 0, lossDayNumbers: [], cycleStartedAt: null, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId));
  }

  async resetTradingDayForTopUp(userId: number, newLossDays: number[]): Promise<void> {
    await db.update(tradeWallets)
      // Also reset totalBotEarnings so the new cycle's cap is calculated cleanly
      // from zero against the updated lockedPrincipal (which addToLockedPrincipal
      // will set right after this call).
      .set({ tradingDayNumber: 0, lossDayNumbers: newLossDays, totalBotEarnings: "0.000000", earlyExitCompleted: false, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId));
  }

  async addReferralCommission(userId: number, amount: string): Promise<TradeWallet> {
    await this.getOrCreateTradeWallet(userId);
    const [updated] = await db.update(tradeWallets)
      .set({ referralCommissionBalance: sql`COALESCE(referral_commission_balance, 0) + ${amount}::decimal`, updatedAt: new Date() })
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

  async setBotLocked(userId: number, locked: boolean): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ botLocked: locked, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async creditBotEarnings(userId: number, earningAmount: string): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({
        tradeBalance: sql`trade_balance + ${earningAmount}::decimal`,
        totalBotEarnings: sql`total_bot_earnings + ${earningAmount}::decimal`,
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
        updatedAt: new Date(),
      })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async assignLossDays(userId: number, days: number[]): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ lossDayNumbers: days, updatedAt: new Date() })
      .where(eq(tradeWallets.userId, userId))
      .returning();
    return updated;
  }

  async incrementTradingDay(userId: number): Promise<TradeWallet> {
    const [updated] = await db.update(tradeWallets)
      .set({ tradingDayNumber: sql`trading_day_number + 1`, updatedAt: new Date() })
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
    // Singleton table — try UPDATE first; if table is empty, INSERT the initial row
    const result = await db.execute(sql`
      UPDATE trade_reserve_fund
      SET total_balance   = total_balance   + ${amount}::decimal,
          total_deposited = total_deposited + ${amount}::decimal,
          updated_at      = NOW()
    `);
    if ((result.rowCount ?? 0) === 0) {
      await db.execute(sql`
        INSERT INTO trade_reserve_fund (total_balance, total_deposited, updated_at)
        VALUES (${amount}::decimal, ${amount}::decimal, NOW())
      `);
    }
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

  async getLoan(id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(eq(loans.id, id));
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

  async deleteProduct(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. chat messages (depends on chats)
      const chatIds = await tx.select({ id: ecommerceChats.id }).from(ecommerceChats).where(eq(ecommerceChats.productId, id));
      if (chatIds.length > 0) {
        const ids = chatIds.map(c => c.id);
        await tx.delete(ecommerceChatMessages).where(inArray(ecommerceChatMessages.chatId, ids));
      }
      // 2. chats
      await tx.delete(ecommerceChats).where(eq(ecommerceChats.productId, id));
      // 3. ratings
      await tx.delete(productRatings).where(eq(productRatings.productId, id));
      // 4. price alerts
      await tx.delete(priceAlerts).where(eq(priceAlerts.productId, id));
      // 5. null out call session productId (nullable column)
      await tx.execute(sql`UPDATE call_sessions SET product_id = NULL WHERE product_id = ${id}`);
      // 6. orders — cancel any pending, then delete all
      await tx.execute(sql`DELETE FROM orders WHERE product_id = ${id}`);
      // 7. finally delete the product
      await tx.delete(products).where(eq(products.id, id));
    });
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
  async getForumTopics(section: string, userId: number, search?: string): Promise<(ForumTopic & { authorName: string; userLiked: boolean })[]> {
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

    const topicIds = rows.map(r => r.id);
    let likedSet = new Set<number>();
    if (topicIds.length > 0) {
      const liked = await db.select({ topicId: forumTopicLikes.topicId })
        .from(forumTopicLikes)
        .where(and(eq(forumTopicLikes.userId, userId), inArray(forumTopicLikes.topicId, topicIds)));
      likedSet = new Set(liked.map(l => l.topicId));
    }

    return rows
      .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.body.toLowerCase().includes(search.toLowerCase()))
      .map(r => ({ ...r, authorName: `${r.firstName} ${r.lastName}`, userLiked: likedSet.has(r.id) }));
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

  async getForumPosts(topicId: number, userId: number): Promise<(ForumPost & { authorName: string; userLiked: boolean })[]> {
    const rows = await db.select({
      id: forumPosts.id, topicId: forumPosts.topicId, content: forumPosts.content,
      authorId: forumPosts.authorId, likeCount: forumPosts.likeCount, createdAt: forumPosts.createdAt,
      firstName: users.firstName, lastName: users.lastName,
    })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .where(eq(forumPosts.topicId, topicId))
      .orderBy(forumPosts.createdAt);

    const postIds = rows.map(r => r.id);
    let likedSet = new Set<number>();
    if (postIds.length > 0) {
      const liked = await db.select({ postId: forumPostLikes.postId })
        .from(forumPostLikes)
        .where(and(eq(forumPostLikes.userId, userId), inArray(forumPostLikes.postId, postIds)));
      likedSet = new Set(liked.map(l => l.postId));
    }

    return rows.map(r => ({ ...r, authorName: `${r.firstName} ${r.lastName}`, userLiked: likedSet.has(r.id) }));
  }

  async createForumPost(data: InsertForumPost): Promise<ForumPost> {
    const [p] = await db.insert(forumPosts).values(data).returning();
    await db.update(forumTopics)
      .set({ replyCount: sql`${forumTopics.replyCount} + 1` })
      .where(eq(forumTopics.id, data.topicId));
    return p;
  }

  async toggleForumTopicLike(topicId: number, userId: number): Promise<{ liked: boolean; likeCount: number }> {
    const [existing] = await db.select().from(forumTopicLikes)
      .where(and(eq(forumTopicLikes.topicId, topicId), eq(forumTopicLikes.userId, userId)));
    if (existing) {
      await db.delete(forumTopicLikes).where(and(eq(forumTopicLikes.topicId, topicId), eq(forumTopicLikes.userId, userId)));
      const [updated] = await db.update(forumTopics)
        .set({ likeCount: sql`GREATEST(${forumTopics.likeCount} - 1, 0)` })
        .where(eq(forumTopics.id, topicId)).returning({ likeCount: forumTopics.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await db.insert(forumTopicLikes).values({ topicId, userId });
      const [updated] = await db.update(forumTopics)
        .set({ likeCount: sql`${forumTopics.likeCount} + 1` })
        .where(eq(forumTopics.id, topicId)).returning({ likeCount: forumTopics.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 0 };
    }
  }

  async toggleForumPostLike(postId: number, userId: number): Promise<{ liked: boolean; likeCount: number }> {
    const [existing] = await db.select().from(forumPostLikes)
      .where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)));
    if (existing) {
      await db.delete(forumPostLikes).where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)));
      const [updated] = await db.update(forumPosts)
        .set({ likeCount: sql`GREATEST(${forumPosts.likeCount} - 1, 0)` })
        .where(eq(forumPosts.id, postId)).returning({ likeCount: forumPosts.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await db.insert(forumPostLikes).values({ postId, userId });
      const [updated] = await db.update(forumPosts)
        .set({ likeCount: sql`${forumPosts.likeCount} + 1` })
        .where(eq(forumPosts.id, postId)).returning({ likeCount: forumPosts.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 0 };
    }
  }

  // ─── Wallet Deposits ─────────────────────────────────────────────────────────
  async createWalletDeposit(data: InsertWalletDeposit): Promise<WalletDeposit> {
    const [d] = await db.insert(walletDeposits).values(data).returning();
    return d;
  }

  async getWalletDepositsByUser(userId: number): Promise<WalletDeposit[]> {
    return db.select().from(walletDeposits).where(eq(walletDeposits.userId, userId)).orderBy(desc(walletDeposits.createdAt));
  }

  async getWalletDepositByTxHash(txHash: string): Promise<WalletDeposit | null> {
    const normalized = txHash.trim().toLowerCase();
    const [d] = await db.select().from(walletDeposits)
      .where(sql`LOWER(TRIM(${walletDeposits.txHash})) = ${normalized}`)
      .limit(1);
    return d ?? null;
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

  // ── Crypto deposits needing on-chain verification ─────────────────────────
  // Returns uncredited TRC20/BEP20 submissions awaiting on-chain verification.
  async getCryptoDepositsNeedingVerification(): Promise<WalletDeposit[]> {
    const rows = await db.select().from(walletDeposits)
      .where(and(
        eq(walletDeposits.status, "pending"),
        sql`LOWER(${walletDeposits.walletType}) IN ('trc20','bep20','trade_trc20','trade_bep20')`,
      ))
      .orderBy(desc(walletDeposits.createdAt));
    return rows;
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
  async createBillPayment(data: { userId: number; service: string; amount: number; reference: string; status?: string }): Promise<BillPayment> {
    const [payment] = await db.insert(billPayments).values({
      userId: data.userId,
      service: data.service,
      amount: data.amount.toFixed(2),
      reference: data.reference,
      status: data.status ?? "completed",
    }).returning();
    return payment;
  }

  async getBillPaymentsByUser(userId: number): Promise<BillPayment[]> {
    return db.select().from(billPayments)
      .where(eq(billPayments.userId, userId))
      .orderBy(desc(billPayments.createdAt))
      .limit(50);
  }

  async getPendingBankTransfers(): Promise<(BillPayment & { userName?: string; userEmail?: string })[]> {
    const rows = await db
      .select({
        id: billPayments.id, userId: billPayments.userId, service: billPayments.service,
        amount: billPayments.amount, reference: billPayments.reference,
        status: billPayments.status, createdAt: billPayments.createdAt,
        userName: sql<string>`(${users.firstName} || ' ' || ${users.lastName})`,
        userEmail: users.email,
      })
      .from(billPayments)
      .leftJoin(users, eq(billPayments.userId, users.id))
      .where(eq(billPayments.service, "bank_transfer"))
      .orderBy(desc(billPayments.createdAt));
    return rows as any[];
  }

  async updateBillPaymentStatus(id: number, status: string): Promise<BillPayment> {
    const [updated] = await db.update(billPayments).set({ status }).where(eq(billPayments.id, id)).returning();
    return updated;
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

  private async sponsorCodeRecords(): Promise<SponsorCodeRecord[]> {
    const [purchases, cohorts] = await Promise.all([
      db.select().from(sponsorCodePurchases).orderBy(desc(sponsorCodePurchases.createdAt)),
      db.select().from(sponsorCohorts).orderBy(desc(sponsorCohorts.createdAt)),
    ]);
    const userIds = Array.from(new Set(purchases.flatMap((row) =>
      [row.affiliateUserId, row.redeemedByUserId].filter((id): id is number => id !== null)
    )));
    const relatedUsers = userIds.length
      ? await db.select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }).from(users).where(inArray(users.id, userIds))
      : [];
    const userById = new Map(relatedUsers.map((user) => [user.id, user]));
    const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
    const trackedCohortIds = new Set(purchases.map((purchase) => purchase.cohortId));

    const tracked: SponsorCodeRecord[] = purchases.map((purchase) => {
      const cohort = cohortById.get(purchase.cohortId);
      const redeemed = purchase.status === "redeemed" || !!purchase.redeemedAt || (cohort?.usedSlots ?? 0) >= (cohort?.totalSlots ?? 1);
      const status: SponsorCodeRecord["status"] = redeemed
        ? "redeemed"
        : purchase.status === "disabled" ? "disabled" : "available";
      return {
        purchaseId: purchase.id,
        code: purchase.code,
        cohortId: purchase.cohortId,
        amountUsd: purchase.amountUsd,
        currency: purchase.currency,
        transactionId: purchase.transactionId,
        reference: purchase.reference,
        status,
        purchasedAt: purchase.createdAt,
        redeemedAt: purchase.redeemedAt,
        purchaser: purchase.affiliateUserId ? userById.get(purchase.affiliateUserId) ?? null : null,
        redeemedBy: purchase.redeemedByUserId ? userById.get(purchase.redeemedByUserId) ?? null : null,
        legacy: false,
      };
    });

    const legacy: SponsorCodeRecord[] = cohorts
      .filter((cohort) => !!cohort.masterCode && !trackedCohortIds.has(cohort.id))
      .map((cohort) => ({
        purchaseId: null,
        code: cohort.masterCode!,
        cohortId: cohort.id,
        amountUsd: null,
        currency: "USD",
        transactionId: null,
        reference: null,
        status: cohort.usedSlots >= cohort.totalSlots ? "redeemed" : cohort.status === "active" ? "available" : "disabled",
        purchasedAt: cohort.createdAt,
        redeemedAt: null,
        purchaser: {
          id: null,
          firstName: cohort.sponsorName,
          lastName: "",
          email: cohort.sponsorEmail,
        },
        redeemedBy: null,
        legacy: true,
      }));

    return [...tracked, ...legacy].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  }

  async purchaseAffiliateSponsorCode(data: { affiliate: User; amountUsd: number; idempotencyKey: string }): Promise<SponsorCodeRecord & { walletBalance: string }> {
    const outcome = await db.transaction((tx) => executeSponsorCodePurchase({
      findPurchase: async (userId, idempotencyKey) => {
        const [row] = await tx.select({ id: sponsorCodePurchases.id }).from(sponsorCodePurchases).where(and(
          eq(sponsorCodePurchases.affiliateUserId, userId),
          eq(sponsorCodePurchases.idempotencyKey, idempotencyKey),
        ));
        return row;
      },
      getWallet: async (userId) => {
        const [row] = await tx.select({ id: wallets.id, balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId));
        return row;
      },
      createWallet: async (userId) => {
        const [row] = await tx.insert(wallets).values({ userId, balance: "0.00" }).returning({ id: wallets.id, balance: wallets.balance });
        return row;
      },
      createCohort: async ({ sponsorName, sponsorEmail, sponsorPhone, code }) => {
        const [row] = await tx.insert(sponsorCohorts).values({
          sponsorName,
          sponsorEmail,
          sponsorPhone,
          totalSlots: 1,
          notes: "Affiliate scholarship sponsor-code purchase",
          status: "active",
          masterCode: code,
        }).returning({ id: sponsorCohorts.id });
        return row;
      },
      createTransaction: async ({ userId, amount, code }) => {
        const [row] = await tx.insert(transactions).values({
          userId,
          type: "withdrawal",
          amount,
          fee: "0.00",
          paymentMethod: "wallet",
          description: `Scholarship sponsor code purchase — ${code}`,
        }).returning({ id: transactions.id });
        return row;
      },
      createPurchase: async (purchase) => {
        const [row] = await tx.insert(sponsorCodePurchases).values({
          ...purchase,
          currency: "USD",
          status: "available",
        }).returning({ id: sponsorCodePurchases.id });
        return row;
      },
      debitWallet: async (walletId, amountUsd) => {
        const [row] = await tx.update(wallets)
          .set({ balance: sql`${wallets.balance} - ${amountUsd.toFixed(2)}::numeric` })
          .where(and(
            eq(wallets.id, walletId),
            gte(wallets.balance, amountUsd.toFixed(2)),
          ))
          .returning({ balance: wallets.balance });
        return row;
      },
    }, {
      buyer: data.affiliate,
      amountUsd: data.amountUsd,
      idempotencyKey: data.idempotencyKey,
      generateCode: () => `TSIA-${randomBytes(5).toString("hex").toUpperCase()}`,
    }));

    const record = (await this.sponsorCodeRecords()).find((row) => row.purchaseId === outcome.purchaseId);
    if (!record) throw new Error("Sponsor-code purchase was saved but could not be reloaded.");
    return { ...record, walletBalance: outcome.walletBalance };
  }

  async getAffiliateSponsorCodePurchases(userId: number): Promise<SponsorCodeRecord[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    const records = await this.sponsorCodeRecords();
    const legacyCohorts = await db.select().from(sponsorCohorts).where(eq(sponsorCohorts.sponsorEmail, user.email));
    const legacyCohortIds = new Set(legacyCohorts.map((cohort) => cohort.id));
    return records.filter((record) =>
      record.purchaser?.id === userId || (record.legacy && legacyCohortIds.has(record.cohortId))
    );
  }

  async getSponsorCodeAdminReport(filters: { q?: string; status?: string } = {}): Promise<{
    summary: { totalPurchases: number; totalRevenue: number; availableCodes: number; redeemedCodes: number; disabledCodes: number };
    records: SponsorCodeRecord[];
  }> {
    const all = await this.sponsorCodeRecords();
    const q = filters.q?.trim().toLowerCase() ?? "";
    const status = filters.status?.trim().toLowerCase() ?? "all";
    const records = all.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (!q) return true;
      const haystack = [
        record.code, record.reference, record.transactionId, record.cohortId,
        record.purchaser?.firstName, record.purchaser?.lastName,
        record.purchaser?.email, record.redeemedBy?.firstName, record.redeemedBy?.lastName,
        record.redeemedBy?.email,
      ].filter((value) => value !== null && value !== undefined).join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return {
      summary: {
        totalPurchases: all.length,
        totalRevenue: all.reduce((total, record) => total + parseFloat(record.amountUsd ?? "0"), 0),
        availableCodes: all.filter((record) => record.status === "available").length,
        redeemedCodes: all.filter((record) => record.status === "redeemed").length,
        disabledCodes: all.filter((record) => record.status === "disabled").length,
      },
      records,
    };
  }

  async setSponsorCodePurchaseStatus(data: { purchaseId: number; status: "available" | "disabled"; adminUserId: number; reason: string }): Promise<SponsorCodeRecord> {
    await db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(sponsorCodePurchases).where(eq(sponsorCodePurchases.id, data.purchaseId));
      if (!purchase) throw new Error("Sponsor-code purchase not found.");
      if (purchase.status === "redeemed" || purchase.redeemedAt) {
        throw new Error("Redeemed sponsor codes cannot be changed.");
      }
      const [cohort] = await tx.select().from(sponsorCohorts).where(eq(sponsorCohorts.id, purchase.cohortId));
      if (!cohort || cohort.usedSlots >= cohort.totalSlots) {
        throw new Error("Redeemed sponsor codes cannot be changed.");
      }
      const [updatedPurchase] = await tx.update(sponsorCodePurchases)
        .set({ status: data.status, updatedAt: new Date() })
        .where(and(
          eq(sponsorCodePurchases.id, data.purchaseId),
          isNull(sponsorCodePurchases.redeemedAt),
          inArray(sponsorCodePurchases.status, ["available", "disabled"]),
        ))
        .returning();
      if (!updatedPurchase) throw new Error("Redeemed sponsor codes cannot be changed.");
      const [updatedCohort] = await tx.update(sponsorCohorts)
        .set({ status: data.status === "available" ? "active" : "disabled" })
        .where(and(
          eq(sponsorCohorts.id, purchase.cohortId),
          lt(sponsorCohorts.usedSlots, sponsorCohorts.totalSlots),
        ))
        .returning();
      if (!updatedCohort) throw new Error("Redeemed sponsor codes cannot be changed.");
      await tx.insert(adminAuditLogs).values({
        actorUserId: data.adminUserId,
        targetUserId: purchase.affiliateUserId,
        action: `sponsor_code.${data.status}`,
        reason: data.reason,
        reference: purchase.reference,
        beforeState: { status: purchase.status },
        afterState: { status: data.status },
        metadata: { purchaseId: purchase.id, cohortId: purchase.cohortId, code: purchase.code },
      });
    });
    const record = (await this.sponsorCodeRecords()).find((row) => row.purchaseId === data.purchaseId);
    if (!record) throw new Error("Sponsor-code purchase was updated but could not be reloaded.");
    return record;
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
    const [purchase] = await db.select().from(sponsorCodePurchases).where(eq(sponsorCodePurchases.cohortId, cohort.id));
    if (purchase?.status === "disabled") return { valid: false, reason: "Code has been disabled" };
    if (purchase?.status === "redeemed") return { valid: false, reason: "Code has already been used" };
    if (cohort.status !== "active") return { valid: false, reason: "Cohort is no longer active" };
    if (cohort.usedSlots >= cohort.totalSlots) return { valid: false, reason: "All sponsor slots have been filled" };
    return { valid: true, cohortName: cohort.sponsorName };
  }

  async useSponsorCode(code: string, userId: number): Promise<void> {
    const normalised = code.toUpperCase().trim();
    await db.transaction(async (tx) => {
      const [individualCode] = await tx.select().from(cohortCodes).where(eq(cohortCodes.code, normalised));
      const [cohortByMaster] = !individualCode
        ? await tx.select().from(sponsorCohorts).where(eq(sponsorCohorts.masterCode, normalised))
        : [undefined];
      if (!individualCode && !cohortByMaster) throw new Error("Invalid sponsor code");

      if (individualCode) {
        const [consumed] = await tx.update(cohortCodes)
          .set({ used: true, usedByUserId: userId, usedAt: new Date() })
          .where(and(eq(cohortCodes.id, individualCode.id), eq(cohortCodes.used, false)))
          .returning();
        if (!consumed) throw new Error("This code has already been used");
        await tx.update(sponsorCohorts)
          .set({ usedSlots: sql`${sponsorCohorts.usedSlots} + 1` })
          .where(eq(sponsorCohorts.id, individualCode.cohortId));
      } else {
        const [purchase] = await tx.select().from(sponsorCodePurchases)
          .where(eq(sponsorCodePurchases.cohortId, cohortByMaster!.id));
        if (purchase?.status === "disabled") throw new Error("Code has been disabled");
        if (purchase?.status === "redeemed") throw new Error("This code has already been used");
        const [consumedCohort] = await tx.update(sponsorCohorts)
          .set({ usedSlots: sql`${sponsorCohorts.usedSlots} + 1` })
          .where(and(
            eq(sponsorCohorts.id, cohortByMaster!.id),
            eq(sponsorCohorts.status, "active"),
            lt(sponsorCohorts.usedSlots, sponsorCohorts.totalSlots),
          ))
          .returning();
        if (!consumedCohort) throw new Error("All sponsor slots have been filled");
        if (purchase) {
          const [consumedPurchase] = await tx.update(sponsorCodePurchases)
            .set({ status: "redeemed", redeemedByUserId: userId, redeemedAt: new Date(), updatedAt: new Date() })
            .where(and(
              eq(sponsorCodePurchases.id, purchase.id),
              eq(sponsorCodePurchases.status, "available"),
            ))
            .returning();
          if (!consumedPurchase) throw new Error("This code has already been used");
        }
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

    // Effective capacity = hardcoded base max + any admin-granted extra slots
    const effectiveMax = maxSize + (updated.extraSlots ?? 0);
    if (updated.enrollmentCount >= effectiveMax) {
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

  async openBatchSlots(slots: number): Promise<{ batch: SponsorshipBatch; totalCapacity: number; remaining: number }> {
    const BATCH_BASE = 15;
    // Get the most recent batch regardless of status
    const [latest] = await db.select().from(sponsorshipBatches)
      .orderBy(desc(sponsorshipBatches.id)).limit(1);

    let batch: SponsorshipBatch;
    if (latest) {
      // Add extra slots and reopen
      const [updated] = await db.update(sponsorshipBatches)
        .set({
          extraSlots: sql`${sponsorshipBatches.extraSlots} + ${slots}`,
          status: "open",
          nextOpenAt: null,
        })
        .where(eq(sponsorshipBatches.id, latest.id))
        .returning();
      batch = updated;
    } else {
      // No batch exists at all — create fresh one
      const [created] = await db.insert(sponsorshipBatches)
        .values({ batchNumber: 1, status: "open", enrollmentCount: 0, extraSlots: slots, openedAt: new Date() })
        .returning();
      batch = created;
    }

    const totalCapacity = BATCH_BASE + (batch.extraSlots ?? 0);
    const remaining = Math.max(0, totalCapacity - batch.enrollmentCount);
    return { batch, totalCapacity, remaining };
  }

  async getAdminBatchStatus(baseMax: number): Promise<{ batch: SponsorshipBatch | null; totalCapacity: number; remaining: number; enrolled: number }> {
    const [latest] = await db.select().from(sponsorshipBatches)
      .orderBy(desc(sponsorshipBatches.id)).limit(1);
    if (!latest) return { batch: null, totalCapacity: baseMax, remaining: baseMax, enrolled: 0 };
    const totalCapacity = baseMax + (latest.extraSlots ?? 0);
    const remaining = Math.max(0, totalCapacity - latest.enrollmentCount);
    return { batch: latest, totalCapacity, remaining, enrolled: latest.enrollmentCount };
  }

  // ─── Personal Enrollment Invitations ────────────────────────────────────────
  async createPersonalInvitation(data: { email: string; name?: string; note?: string; createdByAdminId: number }): Promise<PersonalInvitation> {
    const [inv] = await db.insert(personalInvitations).values({
      email: data.email.toLowerCase().trim(),
      name: data.name ?? null,
      note: data.note ?? null,
      createdByAdminId: data.createdByAdminId,
    }).returning();
    return inv;
  }

  async getPersonalInvitationByEmail(email: string): Promise<PersonalInvitation | null> {
    const [inv] = await db.select().from(personalInvitations)
      .where(and(eq(personalInvitations.email, email.toLowerCase().trim()), eq(personalInvitations.used, false)))
      .orderBy(desc(personalInvitations.createdAt))
      .limit(1);
    return inv ?? null;
  }

  async usePersonalInvitation(email: string, userId: number): Promise<void> {
    await db.update(personalInvitations)
      .set({ used: true, usedAt: new Date(), usedByUserId: userId })
      .where(and(eq(personalInvitations.email, email.toLowerCase().trim()), eq(personalInvitations.used, false)));
  }

  async listPersonalInvitations(): Promise<PersonalInvitation[]> {
    return db.select().from(personalInvitations).orderBy(desc(personalInvitations.createdAt));
  }

  // ─── Wallet activation ──────────────────────────────────────────────────────
  async activateWallet(userId: number): Promise<WalletRecord> {
    const [wallet] = await db.update(wallets)
      .set({ activated: true, activatedAt: new Date() })
      .where(and(eq(wallets.userId, userId), eq(wallets.activated, false)))
      .returning();
    // Clear fund deadline — user has funded their wallet
    await db.update(users).set({ walletFundDeadline: null } as any).where(eq(users.id, userId));
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
      .where(and(sql`UPPER(TRIM(${users.referredBy})) = ${affiliateCode.trim().toUpperCase()}`, eq(verifications.biometricVerified, true)));

    const feeActivated = await db.select({ u: users })
      .from(users)
      .innerJoin(verifications, eq(verifications.userId, users.id))
      .where(and(sql`UPPER(TRIM(${users.referredBy})) = ${affiliateCode.trim().toUpperCase()}`, eq(verifications.portalFeePaid, true)));

    const walletActivated = await db.select({ u: users })
      .from(users)
      .innerJoin(wallets, eq(wallets.userId, users.id))
      .where(and(sql`UPPER(TRIM(${users.referredBy})) = ${affiliateCode.trim().toUpperCase()}`, eq(wallets.activated, true)));

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

  async getWithdrawalRequestsByUser(userId: number) {
    return await db.select().from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
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
      walletBalance: wallets.balance,
    })
    .from(withdrawalRequests)
    .innerJoin(users, eq(users.id, withdrawalRequests.userId))
    .leftJoin(wallets, eq(wallets.userId, withdrawalRequests.userId))
    .orderBy(desc(withdrawalRequests.createdAt));
    return rows.map(r => ({ ...r.wr, user: { ...r.u, walletBalance: r.walletBalance ?? "0.00" } }));
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

  async getVirtualCard(userId: number): Promise<VirtualCard | null> {
    const [card] = await db.select().from(virtualCards).where(eq(virtualCards.userId, userId)).limit(1);
    return card ?? null;
  }

  async createVirtualCard(data: InsertVirtualCard): Promise<VirtualCard> {
    const [card] = await db.insert(virtualCards).values(data).returning();
    return card;
  }

  async getMovieSubscription(userId: number): Promise<MovieSubscription | null> {
    const [sub] = await db.select().from(movieSubscriptions)
      .where(and(eq(movieSubscriptions.userId, userId), eq(movieSubscriptions.status, "active")))
      .orderBy(desc(movieSubscriptions.createdAt)).limit(1);
    return sub ?? null;
  }

  async createOrRenewMovieSubscription(userId: number): Promise<MovieSubscription> {
    const existing = await this.getMovieSubscription(userId);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (existing) {
      const newExpiry = new Date(existing.expiresAt);
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      const [updated] = await db.update(movieSubscriptions)
        .set({ expiresAt: newExpiry, renewedAt: now })
        .where(eq(movieSubscriptions.id, existing.id)).returning();
      return updated;
    }
    const [sub] = await db.insert(movieSubscriptions).values({ userId, plan: "netflix", status: "active", expiresAt }).returning();
    return sub;
  }

  // ── Savings Goals ────────────────────────────────────────────────────────────
  async getSavingsGoalsByUser(userId: number): Promise<any[]> {
    return db.select().from(savingsGoals)
      .where(and(eq(savingsGoals.userId, userId), ne(savingsGoals.status, "deleted")))
      .orderBy(desc(savingsGoals.createdAt));
  }

  async getSavingsGoal(id: number, userId: number): Promise<any | null> {
    const [goal] = await db.select().from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    return goal ?? null;
  }

  async createSavingsGoal(data: { userId: number; name: string; type: string; emoji: string; targetAmount: string; targetDate?: Date | null }): Promise<any> {
    const [goal] = await db.insert(savingsGoals).values({
      userId: data.userId,
      name: data.name,
      type: data.type,
      emoji: data.emoji,
      targetAmount: data.targetAmount,
      targetDate: data.targetDate ?? null,
      currentAmount: "0.00",
      status: "active",
    }).returning();
    return goal;
  }

  async depositToSavings(userId: number, goalId: number, amountUsd: number): Promise<{ goal: any; walletBalance: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const walletBal = parseFloat(wallet.balance);
    if (walletBal < amountUsd) throw new Error("Insufficient wallet balance");

    const goal = await this.getSavingsGoal(goalId, userId);
    if (!goal) throw new Error("Savings goal not found");
    if (goal.status === "deleted") throw new Error("Goal not found");

    const newGoalBal = parseFloat(goal.currentAmount) + amountUsd;
    const newWalletBal = walletBal - amountUsd;
    const isCompleted = newGoalBal >= parseFloat(goal.targetAmount);

    await this.updateWalletBalance(userId, newWalletBal.toFixed(2));

    const [updatedGoal] = await db.update(savingsGoals)
      .set({ currentAmount: newGoalBal.toFixed(2), status: isCompleted ? "completed" : "active", updatedAt: new Date() })
      .where(eq(savingsGoals.id, goalId))
      .returning();

    await db.insert(savingsTransactions).values({
      userId, goalId, type: "deposit",
      amountUsd: amountUsd.toFixed(2),
      balanceAfter: newGoalBal.toFixed(2),
      note: null,
    });

    await this.createTransaction({
      userId,
      type: "transfer",
      amount: (-amountUsd).toFixed(2),
      fee: "0.00",
      description: `Savings deposit → ${goal.name}`,
    });

    return { goal: updatedGoal, walletBalance: newWalletBal.toFixed(2) };
  }

  async withdrawFromSavings(userId: number, goalId: number, amountUsd: number): Promise<{ goal: any; walletBalance: string }> {
    const goal = await this.getSavingsGoal(goalId, userId);
    if (!goal) throw new Error("Savings goal not found");

    const goalBal = parseFloat(goal.currentAmount);
    if (goalBal < amountUsd) throw new Error("Insufficient savings balance");

    const wallet = await this.getOrCreateWallet(userId);
    const newWalletBal = parseFloat(wallet.balance) + amountUsd;
    const newGoalBal = goalBal - amountUsd;

    await this.updateWalletBalance(userId, newWalletBal.toFixed(2));

    const [updatedGoal] = await db.update(savingsGoals)
      .set({ currentAmount: newGoalBal.toFixed(2), updatedAt: new Date() })
      .where(eq(savingsGoals.id, goalId))
      .returning();

    await db.insert(savingsTransactions).values({
      userId, goalId, type: "withdrawal",
      amountUsd: amountUsd.toFixed(2),
      balanceAfter: newGoalBal.toFixed(2),
      note: null,
    });

    await this.createTransaction({
      userId,
      type: "transfer",
      amount: amountUsd.toFixed(2),
      fee: "0.00",
      description: `Savings withdrawal ← ${goal.name}`,
    });

    return { goal: updatedGoal, walletBalance: newWalletBal.toFixed(2) };
  }

  async getSavingsTransactions(goalId: number, userId: number): Promise<any[]> {
    return db.select().from(savingsTransactions)
      .where(and(eq(savingsTransactions.goalId, goalId), eq(savingsTransactions.userId, userId)))
      .orderBy(desc(savingsTransactions.createdAt));
  }

  async deleteSavingsGoal(id: number, userId: number): Promise<void> {
    const goal = await this.getSavingsGoal(id, userId);
    if (!goal) throw new Error("Goal not found");
    if (parseFloat(goal.currentAmount) > 0) throw new Error("Withdraw all funds before deleting this goal");
    await db.update(savingsGoals)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  }

  // ── Affiliate Back to School ────────────────────────────────────────────────
  async createBackToSchoolChild(data: { guardianUserId: number; fullName: string; dateOfBirth: string; schoolName?: string; gradeLevel?: string; birthCertificateUploadId: number }): Promise<BackToSchoolChild> {
    const now = new Date();
    return db.transaction(async (tx) => {
      const [certificate] = await tx.select().from(fileUploads)
        .where(and(
          eq(fileUploads.id, data.birthCertificateUploadId),
          eq(fileUploads.userId, data.guardianUserId),
          eq(fileUploads.category, "back_to_school_birth_certificate"),
        ))
        .for("update");
      if (!certificate) throw new Error("Upload a valid birth certificate before creating this kiddies account");
      const [child] = await tx.insert(backToSchoolChildren).values({
        guardianUserId: data.guardianUserId,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        schoolName: data.schoolName || null,
        gradeLevel: data.gradeLevel || null,
        birthCertificateUploadId: certificate.id,
        certificateStatus: "pending",
      }).returning();
      await tx.insert(backToSchoolVests).values({
        childId: child.id,
        guardianUserId: data.guardianUserId,
        balance: "0.00",
        targetAmount: "30.00",
        startedAt: now,
        // Retained for backwards-compatible records only; there is no longer a
        // programme maturity timer. The $30 funding milestone is the unlock.
        maturesAt: now,
        status: "active",
      });
      return child;
    });
  }

  async getBackToSchoolProgramme(guardianUserId: number): Promise<any[]> {
    // Vests that reached $30 under the earlier 30-day rule must keep their new
    // eligibility rather than waiting for a no-longer-used settlement job.
    const now = new Date();
    await db.update(backToSchoolVests).set({
      status: "qualified",
      qualifiedAt: now,
      cbtUnlockedAt: now,
      updatedAt: now,
    }).where(and(
      eq(backToSchoolVests.guardianUserId, guardianUserId),
      eq(backToSchoolVests.status, "active"),
      gte(backToSchoolVests.balance, backToSchoolVests.targetAmount),
    ));
    const children = await db.select().from(backToSchoolChildren)
      .where(eq(backToSchoolChildren.guardianUserId, guardianUserId))
      .orderBy(desc(backToSchoolChildren.createdAt));
    if (!children.length) return [];
    const childIds = children.map(c => c.id);
    const [vests, attempts, awards] = await Promise.all([
      db.select().from(backToSchoolVests).where(inArray(backToSchoolVests.childId, childIds)),
      db.select().from(backToSchoolAttempts).where(inArray(backToSchoolAttempts.childId, childIds)),
      db.select().from(backToSchoolAwards).where(inArray(backToSchoolAwards.childId, childIds)),
    ]);
    const vestByChild = new Map(vests.map(v => [v.childId, v]));
    const attemptByChild = new Map(attempts.map(a => [a.childId, a]));
    const awardByChild = new Map(awards.map(a => [a.childId, a]));
    return children.map(child => ({
      ...child,
      vest: vestByChild.get(child.id) ?? null,
      attempt: attemptByChild.get(child.id) ?? null,
      award: awardByChild.get(child.id) ?? null,
    }));
  }

  async settleMaturedBackToSchoolVests(guardianUserId: number): Promise<number> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const maturedVests = await tx.select().from(backToSchoolVests)
        .where(and(
          eq(backToSchoolVests.guardianUserId, guardianUserId),
          eq(backToSchoolVests.status, "active"),
          lte(backToSchoolVests.maturesAt, now),
        ))
        .for("update");
      if (!maturedVests.length) return 0;

      const [wallet] = await tx.select().from(wallets)
        .where(eq(wallets.userId, guardianUserId))
        .for("update");
      if (!wallet) throw new Error("SwiftWallet not found for Piggy Vest settlement");

      let walletBalance = Number(wallet.balance);
      for (const vest of maturedVests) {
        const returnAmount = Number(vest.balance);
        const qualified = returnAmount >= Number(vest.targetAmount) && !!vest.fundedAt;
        const settlementStatus = qualified ? "qualified" : "expired";
        walletBalance += returnAmount;

        await tx.update(backToSchoolVests).set({
          balance: "0.00",
          returnedAmount: returnAmount.toFixed(2),
          settledAt: now,
          status: settlementStatus,
          ...(qualified ? { qualifiedAt: now } : {}),
          updatedAt: now,
        }).where(eq(backToSchoolVests.id, vest.id));

        if (returnAmount > 0) {
          await tx.insert(backToSchoolVestTransactions).values({
            vestId: vest.id,
            guardianUserId,
            type: "maturity_return",
            amountUsd: returnAmount.toFixed(2),
            balanceAfter: "0.00",
          });
          await tx.insert(transactions).values({
            userId: guardianUserId,
            type: "transfer",
            amount: returnAmount.toFixed(2),
            fee: "0.00",
            description: `Back to School Piggy Vest maturity return${qualified ? " after successful qualification" : ""}`,
          });
        }
      }
      await tx.update(wallets).set({ balance: walletBalance.toFixed(2) })
        .where(eq(wallets.userId, guardianUserId));
      return maturedVests.length;
    });
  }

  async settleAllMaturedBackToSchoolVests(): Promise<number> {
    const now = new Date();
    const dueVests = await db.select({ guardianUserId: backToSchoolVests.guardianUserId })
      .from(backToSchoolVests)
      .where(and(eq(backToSchoolVests.status, "active"), lte(backToSchoolVests.maturesAt, now)));
    const guardianIds = Array.from(new Set(dueVests.map(vest => vest.guardianUserId)));
    let settledCount = 0;
    for (const guardianUserId of guardianIds) {
      settledCount += await this.settleMaturedBackToSchoolVests(guardianUserId);
    }
    return settledCount;
  }

  async getBackToSchoolChild(childId: number, guardianUserId: number): Promise<BackToSchoolChild | undefined> {
    const [child] = await db.select().from(backToSchoolChildren)
      .where(and(eq(backToSchoolChildren.id, childId), eq(backToSchoolChildren.guardianUserId, guardianUserId)));
    return child;
  }

  async updateBackToSchoolChild(childId: number, guardianUserId: number, data: { fullName?: string; schoolName?: string; gradeLevel?: string; birthCertificateUploadId?: number }): Promise<BackToSchoolChild> {
    if (data.birthCertificateUploadId !== undefined) {
      const [certificate] = await db.select().from(fileUploads).where(and(
        eq(fileUploads.id, data.birthCertificateUploadId),
        eq(fileUploads.userId, guardianUserId),
        eq(fileUploads.category, "back_to_school_birth_certificate"),
      ));
      if (!certificate) throw new Error("Upload a valid birth certificate before updating this kiddies account");
    }
    const [updated] = await db.update(backToSchoolChildren).set({
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.schoolName !== undefined ? { schoolName: data.schoolName || null } : {}),
      ...(data.gradeLevel !== undefined ? { gradeLevel: data.gradeLevel || null } : {}),
      ...(data.birthCertificateUploadId !== undefined ? {
        birthCertificateUploadId: data.birthCertificateUploadId,
        certificateStatus: "pending",
        certificateReviewReason: null,
        certificateReviewedAt: null,
        certificateReviewedBy: null,
      } : {}),
    }).where(and(eq(backToSchoolChildren.id, childId), eq(backToSchoolChildren.guardianUserId, guardianUserId))).returning();
    if (!updated) throw new Error("Child profile not found");
    return updated;
  }

  async contributeToBackToSchoolVest(guardianUserId: number, childId: number, amountUsd: number, idempotencyKey: string): Promise<any> {
    return db.transaction(async (tx) => {
      const [createdOperation] = await tx.insert(backToSchoolOperations).values({
        guardianUserId, childId, operation: "deposit", idempotencyKey,
      }).onConflictDoNothing().returning();
      if (!createdOperation) {
        const [priorOperation] = await tx.select().from(backToSchoolOperations).where(and(
          eq(backToSchoolOperations.guardianUserId, guardianUserId),
          eq(backToSchoolOperations.childId, childId),
          eq(backToSchoolOperations.operation, "deposit"),
          eq(backToSchoolOperations.idempotencyKey, idempotencyKey),
        ));
        if (priorOperation?.response) return priorOperation.response;
        throw new Error("A matching contribution is already being processed");
      }
      const [child] = await tx.select().from(backToSchoolChildren)
        .where(and(eq(backToSchoolChildren.id, childId), eq(backToSchoolChildren.guardianUserId, guardianUserId)))
        .for("update");
      if (!child) throw new Error("Child profile not found");
      const [vest] = await tx.select().from(backToSchoolVests)
        .where(and(eq(backToSchoolVests.childId, childId), eq(backToSchoolVests.guardianUserId, guardianUserId)))
        .for("update");
      if (!vest) throw new Error("Piggy Vest not found");
      if (vest.status === "expired") throw new Error("This kiddies account is no longer accepting contributions");

      const currentBalance = Number(vest.balance);
      const nextVestBalance = currentBalance + amountUsd;
      if (nextVestBalance > Number(vest.targetAmount) + 0.00001) {
        throw new Error(`Kiddies wallet deposits cannot exceed $${Number(vest.targetAmount).toFixed(2)}`);
      }
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, guardianUserId)).for("update");
      const { feeAmount: depositFee, totalDebited: walletDebit } = calculateBackToSchoolDeposit(amountUsd);
      if (!wallet || Number(wallet.balance) + 0.00001 < walletDebit) throw new Error("Insufficient SwiftWallet balance including the 5% deposit fee");

      const walletBalance = Number(wallet.balance) - walletDebit;
      const now = new Date();
      const becameFullyFunded = currentBalance < Number(vest.targetAmount) && nextVestBalance >= Number(vest.targetAmount);
      const [updatedVest] = await tx.update(backToSchoolVests)
        .set({
          balance: nextVestBalance.toFixed(2),
          ...(becameFullyFunded ? {
            fundedAt: now,
            cbtUnlockedAt: now,
            qualifiedAt: now,
            status: "qualified",
          } : {}),
          updatedAt: now,
        })
        .where(eq(backToSchoolVests.id, vest.id))
        .returning();
      await tx.update(wallets).set({ balance: walletBalance.toFixed(2) }).where(eq(wallets.userId, guardianUserId));
      await tx.insert(backToSchoolVestTransactions).values({
        vestId: vest.id,
        guardianUserId,
        type: "deposit",
        amountUsd: amountUsd.toFixed(2),
        grossAmountUsd: walletDebit.toFixed(2),
        feeAmountUsd: depositFee.toFixed(2),
        netAmountUsd: amountUsd.toFixed(2),
        balanceAfter: nextVestBalance.toFixed(2),
      });
      await tx.insert(transactions).values({
        userId: guardianUserId,
        type: "transfer",
        amount: (-walletDebit).toFixed(2),
        fee: depositFee.toFixed(2),
        description: `Back to school kiddies deposit for ${child.fullName} (5% fee: $${depositFee.toFixed(2)})`,
      });
      const result = {
        vest: updatedVest,
        walletBalance: walletBalance.toFixed(2),
        depositAmount: amountUsd.toFixed(2),
        feeAmount: depositFee.toFixed(2),
        totalDebited: walletDebit.toFixed(2),
      };
      await tx.update(backToSchoolOperations).set({ response: result }).where(eq(backToSchoolOperations.id, createdOperation.id));
      return result;
    });
  }

  async withdrawFromBackToSchoolVest(guardianUserId: number, childId: number, amountUsd: number, idempotencyKey: string): Promise<any> {
    return db.transaction(async (tx) => {
      const [createdOperation] = await tx.insert(backToSchoolOperations).values({
        guardianUserId, childId, operation: "withdrawal", idempotencyKey,
      }).onConflictDoNothing().returning();
      if (!createdOperation) {
        const [priorOperation] = await tx.select().from(backToSchoolOperations).where(and(
          eq(backToSchoolOperations.guardianUserId, guardianUserId),
          eq(backToSchoolOperations.childId, childId),
          eq(backToSchoolOperations.operation, "withdrawal"),
          eq(backToSchoolOperations.idempotencyKey, idempotencyKey),
        ));
        if (priorOperation?.response) return priorOperation.response;
        throw new Error("A matching withdrawal is already being processed");
      }
      const [child] = await tx.select().from(backToSchoolChildren)
        .where(and(eq(backToSchoolChildren.id, childId), eq(backToSchoolChildren.guardianUserId, guardianUserId)))
        .for("update");
      if (!child) throw new Error("Child profile not found");
      if (child.certificateStatus !== "approved") throw new Error("Birth certificate approval is required before a withdrawal");

      const [vest] = await tx.select().from(backToSchoolVests)
        .where(and(eq(backToSchoolVests.childId, childId), eq(backToSchoolVests.guardianUserId, guardianUserId)))
        .for("update");
      if (!vest) throw new Error("Kiddies wallet not found");
      if (!vest.cbtUnlockedAt && !vest.qualifiedAt) throw new Error("Withdrawals unlock after the kiddies wallet has first reached $30.00");
      if (Number(vest.balance) + 0.00001 < amountUsd) throw new Error("Insufficient kiddies wallet balance");

      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, guardianUserId)).for("update");
      if (!wallet) throw new Error("SwiftWallet not found");
      const { feeAmount: withdrawalFee, netReceived: netCredit } = calculateBackToSchoolWithdrawal(amountUsd);
      if (netCredit <= 0) throw new Error("Withdrawal amount is too small after the 7.5% withdrawal fee");
      const nextVestBalance = Number(vest.balance) - amountUsd;
      const walletBalance = Number(wallet.balance) + netCredit;
      const now = new Date();

      const [updatedVest] = await tx.update(backToSchoolVests).set({
        balance: nextVestBalance.toFixed(2),
        updatedAt: now,
      }).where(eq(backToSchoolVests.id, vest.id)).returning();
      await tx.update(wallets).set({ balance: walletBalance.toFixed(2) }).where(eq(wallets.userId, guardianUserId));
      await tx.insert(backToSchoolVestTransactions).values({
        vestId: vest.id,
        guardianUserId,
        type: "withdrawal",
        amountUsd: (-amountUsd).toFixed(2),
        grossAmountUsd: amountUsd.toFixed(2),
        feeAmountUsd: withdrawalFee.toFixed(2),
        netAmountUsd: netCredit.toFixed(2),
        balanceAfter: nextVestBalance.toFixed(2),
      });
      await tx.insert(transactions).values({
        userId: guardianUserId,
        type: "transfer",
        amount: netCredit.toFixed(2),
        fee: withdrawalFee.toFixed(2),
        description: `Back to school kiddies withdrawal for ${child.fullName} (7.5% fee: $${withdrawalFee.toFixed(2)})`,
      });
      const result = {
        vest: updatedVest,
        walletBalance: walletBalance.toFixed(2),
        withdrawalAmount: amountUsd.toFixed(2),
        feeAmount: withdrawalFee.toFixed(2),
        netReceived: netCredit.toFixed(2),
      };
      await tx.update(backToSchoolOperations).set({ response: result }).where(eq(backToSchoolOperations.id, createdOperation.id));
      return result;
    });
  }

  async getBackToSchoolAttempt(childId: number, guardianUserId: number): Promise<BackToSchoolAttempt | undefined> {
    const [attempt] = await db.select().from(backToSchoolAttempts)
      .where(and(eq(backToSchoolAttempts.childId, childId), eq(backToSchoolAttempts.guardianUserId, guardianUserId)));
    return attempt;
  }

  async createBackToSchoolAttempt(data: { childId: number; guardianUserId: number; questionIds: string[] }): Promise<BackToSchoolAttempt> {
    const [attempt] = await db.insert(backToSchoolAttempts).values({
      childId: data.childId, guardianUserId: data.guardianUserId, questionIds: data.questionIds, status: "started",
    }).returning();
    return attempt;
  }

  async recordBackToSchoolCheatingEvent(data: { childId: number; guardianUserId: number; eventType: string; description: string }): Promise<{ eventCount: number; shouldAutoSubmit: boolean; terminalResult?: any }> {
    return db.transaction(async (tx) => {
      const [attempt] = await tx.select().from(backToSchoolAttempts)
        .where(and(eq(backToSchoolAttempts.childId, data.childId), eq(backToSchoolAttempts.guardianUserId, data.guardianUserId)))
        .for("update");
      if (!attempt || attempt.status !== "started") throw new Error("There is no active spelling-bee attempt for this child");
      const existing = Array.isArray(attempt.cheatingEvents) ? attempt.cheatingEvents : [];
      const events = [...existing, { type: data.eventType, description: data.description, at: new Date().toISOString() }];
      const highSeverity = ["copy_attempt", "paste_attempt", "cut_attempt"].includes(data.eventType);
      const shouldAutoSubmit = highSeverity || events.length >= 5;
      const now = new Date();
      if (shouldAutoSubmit) {
        const [terminalAttempt] = await tx.update(backToSchoolAttempts).set({
          cheatingEvents: events,
          autoSubmitted: true,
          status: "expired",
          score: 0,
          percentage: "0.00",
          completedAt: now,
        }).where(eq(backToSchoolAttempts.id, attempt.id)).returning();
        const [award] = await tx.insert(backToSchoolAwards).values({
          childId: data.childId,
          guardianUserId: data.guardianUserId,
          scorePercentage: "0.00",
          awardAmount: "0.00",
          status: "not_eligible",
        }).onConflictDoNothing().returning();
        return {
          eventCount: events.length,
          shouldAutoSubmit: true,
          terminalResult: {
            attempt: terminalAttempt,
            award: award ?? null,
            score: 0,
            totalQuestions: Array.isArray(attempt.questionIds) ? attempt.questionIds.length : 25,
            percentage: 0,
            awardAmount: 0,
            awardStatus: "not_eligible",
            expired: true,
          },
        };
      }
      await tx.update(backToSchoolAttempts).set({ cheatingEvents: events }).where(eq(backToSchoolAttempts.id, attempt.id));
      return { eventCount: events.length, shouldAutoSubmit: false };
    });
  }

  async completeBackToSchoolAttempt(data: { childId: number; guardianUserId: number; score: number; percentage: number; awardAmount: number; expired?: boolean }): Promise<any> {
    return db.transaction(async (tx) => {
      const [attempt] = await tx.select().from(backToSchoolAttempts)
        .where(and(eq(backToSchoolAttempts.childId, data.childId), eq(backToSchoolAttempts.guardianUserId, data.guardianUserId)))
        .for("update");
      if (!attempt || attempt.status !== "started") throw new Error("There is no active spelling-bee attempt for this child");
      if (attempt.autoSubmitted) throw new Error("This spelling-bee attempt was ended by the assessment integrity controls");
      const now = new Date();
      const [completedAttempt] = await tx.update(backToSchoolAttempts)
        .set({ status: data.expired ? "expired" : "completed", score: data.score, percentage: data.percentage.toFixed(2), completedAt: now })
        .where(eq(backToSchoolAttempts.id, attempt.id))
        .returning();
      const status = data.awardAmount > 0 ? "recommended" : "not_eligible";
      const [award] = await tx.insert(backToSchoolAwards).values({
        childId: data.childId, guardianUserId: data.guardianUserId,
        scorePercentage: data.percentage.toFixed(2), awardAmount: data.awardAmount.toFixed(2), status,
      }).returning();
      return { attempt: completedAttempt, award };
    });
  }

  async getBackToSchoolAdminProgramme(): Promise<any[]> {
    const children = await db.select().from(backToSchoolChildren).orderBy(desc(backToSchoolChildren.createdAt));
    if (!children.length) return [];
    const childIds = children.map(child => child.id);
    const guardianIds = Array.from(new Set(children.map(child => child.guardianUserId)));
    const certificateIds = children.map(child => child.birthCertificateUploadId).filter((id): id is number => typeof id === "number");
    const [vests, attempts, awards, guardians, certificates, proctoring] = await Promise.all([
      db.select().from(backToSchoolVests).where(inArray(backToSchoolVests.childId, childIds)),
      db.select().from(backToSchoolAttempts).where(inArray(backToSchoolAttempts.childId, childIds)),
      db.select().from(backToSchoolAwards).where(inArray(backToSchoolAwards.childId, childIds)),
      db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(inArray(users.id, guardianIds)),
      certificateIds.length ? db.select({ id: fileUploads.id, fileName: fileUploads.fileName, fileType: fileUploads.fileType }).from(fileUploads).where(inArray(fileUploads.id, certificateIds)) : Promise.resolve([]),
      db.select().from(proctoringSessions).where(inArray(proctoringSessions.childId, childIds)),
    ]);
    const vestByChild = new Map(vests.map(record => [record.childId, record]));
    const attemptByChild = new Map(attempts.map(record => [record.childId, record]));
    const awardByChild = new Map(awards.map(record => [record.childId, record]));
    const guardianById = new Map(guardians.map(record => [record.id, record]));
    const certificateById = new Map(certificates.map(record => [record.id, record]));
    const proctoringByChild = new Map<number, any>();
    for (const session of proctoring) {
      if (session.childId && (!proctoringByChild.has(session.childId) || new Date(proctoringByChild.get(session.childId).createdAt) < new Date(session.createdAt))) proctoringByChild.set(session.childId, session);
    }
    return children.map(child => ({
      ...child,
      guardian: guardianById.get(child.guardianUserId) ?? null,
      vest: vestByChild.get(child.id) ?? null,
      attempt: attemptByChild.get(child.id) ?? null,
      award: awardByChild.get(child.id) ?? null,
      certificate: child.birthCertificateUploadId ? certificateById.get(child.birthCertificateUploadId) ?? null : null,
      proctoring: proctoringByChild.get(child.id) ?? null,
    }));
  }

  async getBackToSchoolCertificate(childId: number): Promise<{ child: BackToSchoolChild; file: FileUpload } | undefined> {
    const [child] = await db.select().from(backToSchoolChildren).where(eq(backToSchoolChildren.id, childId));
    if (!child?.birthCertificateUploadId) return undefined;
    const [file] = await db.select().from(fileUploads).where(eq(fileUploads.id, child.birthCertificateUploadId));
    return file ? { child, file } : undefined;
  }

  async reviewBackToSchoolCertificate(data: { childId: number; adminUserId: number; approved: boolean; reason?: string }): Promise<BackToSchoolChild> {
    return db.transaction(async (tx) => {
      const [existingChild] = await tx.select().from(backToSchoolChildren)
        .where(eq(backToSchoolChildren.id, data.childId)).for("update");
      if (!existingChild) throw new Error("Kiddies account not found");
      if (data.approved) {
        if (!existingChild.birthCertificateUploadId) throw new Error("A birth certificate is required before approval");
        const [certificate] = await tx.select().from(fileUploads).where(and(
          eq(fileUploads.id, existingChild.birthCertificateUploadId),
          eq(fileUploads.userId, existingChild.guardianUserId),
          eq(fileUploads.category, "back_to_school_birth_certificate"),
        )).for("update");
        if (!certificate) throw new Error("The linked birth certificate is missing or does not belong to this guardian");
      }
      const [child] = await tx.update(backToSchoolChildren).set({
        certificateStatus: data.approved ? "approved" : "declined",
        certificateReviewReason: data.reason?.trim() || null,
        certificateReviewedBy: data.adminUserId,
        certificateReviewedAt: new Date(),
      }).where(eq(backToSchoolChildren.id, data.childId)).returning();
      return child;
    });
  }

  async reviewBackToSchoolAward(data: { awardId: number; adminUserId: number; approved: boolean; reason?: string }): Promise<any> {
    return db.transaction(async (tx) => {
      const [award] = await tx.select().from(backToSchoolAwards).where(eq(backToSchoolAwards.id, data.awardId)).for("update");
      if (!award) throw new Error("Award recommendation not found");
      if (award.status !== "recommended") throw new Error("Only pending award recommendations can be reviewed");
      const [updated] = await tx.update(backToSchoolAwards).set({
        status: data.approved ? "approved" : "declined",
        reviewedBy: data.adminUserId,
        reviewReason: data.reason?.trim() || null,
        reviewedAt: new Date(),
      }).where(eq(backToSchoolAwards.id, award.id)).returning();
      return updated;
    });
  }

  async payBackToSchoolAward(data: { awardId: number; adminUserId: number; reference: string }): Promise<any> {
    return db.transaction(async (tx) => {
      const [award] = await tx.select().from(backToSchoolAwards).where(eq(backToSchoolAwards.id, data.awardId)).for("update");
      if (!award) throw new Error("Award recommendation not found");
      if (award.status !== "approved") throw new Error("Only approved awards can be credited");
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, award.guardianUserId)).for("update");
      if (!wallet) throw new Error("Guardian SwiftWallet not found");
      const amount = Number(award.awardAmount);
      const now = new Date();
      const walletBalance = Number(wallet.balance) + amount;
      const [paidAward] = await tx.update(backToSchoolAwards).set({
        status: "paid",
        reviewedBy: data.adminUserId,
        paidAt: now,
        paymentReference: data.reference,
      }).where(eq(backToSchoolAwards.id, award.id)).returning();
      await tx.update(wallets).set({ balance: walletBalance.toFixed(2) }).where(eq(wallets.userId, award.guardianUserId));
      await tx.insert(transactions).values({
        userId: award.guardianUserId,
        type: "sponsorship_credit",
        amount: amount.toFixed(2),
        fee: "0.00",
        description: `Back to school kiddies grant paid (${data.reference})`,
      });
      return { award: paidAward, walletBalance: walletBalance.toFixed(2) };
    });
  }

  // ── Cashback ────────────────────────────────────────────────────────────────
  async getCashbackBalance(userId: number): Promise<string> {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.cashbackBalance ?? "0.00";
  }

  async getScholarship(userId: number, type: string): Promise<Scholarship | undefined> {
    const [row] = await db.select().from(scholarships).where(and(eq(scholarships.userId, userId), eq(scholarships.type, type))).orderBy(desc(scholarships.createdAt)).limit(1);
    return row;
  }

  async createScholarship(data: Partial<InsertScholarship> & { userId: number; type: string }): Promise<Scholarship> {
    const now = new Date();
    const [row] = await db.insert(scholarships).values({ ...data, updatedAt: now } as any).returning();
    return row;
  }

  async updateScholarship(id: number, data: Partial<Scholarship>): Promise<Scholarship> {
    const [row] = await db.update(scholarships).set({ ...data, updatedAt: new Date() } as any).where(eq(scholarships.id, id)).returning();
    return row;
  }

  async deleteScholarship(id: number): Promise<void> {
    await db.delete(scholarships).where(eq(scholarships.id, id));
  }

  async getAllScholarships(): Promise<(Scholarship & { user: User })[]> {
    const rows = await db.select().from(scholarships).orderBy(desc(scholarships.createdAt));
    const result: (Scholarship & { user: User })[] = [];
    for (const row of rows) {
      const user = await this.getUser(row.userId);
      if (user) result.push({ ...row, user });
    }
    return result;
  }

  async createResearchGrant(data: InsertResearchGrant): Promise<ResearchGrant> {
    const [row] = await db.insert(researchGrants).values(data as any).returning();
    return row;
  }

  async getResearchGrantsByUser(userId: number): Promise<ResearchGrant[]> {
    return db.select().from(researchGrants).where(eq(researchGrants.userId, userId)).orderBy(desc(researchGrants.createdAt));
  }

  async getAllResearchGrants(): Promise<(ResearchGrant & { user: Pick<User,"firstName"|"lastName"|"email"> })[]> {
    const rows = await db.select().from(researchGrants).orderBy(desc(researchGrants.createdAt));
    const result: (ResearchGrant & { user: Pick<User,"firstName"|"lastName"|"email"> })[] = [];
    for (const row of rows) {
      const u = await this.getUser(row.userId);
      if (u) result.push({ ...row, user: { firstName: u.firstName, lastName: u.lastName, email: u.email } });
    }
    return result;
  }

  async updateResearchGrant(id: number, data: Partial<ResearchGrant>): Promise<ResearchGrant> {
    const [row] = await db.update(researchGrants).set(data as any).where(eq(researchGrants.id, id)).returning();
    return row;
  }

  async addCashback(userId: number, amountUsd: number): Promise<void> {
    if (amountUsd <= 0) return;
    const wallet = await this.getOrCreateWallet(userId);
    const current = parseFloat(wallet.cashbackBalance ?? "0.00");
    const updated = (current + amountUsd).toFixed(2);
    await db.update(wallets).set({ cashbackBalance: updated }).where(eq(wallets.userId, userId));
  }

  async withdrawCashbackToWallet(userId: number, amountUsd: number): Promise<{ cashbackBalance: string; walletBalance: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const cashback = parseFloat(wallet.cashbackBalance ?? "0.00");
    if (amountUsd <= 0) throw new Error("Amount must be greater than 0");
    if (cashback < amountUsd) throw new Error(`Insufficient cashback balance. You have $${cashback.toFixed(2)}`);
    const newCashback = (cashback - amountUsd).toFixed(2);
    const newWallet = (parseFloat(wallet.balance) + amountUsd).toFixed(2);
    await db.update(wallets).set({ cashbackBalance: newCashback, balance: newWallet }).where(eq(wallets.userId, userId));
    await this.createTransaction({
      userId,
      type: "transfer",
      amount: amountUsd.toFixed(2),
      fee: "0.00",
      paymentMethod: "cashback",
      description: `Cashback withdrawal — $${amountUsd.toFixed(2)} moved to personal wallet`,
    });
    return { cashbackBalance: newCashback, walletBalance: newWallet };
  }
}

export const storage = new DatabaseStorage();
