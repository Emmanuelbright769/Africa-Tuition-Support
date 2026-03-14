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
- 2-step onboarding: Step 1 Identity (NIN + document upload) → Step 2 WAEC (5 subjects + school info + facial biometric + $3 fee)
- WAEC: 2 compulsory (Mathematics + English Language) + 3 electives
- WAEC grading weights: A1=15, B2=13, B3=12, C4=11, C5=10, C6=9, D7=8, E8=7, F9=6
- Payout tiers by WAEC percentage: 75-100% = Platinum ($225-$230), 60-74% = Gold ($160-$180), 50-59% = Silver ($110-$130)
- Currency conversion: payments at ₦1,460/USD, payouts at ₦1,280/USD
- Digital wallet with 7.5% VAT on bank withdrawals
- Affiliate program (separate from students) with own signup, dashboard, referral codes
- MSc "Coming Soon" section (always disabled)
- About Us and Contact Us pages
- Admin panel: verify students, approve/reject, process disbursements (24-48hr SLA)
- Leadership sponsorship page for corporate cohorts (100+ students)
- File upload support for verification documents (JPEG, PNG, WebP, PDF up to 5MB)
- Real TSIA logos via Logo.tsx component (horizontal/badge/full variants, light/dark auto-switching)

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

## Pages
- `/` - Landing page (carousel, how-it-works, affiliate section, sponsorship plans, MSc coming soon, about preview, contact preview)
- `/signup` - Student signup (OTP)
- `/login` - OTP login (routes to correct dashboard by role)
- `/onboarding` - 2-step student verification flow
- `/dashboard` - Student dashboard (wallet, plan selection, transactions, onboarding button)
- `/affiliate-signup` - Affiliate signup (separate from student)
- `/affiliate-dashboard` - Affiliate portal (referral code, link, referral list, tips)
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
