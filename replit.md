# TSIA - Tuition Support Initiative for Africa

## Overview
Full-stack education fintech platform that manages student sponsorship funding and onboarding for African students.

## Architecture
- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)

## Key Features
- Public landing page with auto-sliding carousel
- Student signup/login with 2FA flow
- 3-step onboarding: NIN verification, WAEC academic details, $3 portal fee
- 30-day commitment countdown after verification
- Sponsorship plans: 1yr/$35 ($230 payout), 2yr/$45 ($460), 3yr/$50 ($690)
- Academic Performance Matrix: Platinum (6+ A's), Gold (4-5 A's), Silver (Pass)
- Digital wallet with 7.5% VAT on bank withdrawals
- Admin panel: verify students, approve/reject, process disbursements (24-48hr SLA)
- Leadership sponsorship page for corporate cohorts (100+ students)

## Database Schema
- `users` - Student and admin accounts
- `verifications` - NIN, WAEC data, tier, portal fee status
- `sponsorship_plans` - Selected plan per student
- `wallets` - Balance per student
- `transactions` - All financial activity
- `disbursements` - Admin-processed payouts
- `leadership_inquiries` - Corporate sponsorship requests

## API Routes (all prefixed /api)
- Auth: `/auth/signup`, `/auth/login`, `/auth/me`, `/auth/logout`
- Verification: `/verification/identity`, `/verification/academic`, `/verification/pay-fee`, `/verification/status`
- Wallet: `/wallet`, `/wallet/withdraw`
- Sponsorship: `/sponsorship/select`, `/sponsorship/plan`
- Admin: `/admin/stats`, `/admin/students`, `/admin/pending-verifications`, `/admin/verify/:id`, `/admin/pending-disbursements`, `/admin/process-disbursement/:id`
- Leadership: `/leadership/inquiry`

## Demo Credentials
- Admin: admin@tsia.org / admin123
- Students: sign up through the app
