# TSIA - Tuition Support Initiative for Africa
TSIA is a full-stack education fintech platform that manages student sponsorship funding and onboarding for African students.

## Run & Operate
- **Run development server:** `npm run dev`
- **Build for production:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Generate Drizzle migrations:** `drizzle-kit generate:pg`
- **Push Drizzle schema to DB:** `drizzle-kit push:pg`
- **Environment Variables:**
    - `EXTERNAL_DATABASE_URL`: External PostgreSQL connection string used by this project
    - `JWT_SECRET`: Secret for JWTs
    - `OTP_SECRET`: Secret for OTP generation
    - `PAYSTACK_SECRET_KEY`: Paystack API secret key
    - `BREVO_API_KEY`: Brevo (email service) API key
    - `TRONSCAN_API_KEY`: TronScan API key for crypto verification
    - `BSCSCAN_API_KEY`: BscScan API key for crypto verification
    - `ADMIN_EMAIL`: Admin user's email
    - `ADMIN_PASSWORD`: Admin user's password

## Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion, wouter (routing)
- **Backend:** Express.js, session-based authentication
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** _Populate as you build_
- **Build Tool:** Vite

## Where things live
- **Frontend Source:** `src/`
- **Backend Source:** `server/`
- **Database Schema:** `drizzle/schema.ts`
- **API Routes:** `server/api/`
- **UI Components:** `src/components/`
- **Theme Configuration:** `src/theme/` (CSS custom properties, `ThemeProvider.tsx`)
- **DB Migrations:** `drizzle/migrations/`
- **Notification Types:** `src/lib/notifications.ts` (TYPE_META)
- **Platform Settings:** `platform_settings` table in DB
- **Webhook Endpoints:**
    - Korapay: `/api/webhook/korapay`
    - Squad: `/api/webhook/squad`

## Architecture decisions
- **Monorepo Structure:** Frontend and backend code reside in a single repository for easier development and deployment.
- **Session-based Authentication:** Chosen for simplicity and direct control over user sessions, especially for role switching.
- **Drizzle ORM:** Selected for its type-safety and performance benefits with PostgreSQL.
- **Base64 File Uploads:** Smaller files (e.g., verification documents) are stored as base64 strings directly in the database to simplify deployment and avoid external storage dependencies.
- **In-app Notifications with SSE:** Real-time user notifications are pushed via Server-Sent Events (SSE) for immediate feedback without constant polling (though some polling is used for fallback/status updates).
- **Wallet Activation Gate:** Most platform features are locked until a minimum wallet funding for user engagement and to ensure financial commitment.

## Product
- **Student Sponsorship:** Facilitates funding and onboarding for African students, including WAEC verification and tiered payouts.
- **Affiliate Program:** Allows users to earn commissions by referring students, with a separate dashboard and referral tracking.
- **Digital Wallet & Payments:** Secure wallet for transactions, deposits, withdrawals, and bill payments with VAT handling.
- **Trade Market:** Global Trade Market with crypto (USDT TRC20/BEP20) deposits/withdrawals, AI bot trading, and a reserve fund.
- **Co-Affiliate/Initiator Programme:** Investment program with tiered participation and lifetime profit sharing.
- **Tenancy Programme:** Connects landlords with tenants, offering upfront payments to landlords and installment plans for tenants.
- **Loan Programs:** Offers student and affiliate business loans with eligibility checks and application processes.
- **Community Forum:** A platform for users to discuss topics, with CRUD functionality and liking.
- **E-commerce & Chat:** Features product listings, real-time chat with sellers, and WebRTC voice calls.
- **Customer Support:** AI-powered chatbot with a knowledge base and WhatsApp fallback.
- **Admin Panel:** Tools for managing verifications, disbursements, user accounts, and platform settings.

## User preferences
_Populate as you build_

## Gotchas
- **Wallet Activation:** Many features are gated by a minimum wallet activation ($5). Ensure the wallet is funded for full functionality.
- **Sponsorship Batch System:** Sponsorship enrollment is subject to batch capacity. If a batch is full, payment will be rejected with a `BATCH_CLOSED` code.
- **Co-Affiliate Pool Rate:** The co-affiliate pool rate can be overridden by an admin; otherwise, it's auto-tiered.
- **Crypto Deposit Verification:** Crypto deposits are initially auto-credited but undergo a background verification process. Invalid deposits will be reversed.
- **Inactivity Logout:** Users are automatically logged out after 15 minutes of inactivity in dashboards.
- **OTP Codes:** In development, OTP codes are logged to the server console; in production, they are sent via SMS/email.

## Pointers
- **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **shadcn/ui Docs:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
- **React Docs:** [https://react.dev/](https://react.dev/)
- **Express.js Docs:** [https://expressjs.com/](https://expressjs.com/)
- **PostgreSQL Docs:** [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **WebRTC (MDN):** [https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- **Paystack API Docs:** [https://paystack.com/docs](https://paystack.com/docs)
- **Brevo (Sendinblue) Docs:** [https://developers.brevo.com/docs](https://developers.brevo.com/docs)
- **TronScan API:** [https://developers.tron.network/docs/tronscan-api-reference](https://developers.tron.network/docs/tronscan-api-reference)
- **BscScan API:** [https://docs.bscscan.com/](https://docs.bscscan.com/)