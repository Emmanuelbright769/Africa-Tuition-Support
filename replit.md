# TSIA - Tuition Support Initiative for Africa

## Overview
Full-stack education fintech platform that manages student sponsorship funding and onboarding for African students.

## Architecture
- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)
- **File Uploads**: multer (memory storage → base64 in DB)

## Recent Updates (Session 4)
- **Login redesign**: Always shows Student/Affiliate role selector as Step 0; one email can hold both account types; role is chosen first before email entry
- **Live Notification System**: `NotificationBell` component in both dashboards; polls every 30s; supports types: bot_reminder, chat_message, order_update, wallet_credit, loan_update, verification_update, referral, trade_deposit, system; auto-creates bot reminders at 12:28–12:35 PM and 1:00–1:05 PM UK time for affiliates; notifications fired on: new chat message, order placed/sold, wallet deposit confirmed, verification approved/rejected, referral signup
- **Trade bot enforcement**: Bot cannot be turned on/off unless tradeBalance ≥ $10 (TRADE_MARKET.MIN_DEPOSIT); shows clear "Investment plan required" message with deposit CTA
- **`notifications` DB table**: Created with `notification_type` enum; indexes on (user_id, is_read); storage methods: createNotification, getNotifications, markAllNotificationsRead, clearNotifications, hasBotReminderToday; API routes: GET/PATCH/DELETE/POST /api/notifications

## Key Features
- Public landing page with auto-sliding carousel (6s interval)
- Responsive hamburger navigation for mobile + desktop
- Dark mode toggle (light / dark / system auto-detect)
- Passwordless OTP authentication (6-digit codes, 10-min expiry)
- 2-step onboarding: Step 1 Identity (NIN + document upload) → Step 2 WAEC (5 subjects + school info + facial biometric + $3 fee)
- WAEC: 2 compulsory (Mathematics + English Language) + 3 electives
- WAEC grading weights: A1=15, B2=13, B3=12, C4=11, C5=10, C6=9, D7=8, E8=7, F9=6
- Payout tiers by WAEC percentage: 75-100% = Platinum ($225-$230), 60-74% = Gold ($160-$180), 50-59% = Silver ($110-$130)
- Currency conversion: payments at ₦1,460/USD, payouts at ₦1,280/USD
- Digital wallet with 7.5% VAT on bank withdrawals
- Affiliate program (separate from students) with own signup, dashboard, referral codes
- Co-Affiliate/Initiator Programme: 1M investor cap, 3 tiers ($100/$200/$500), +20% price per 150k milestone, lifetime 5% TSIA profit share proportional to category
- Co-Affiliate routes: GET /api/co-affiliate/program, GET /api/co-affiliate/my-info, POST /api/co-affiliate/subscribe
- Student loan programme: active for verified students; Platinum=$200, Gold=$150, Silver=$100 limit; 10%/yr flat; 6/12/18-month terms; eligibility check, live calculator, application form, loan history
- Affiliate business loan: active when referralCount>0 or tradeBalance>0; base $500 + $50/referral + 50% tradeBalance × co-affiliate multiplier (max $5k); 15%/yr flat; 6/12/24-month terms
- Loan API routes: GET /api/loans/limit, GET /api/loans/my-loans, POST /api/loans/apply
- MSc "Coming Soon" section (always disabled)
- About Us and Contact Us pages
- Admin panel: verify students, approve/reject, process disbursements (24-48hr SLA)
- Leadership sponsorship page for corporate cohorts (100+ students)
- File upload support for verification documents (JPEG, PNG, WebP, PDF up to 5MB)
- Real TSIA logos via Logo.tsx component (horizontal/badge/full variants, light/dark auto-switching)
- Global Trade Market (TRC20/BEP20 USDT deposits/withdrawals, 20% reserve fund, 100% ROI @ 2% daily AI BOT, broker selection from 7 brokers, live TradingView chart)
- Co-Affiliate Trust Fund (1M investor cap, 3 tiers $100/$300/$500-$10k, +20% milestone pricing, 5% lifetime profit share)
- TOUR AFRICA (Dispatch + E-Taxi at /tour-africa)
- Landlord Tenancy Programme (/tenancy): landlords list property → TSIA pays lump-sum upfront (12% disc); tenants pay monthly installments at 5% interest
- AffiliateDashboard tenancy nav section: shows affiliate's listed properties, links to /tenancy portal, quick stats
- AI Customer Care Assistant (floating chatbot with 14+ KB entries, quick-action chips, WhatsApp fallback wa.me/2348012345678)
- 15-minute inactivity auto-logout on both student and affiliate dashboards
- ErrorBoundary wrapping all pages to prevent blank screen crashes

## User Roles
- **student** - Signs up, completes onboarding (NIN + WAEC + biometric + $3 fee), gets sponsored
- **affiliate** - Non-students who earn commission by referring eligible students; separate signup (/affiliate-signup) and dashboard (/affiliate-dashboard)
- **admin** - Reviews verifications, processes disbursements (admin@tsia.org / admin123)

## Database Schema
- `users` - Student, affiliate, and admin accounts (role enum: student/admin/affiliate)
- `otp_codes` - One-time login codes with expiry
- `verifications` - NIN, WAEC data (subjects, grades, school info, biometric), tier, percentage score, payout range
- `file_uploads` - Uploaded documents stored as base64
- `sponsorship_plans` - Selected plan per student
- `wallets` - Balance per student
- `transactions` - All financial activity
- `disbursements` - Admin-processed payouts
- `leadership_inquiries` - Corporate sponsorship requests
- `co_affiliates` - Co-affiliate Trust Fund subscriptions (tier, investment, status)
- `trade_wallets` - Trade Market wallet (TRC20/BEP20 addresses, balance)
- `trade_transactions` - All Trade Market deposits/withdrawals
- `trade_reserve_fund` - Aggregated reserve fund balance
- `affiliate_trade_shares` - Per-deposit affiliate pool shares
- `landlord_properties` - Tenancy properties listed by users (status: pending_review/available/leased)
- `tenancy_leases` - Active tenant lease agreements
- `tenancy_payments` - Monthly tenancy payment records

## API Routes (all prefixed /api)
- Auth: `/auth/request-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/logout`, `/auth/login` (admin legacy)
- Upload: `/upload` (POST multipart), `/uploads` (GET)
- Verification: `/verification/identity`, `/verification/waec-validate`, `/verification/biometric`, `/verification/pay-fee`, `/verification/academic`, `/verification/status`
- Wallet: `/wallet`, `/wallet/withdraw`
- Sponsorship: `/sponsorship/select`, `/sponsorship/plan`
- Affiliate: `/affiliate/info`
- Currency: `/currency-rates`
- Admin: `/admin/stats`, `/admin/students`, `/admin/pending-verifications`, `/admin/verify/:id`, `/admin/pending-disbursements`, `/admin/process-disbursement/:id`
- Leadership: `/leadership/inquiry`
- Co-Affiliate: `/co-affiliate/program`, `/co-affiliate/my-info`, `/co-affiliate/subscribe`
- Trade Market: `/trade/wallet`, `/trade/deposit`, `/trade/withdraw`, `/trade/connect-wallet`, `/trade/transactions`, `/trade/reserve-fund`
- Tenancy: `/tenancy/properties`, `/tenancy/my-properties`, `/tenancy/list-property`, `/tenancy/apply`, `/tenancy/my-leases`

## Pages
- `/` - Landing page (carousel, how-it-works, affiliate section, sponsorship plans, tenancy section, MSc coming soon, about preview, contact preview)
- `/signup` - Student signup (OTP)
- `/login` - OTP login (routes to correct dashboard by role)
- `/onboarding` - 2-step student verification flow
- `/dashboard` - Student dashboard (wallet, plan selection, transactions, onboarding button)
- `/affiliate-signup` - Affiliate signup (separate from student)
- `/affiliate-dashboard` - Affiliate portal (Co-Affiliate tier, Trade Market with broker selection + live TradingView chart, wallet, referrals, loan)
- `/tour-africa` - TOUR AFRICA (Dispatch + E-Taxi service)
- `/tenancy` - Tenancy Programme (browse properties, list property, calculator, how-it-works)
- `/admin` - Admin panel
- `/leadership` - Leadership sponsorship page
- `/about` - About Us
- `/contact` - Contact Us

## Demo Access
- Admin: admin@tsia.org / admin123
- Students: sign up through /signup (OTP shown in demo hint)
- Affiliates: sign up through /affiliate-signup (OTP shown in demo hint)
- OTP codes are logged to server console for development

## Theme System
- Uses CSS custom properties with `.dark` class toggle
- ThemeProvider stores preference in localStorage as "tsia-theme"
- Three modes: light, dark, system (auto-detects OS preference)
