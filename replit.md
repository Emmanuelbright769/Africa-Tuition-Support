# TSIA - Tuition Support Initiative for Africa

## Overview
Full-stack education fintech platform that manages student sponsorship funding and onboarding for African students.

## Architecture
- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)
- **File Uploads**: multer (memory storage → base64 in DB)

## Key Features
- Public landing page with auto-sliding carousel (6s interval)
- Responsive hamburger navigation for mobile + desktop
- Dark mode toggle (light / dark / system auto-detect)
- Passwordless OTP authentication (6-digit codes, 10-min expiry)
- 3-step onboarding: Identity (NIN + document upload) → $3 fee payment → WAEC validation
- WAEC grading weights: A1=15, B2=13, B3=12, C4=11, C5=10, C6=9, D7=8, E8=7, F9=6
- Payout tiers by WAEC percentage: 75-100% = Platinum ($225-$230), 60-74% = Gold ($160-$180), 50-59% = Silver ($110-$130)
- Currency conversion: payments at ₦1,460/USD, payouts at ₦1,280/USD
- Digital wallet with 7.5% VAT on bank withdrawals
- Admin panel: verify students, approve/reject, process disbursements (24-48hr SLA)
- Leadership sponsorship page for corporate cohorts (100+ students)
- File upload support for verification documents (JPEG, PNG, WebP, PDF up to 5MB)

## Database Schema
- `users` - Student and admin accounts (passwordless via OTP)
- `otp_codes` - One-time login codes with expiry
- `verifications` - NIN, WAEC data, tier, percentage score, payout range
- `file_uploads` - Uploaded documents stored as base64
- `sponsorship_plans` - Selected plan per student
- `wallets` - Balance per student
- `transactions` - All financial activity
- `disbursements` - Admin-processed payouts
- `leadership_inquiries` - Corporate sponsorship requests

## API Routes (all prefixed /api)
- Auth: `/auth/request-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/logout`, `/auth/login` (admin legacy)
- Upload: `/upload` (POST multipart), `/uploads` (GET)
- Verification: `/verification/identity`, `/verification/pay-fee`, `/verification/academic`, `/verification/status`
- Wallet: `/wallet`, `/wallet/withdraw`
- Sponsorship: `/sponsorship/select`, `/sponsorship/plan`
- Currency: `/currency-rates`
- Admin: `/admin/stats`, `/admin/students`, `/admin/pending-verifications`, `/admin/verify/:id`, `/admin/pending-disbursements`, `/admin/process-disbursement/:id`
- Leadership: `/leadership/inquiry`

## Demo Access
- Admin: admin@tsia.org / admin123
- Students: sign up through the app (OTP shown in demo hint)
- OTP codes are logged to server console for development

## Theme System
- Uses CSS custom properties with `.dark` class toggle
- ThemeProvider stores preference in localStorage as "tsia-theme"
- Three modes: light, dark, system (auto-detects OS preference)
