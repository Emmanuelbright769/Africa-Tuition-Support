import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Shield, AlertTriangle, Globe, Scale, Lock, CreditCard, Users, TrendingUp, ShoppingBag, Home, Plane, Handshake } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const EFFECTIVE_DATE = "1 May 2026";
const COMPANY = "SMAKEMGGOLD Ltd";
const RC = "1359954";
const CONTACT_EMAIL = "legal@tsia.org";
const ADMIN_EMAIL = "admin@tsiforafrica.com";

interface SectionProps {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function Section({ id, icon: Icon, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-tsia-green/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-tsia-green" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-3 pl-13">
        {children}
      </div>
    </section>
  );
}

function Clause({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 border rounded-xl p-4">
      <p className="font-bold text-foreground text-sm mb-1">{num}. {title}</p>
      <div className="text-sm text-muted-foreground space-y-1">{children}</div>
    </div>
  );
}

const TOC = [
  { id: "company", label: "Company Information" },
  { id: "definitions", label: "Definitions" },
  { id: "eligibility", label: "Eligibility & Registration" },
  { id: "accounts", label: "User Accounts & Security" },
  { id: "verification", label: "Student Verification Process" },
  { id: "sponsorship", label: "Sponsorship & Payouts" },
  { id: "wallet", label: "Digital Wallet & Payments" },
  { id: "trade", label: "Trade Market & Investment" },
  { id: "affiliate", label: "Affiliate Program" },
  { id: "coaffiliate", label: "Co-Affiliate Trust Fund" },
  { id: "ecommerce", label: "TS-Mart Online Stores" },
  { id: "tenancy", label: "Tenancy Program" },
  { id: "loans", label: "Student & Business Loans" },
  { id: "tour", label: "Glide Africa" },
  { id: "privacy", label: "Privacy & Data Protection" },
  { id: "prohibited", label: "Prohibited Activities" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "disputes", label: "Disputes & Governing Law" },
  { id: "amendments", label: "Amendments & Termination" },
];

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans">

      {/* Header */}
      <div className="bg-card/90 backdrop-blur sticky top-0 z-40 border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 cursor-pointer">
              <Logo variant="badge" height={28} />
              <span className="text-sm font-bold text-muted-foreground hidden sm:block">TSIA</span>
            </a>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Terms &amp; Conditions</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl">

        {/* Back */}
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </a>
        </Link>

        {/* Hero */}
        <div className="bg-gradient-to-r from-tsia-green/10 to-tsia-gold/10 border rounded-3xl p-8 mb-10 text-center">
          <div className="w-16 h-16 bg-tsia-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8 text-tsia-green" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Terms &amp; Conditions</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please read these terms carefully before using the TSIA platform. By creating an account, making any payment, or using any service, you confirm that you have read, understood, and agree to be bound by these terms.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground flex-wrap">
            <span className="bg-card border rounded-full px-3 py-1">Effective: {EFFECTIVE_DATE}</span>
            <span className="bg-card border rounded-full px-3 py-1">Registered: {COMPANY} (RC: {RC})</span>
            <span className="bg-card border rounded-full px-3 py-1">Governing Law: England &amp; Wales</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-10">

          {/* Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 bg-card border rounded-2xl p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Contents</p>
              <nav className="space-y-1">
                {TOC.map(({ id, label }) => (
                  <a key={id} href={`#${id}`}
                    className="block text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1.5 rounded-lg transition-colors">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-12">

            {/* 1. Company Information */}
            <Section id="company" icon={Globe} title="1. Company Information">
              <p>
                The TSIA platform is operated by <strong className="text-foreground">{COMPANY}</strong>, a company registered in England and Wales under Company Registration Number <strong className="text-foreground">{RC}</strong>. Our registered office is in the United Kingdom; however, our operational presence extends across Africa, primarily through our Nigerian operations.
              </p>
              <p>
                For any legal correspondence, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-tsia-green underline">{CONTACT_EMAIL}</a>. For platform support: <a href={`mailto:${ADMIN_EMAIL}`} className="text-tsia-green underline">{ADMIN_EMAIL}</a>.
              </p>
              <p>
                "TSIA" stands for <em>Tuition Support Initiative for Africa</em>. Our mission is to democratise education funding, housing access, and financial empowerment across the African continent and the African diaspora.
              </p>
            </Section>

            {/* 2. Definitions */}
            <Section id="definitions" icon={FileText} title="2. Definitions">
              <p>In these Terms, the following definitions apply:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { term: "\"Platform\"", def: "The TSIA web application and all associated services." },
                  { term: "\"User\"", def: "Any individual who registers an account on the Platform." },
                  { term: "\"Student\"", def: "A User who has registered and completed the student verification process." },
                  { term: "\"Affiliate\"", def: "A User registered under the TSIA Affiliate (Business) Programme." },
                  { term: "\"Wallet\"", def: "The personal digital wallet issued to each verified User on the Platform." },
                  { term: "\"Portal Fee\"", def: "The one-time, non-refundable $3 verification fee payable during student onboarding." },
                  { term: "\"VAT\"", def: "Value Added Tax at 7.5% applied to bank withdrawals in accordance with UK regulations." },
                  { term: "\"APM\"", def: "Academic Performance Matrix — TSIA's proprietary algorithm for WAEC score assessment." },
                  { term: "\"KYC\"", def: "Know Your Customer — the identity verification steps required for wallet activation." },
                  { term: "\"Bot Window\"", def: "The active trading period for the AI trade bot: 1:00 PM – 1:00 AM GMT on working days." },
                ].map(({ term, def }) => (
                  <div key={term} className="bg-muted/30 border rounded-xl p-3">
                    <p className="font-bold text-foreground text-xs">{term}</p>
                    <p className="text-xs mt-0.5">{def}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* 3. Eligibility */}
            <Section id="eligibility" icon={Users} title="3. Eligibility &amp; Registration">
              <Clause num="3.1" title="Age Requirement">
                <p>You must be at least <strong>16 years of age</strong> to register as a student. Business (Affiliate) accounts require the User to be at least <strong>18 years of age</strong>. By registering, you confirm that you meet the applicable age requirement.</p>
              </Clause>
              <Clause num="3.2" title="Geographic Eligibility">
                <p>The TSIA student sponsorship programme is open to students of African origin or descent, whether residing in Africa or in the diaspora. The Affiliate Programme is open to adults worldwide, subject to applicable local laws.</p>
              </Clause>
              <Clause num="3.3" title="One Account Per Identity">
                <p>Each National Identification Number (NIN), BVN, and/or biometric profile may only be associated with one (1) TSIA student account. Using a second identity to create duplicate accounts is strictly prohibited and will result in permanent suspension.</p>
              </Clause>
              <Clause num="3.4" title="Dual Account">
                <p>A single email address may hold both a <strong>Student</strong> and an <strong>Affiliate</strong> account simultaneously. These are treated as two separate roles under the same login credential. Access is switched from within the dashboard.</p>
              </Clause>
              <Clause num="3.5" title="Truthful Information">
                <p>You agree to provide accurate, complete, and current information at all times. Providing false or misleading information — including false WAEC results, NIN, BVN, location data, or biometric data — constitutes fraud and will result in immediate termination and potential legal action.</p>
              </Clause>
            </Section>

            {/* 4. Accounts & Security */}
            <Section id="accounts" icon={Lock} title="4. User Accounts &amp; Security">
              <Clause num="4.1" title="Passwordless OTP Authentication">
                <p>TSIA uses one-time passwords (OTP) delivered to your registered email address. You are responsible for maintaining exclusive access to your email account. An OTP expires after 10 minutes and becomes invalid after use.</p>
              </Clause>
              <Clause num="4.2" title="Session Inactivity">
                <p>For your security, your session is automatically terminated after <strong>15 minutes of inactivity</strong>. TSIA accepts no liability for any loss or unauthorised action occurring due to an unattended session.</p>
              </Clause>
              <Clause num="4.3" title="Account Responsibility">
                <p>You are solely responsible for all activities that occur under your account. If you suspect unauthorised access, you must notify TSIA immediately at <a href={`mailto:${ADMIN_EMAIL}`} className="text-tsia-green underline">{ADMIN_EMAIL}</a>.</p>
              </Clause>
              <Clause num="4.4" title="No Sharing of Credentials">
                <p>OTP codes, session tokens, and account access must not be shared with any third party. TSIA will never ask for your OTP code via WhatsApp, phone call, or any channel other than the official Platform.</p>
              </Clause>
            </Section>

            {/* 5. Verification */}
            <Section id="verification" icon={Shield} title="5. Student Verification Process">
              <p>All students must complete the following four-step verification process. Failure at any step does not entitle you to a refund of any fees already paid.</p>
              <Clause num="5.1" title="Step 1 — NIN Identity Verification">
                <p>Provide your 11-digit National Identification Number (NIN). It is verified against the NIMC database. A false or invalid NIN will immediately disqualify your application.</p>
              </Clause>
              <Clause num="5.2" title="Step 2 — WAEC Result Validation">
                <p>Enter your WAEC examination details including registration number, year, school, and grades for at least 5 subjects (2 compulsory + 3 electives). Results are cross-referenced against the WAEC verification database. Fabricating results constitutes academic fraud and is a criminal offence.</p>
              </Clause>
              <Clause num="5.3" title="Step 3 — Portal Fee Payment">
                <p>Immediately after submitting your WAEC details, you must pay the one-time <strong>$3 portal fee</strong> (non-refundable). A processing service charge is added at checkout. This fee covers administrative processing, identity checks, and platform maintenance. The fee is payable by card through our payment processor.</p>
              </Clause>
              <Clause num="5.4" title="Step 4 — Biometric Face Scan">
                <p>A face scan is performed for liveness detection and to confirm you are a real, unique individual. You must grant camera access on your device. Your biometric data is processed for identity matching only and is not shared with third parties.</p>
              </Clause>
              <Clause num="5.5" title="Admin Approval">
                <p>After verification, your submission is reviewed by a TSIA administrator within <strong>24–48 hours</strong>. Approval is not guaranteed. TSIA reserves the right to reject any application that fails verification standards or raises concerns about authenticity. You will be notified of the outcome via your registered email.</p>
              </Clause>
              <Clause num="5.6" title="False Location Data">
                <p>Enabling mock GPS or providing a false location during the proof-of-address step constitutes fraud and leads to immediate and permanent disqualification.</p>
              </Clause>
            </Section>

            {/* 6. Sponsorship */}
            <Section id="sponsorship" icon={TrendingUp} title="6. Sponsorship &amp; Payouts">
              <Clause num="6.1" title="Tier Assignment">
                <p>Your sponsorship tier is determined by your WAEC Academic Performance Matrix (APM) score, calculated using Arithmetical Algorithms with alpha numeric points from A–Z across your submitted subjects:</p>
                <ul className="list-disc list-inside mt-2 space-y-0.5">
                  <li><strong>Platinum</strong> — 75%+ average: payout range $225–$230</li>
                  <li><strong>Gold</strong> — 60–74% average: payout range $160–$180</li>
                  <li><strong>Silver</strong> — 50–59% average: payout range $110–$130</li>
                  <li><strong>Below 50%</strong> — application unsuccessful for this semester</li>
                </ul>
              </Clause>
              <Clause num="6.2" title="Payout Conditions">
                <p>Payouts are credited to your TSIA digital wallet after admin approval. Payouts are made in USD. TSIA does not guarantee that payouts will occur within a specific timeframe beyond the 24–48 hour review window.</p>
              </Clause>
              <Clause num="6.3" title="No Guarantee of Approval">
                <p>Completing the verification steps does not guarantee sponsorship approval. TSIA's decision is final. If your WAEC results do not meet the minimum threshold, you may re-apply in a subsequent semester.</p>
              </Clause>
              <Clause num="6.4" title="Payout Exchange Rates">
                <p>All payouts are denominated in USD. The display exchange rate shown on the Platform (₦1,600/$1) is indicative only. The actual payment rate applied on incoming funds is ₦1,460/$1 and the payout disbursement rate is ₦1,280/$1. These rates are subject to change without prior notice.</p>
              </Clause>
            </Section>

            {/* 7. Wallet & Payments */}
            <Section id="wallet" icon={CreditCard} title="7. Digital Wallet &amp; Payments">
              <Clause num="7.1" title="Wallet Activation">
                <p>Your TSIA SwiftWallet is activated upon successful completion of the KYC steps and payment of the portal fee. The wallet stores your sponsorship payouts, trade earnings, and other credited amounts.</p>
              </Clause>
              <Clause num="7.2" title="7.5% VAT on Withdrawals">
                <p>A mandatory <strong>7.5% Value Added Tax (VAT)</strong> is applied to all bank withdrawals in compliance with applicable UK tax regulations. This tax is deducted from the withdrawal amount before disbursement. By requesting a withdrawal, you acknowledge and consent to this deduction. For example: a $100 withdrawal results in $92.50 received after 7.5% VAT.</p>
              </Clause>
              <Clause num="7.3" title="Trade Exchange Withdrawals">
                <p>Withdrawals from the trade wallet to an exchange account attract a 5% fee plus 5% of the amount contributed to the Affiliate Pool. Bank withdrawals from the trade wallet attract an 8% fee plus 5% Affiliate Pool contribution.</p>
              </Clause>
              <Clause num="7.4" title="Funding Methods">
                <p>You may fund your wallet via Squad by GTco using a debit/credit card (Visa/Mastercard), bank transfer, USSD/mobile, or alternatively via Korapay. TSIA does not store your card details; all payment data is handled by the respective payment processor under their own terms and privacy policy.</p>
              </Clause>
              <Clause num="7.5" title="Crypto Deposits">
                <p>Cryptocurrency (USDT) deposits are accepted via TRC20 (TRON) and BEP20 (Binance Smart Chain) networks. Once sent, crypto transactions are irreversible. Ensure network compatibility before sending. TSIA is not responsible for losses from incorrect network selection or amounts sent below the minimum.</p>
              </Clause>
              <Clause num="7.6" title="Processing Times">
                <p>Withdrawals are processed within 2 working days. Deposits via bank transfer may take up to 2 working days to appear. Card deposits are typically instant. Delays caused by banking institutions or payment processors are outside TSIA's control.</p>
              </Clause>
              <Clause num="7.7" title="Minimum Withdrawal">
                <p>The minimum withdrawal amount is $1.00. Any transaction that would result in a negative balance will be rejected by the system.</p>
              </Clause>
              <Clause num="7.8" title="Virtual US Mastercard">
                <p>Eligible users may request a virtual US Mastercard issued by TSIA for online USD transactions. A one-time issuance fee of <strong>$5.00</strong> is charged to your TSIA SwiftWallet. The virtual card is for personal use only and must not be used for illegal transactions. TSIA is not liable for any losses arising from the use of the virtual card by unauthorised third parties. Virtual cards are non-transferable and non-refundable once issued.</p>
              </Clause>
              <Clause num="7.9" title="Netflix Streaming Access">
                <p>TSIA offers access to Netflix streaming through a platform-managed subscription at a subsidised rate of <strong>$5.00/month</strong>, billed from your TSIA SwiftWallet. This service is provided for convenience and is subject to Netflix's own Terms of Service. TSIA cannot guarantee uninterrupted access to Netflix content, which may vary by region. Subscription fees are non-refundable once the monthly access period has commenced.</p>
              </Clause>
              <Clause num="7.10" title="Deposit Allocation (Wallet Deposits)">
                <p>Funds deposited into your TSIA SwiftWallet are credited <strong>in full (100%)</strong> to your active wallet balance — no deductions are made at the point of deposit. Platform service fees of <strong>20%</strong> (operational reserve) and <strong>5%</strong> (affiliate rewards pool) apply only when transactions are made within the app (e.g. wallet-to-wallet transfers). Service charges (airtime, data, bills) are processed at face value with <strong>no additional platform fee</strong>. Bank transfers attract a 7.5% VAT as set out in clause 7.2.</p>
              </Clause>
            </Section>

            {/* 8. Trade Market */}
            <Section id="trade" icon={TrendingUp} title="8. Trade Market &amp; AI Investment Bot">
              <Clause num="8.1" title="Nature of Investment">
                <p>The TSIA trade market connects users to third-party licensed brokers (Binance, Exness, OctaFX, Bybit, XM Group, eToro, and IQ Option). Trading activities involve significant financial risk. <strong>Past performance does not guarantee future results.</strong> You may lose some or all of your invested capital.</p>
              </Clause>
              <Clause num="8.2" title="AI Bot Target ROI">
                <p>TSIA's Itera Trading BOT targets a 2% daily return with an overall 100% ROI target. This is a target, not a guarantee. Market conditions can result in lower or negative returns on individual sessions.</p>
              </Clause>
              <Clause num="8.3" title="Bot Window">
                <p>The Itera Trading BOT is active from <strong>1:00 PM GMT to 1:00 AM GMT</strong> on standard working days. You must manually activate your bot session within this window. Sessions started outside this window will not generate returns.</p>
              </Clause>
              <Clause num="8.4" title="Deposit Allocation">
                <p>Every trade deposit is allocated as follows: 75% to your active trade wallet, 20% to TSIA's strategic reserve fund, and 5% to the affiliate pool. These allocations are non-negotiable and applied automatically.</p>
              </Clause>
              <Clause num="8.5" title="20% Reserve Fund">
                <p>The 20% reserve fund is held to cover platform obligations, insurance against trading losses, and long-term operational stability. Users have no claim over the reserve fund, and it cannot be withdrawn.</p>
              </Clause>
              <Clause num="8.6" title="Minimum Deposit">
                <p>The minimum trade deposit is <strong>$10</strong>. TSIA reserves the right to change the minimum deposit amount with reasonable notice.</p>
              </Clause>
              <Clause num="8.7" title="Risk Acknowledgement">
                <p>By depositing into the trade market, you confirm that: (a) you are aware of the risks associated with cryptocurrency and forex trading; (b) you are investing only funds you can afford to lose; (c) you are not relying on trade returns as your sole source of income.</p>
              </Clause>
            </Section>

            {/* 9. Affiliate */}
            <Section id="affiliate" icon={Users} title="9. Affiliate Program">
              <Clause num="9.1" title="Referral Commissions">
                <p>Affiliates earn commissions for each student who registers and completes verification using their unique referral code. Commission rates and structures are published within the Affiliate Dashboard and are subject to change.</p>
              </Clause>
              <Clause num="9.2" title="Referral Code Integrity">
                <p>Referral codes may only be used by genuinely referred individuals. Manufacturing fake referrals, self-referral, or incentivising individuals to sign up without genuine intent constitutes fraud and will result in account suspension and forfeiture of all pending commissions.</p>
              </Clause>
              <Clause num="9.3" title="Affiliate Obligations">
                <p>Affiliates must promote TSIA truthfully and accurately. Misrepresenting TSIA's services, fees, returns, or eligibility criteria in marketing materials is prohibited and may result in legal liability for the affiliate.</p>
              </Clause>
            </Section>

            {/* 10. Co-Affiliate */}
            <Section id="coaffiliate" icon={Handshake} title="10. Co-Affiliate Trust Fund (Initiator Programme)">
              <Clause num="10.1" title="Nature of the Programme">
                <p>The Co-Affiliate Trust Fund is a long-term profit-sharing investment programme. By investing in a Starter ($100), Growth ($300), or Elite ($500–$10,000) tier, you receive a lifetime entitlement to a proportional share of 5% of annual TSIA profits.</p>
              </Clause>
              <Clause num="10.2" title="Pricing Escalation">
                <p>Every 150,000 new co-affiliate investors triggers a 20% price increase on new subscriptions. Your existing tier investment is not affected by price changes.</p>
              </Clause>
              <Clause num="10.3" title="No Guaranteed Returns">
                <p>The profit-sharing amount depends on TSIA's actual annual profits and the total number of co-affiliates in the pool. TSIA does not guarantee a specific profit distribution amount or frequency.</p>
              </Clause>
              <Clause num="10.4" title="Non-Transferable">
                <p>Co-affiliate membership is personal and non-transferable. It cannot be sold, assigned, or bequeathed without written consent from TSIA.</p>
              </Clause>
              <Clause num="10.5" title="One-Time Payment">
                <p>Co-affiliate membership is a one-time payment with no renewal or expiry. The lifetime entitlement remains in force as long as the TSIA platform is operational.</p>
              </Clause>
            </Section>

            {/* 11. TS-Mart Online Stores */}
            <Section id="ecommerce" icon={ShoppingBag} title="11. TS-Mart Online Stores">
              <Clause num="11.1" title="Commission Structure">
                <p>TSIA retains an <strong>8% commission</strong> on every sale completed through the marketplace. The remaining 92% is credited to the seller's TSIA wallet. By listing a product, sellers agree to this commission structure.</p>
              </Clause>
              <Clause num="11.2" title="Seller Responsibilities">
                <p>Sellers are solely responsible for the accuracy of product listings, product quality, legality, and fulfilment. TSIA acts only as a marketplace intermediary and is not a party to the transaction between buyer and seller.</p>
              </Clause>
              <Clause num="11.3" title="Buyer Protections">
                <p>TSIA does not guarantee the quality, safety, or legality of items listed. Buyers are encouraged to review seller ratings, chat with sellers before purchasing, and report fraudulent listings to TSIA support.</p>
              </Clause>
              <Clause num="11.4" title="Prohibited Products">
                <p>The following may not be listed: counterfeit goods, illegal items, weapons, controlled substances, stolen property, adult content, or any item prohibited under Nigerian, UK, or international law.</p>
              </Clause>
              <Clause num="11.5" title="Ratings & Reviews">
                <p>Buyers may rate and review products after purchase. Ratings must be honest and based on actual experience. Fake reviews, whether positive or negative, are prohibited.</p>
              </Clause>
            </Section>

            {/* 12. Tenancy */}
            <Section id="tenancy" icon={Home} title="12. Tenancy Program">
              <Clause num="12.1" title="Landlord Agreement">
                <p>By listing a property on the TSIA tenancy programme, landlords agree to a lease arrangement under which TSIA pays an agreed lump sum upfront (representing approximately 88% of total rent value over the lease term). The landlord agrees to accept the lump sum as full payment for the agreed term.</p>
              </Clause>
              <Clause num="12.2" title="Tenant Agreement">
                <p>Tenants pay monthly instalments to TSIA at an annual interest rate of 5%. Tenants must not sub-let, vandalise, or misuse the property. Defaulting on payments may result in eviction and forfeiture of amounts already paid.</p>
              </Clause>
              <Clause num="12.3" title="TSIA as Intermediary">
                <p>TSIA acts as a financial intermediary in the tenancy arrangement. TSIA is not a landlord, letting agent, or property manager. Disputes about property condition or maintenance remain between the landlord and tenant.</p>
              </Clause>
            </Section>

            {/* 13. Loans */}
            <Section id="loans" icon={CreditCard} title="13. Student &amp; Business Loans">
              <Clause num="13.1" title="Student Loan Eligibility">
                <p>Student loans are available to verified students upon admin approval. Maximum loan amounts are determined by tier: Platinum — up to $200; Gold — up to $150; Silver — up to $100.</p>
              </Clause>
              <Clause num="13.2" title="Business Loan Eligibility">
                <p>Affiliate business loans are available to affiliates with at least one verified referral or a positive trade wallet balance. The maximum loan amount is $5,000, subject to eligibility calculations.</p>
              </Clause>
              <Clause num="13.3" title="Interest Rates">
                <p>Student loan interest: <strong>10% per year (flat)</strong>. Affiliate business loan interest: <strong>15% per year (flat)</strong>. Interest is calculated on the original principal and does not compound.</p>
              </Clause>
              <Clause num="13.4" title="Repayment">
                <p>Repayments are deducted from your TSIA wallet balance on a monthly basis over your chosen term (6, 12, or 18 months for students; 6, 12, or 24 months for affiliates). You may hold only one active loan at a time.</p>
              </Clause>
              <Clause num="13.5" title="Default">
                <p>Failure to maintain sufficient wallet balance for monthly repayments constitutes default. TSIA reserves the right to freeze your account, suspend withdrawals, and report defaults as appropriate.</p>
              </Clause>
            </Section>

            {/* 14. Glide Africa */}
            <Section id="tour" icon={Plane} title="14. Glide Africa">
              <Clause num="14.1" title="Service Commission">
                <p>TSIA retains a <strong>10% commission</strong> on all Glide Africa bookings (hotels, car rentals, and flights). The balance is forwarded to the respective service provider.</p>
              </Clause>
              <Clause num="14.2" title="Third-Party Services">
                <p>Hotels, car rental companies, and airlines are independent third-party providers. TSIA does not operate, manage, or control these providers. TSIA is not liable for service quality, cancellations, delays, accidents, or other issues arising from their services.</p>
              </Clause>
              <Clause num="14.3" title="Cancellations & Refunds">
                <p>Cancellation and refund policies are determined by the individual service providers. TSIA's 10% commission is non-refundable in all circumstances. Any refund entitlement from the provider is to be pursued directly with them.</p>
              </Clause>
              <Clause num="14.4" title="Payment">
                <p>All Glide Africa bookings are paid from your TSIA digital wallet. You must have sufficient balance before confirming any booking.</p>
              </Clause>
            </Section>

            {/* 15. Privacy */}
            <Section id="privacy" icon={Lock} title="15. Privacy &amp; Data Protection">
              <Clause num="15.1" title="Data We Collect">
                <p>We collect: full name, email address, phone number, country, NIN, BVN, WAEC records, GPS coordinates, facial biometric data, bank account details, and transaction records. This data is collected strictly for identity verification, fraud prevention, and service delivery.</p>
              </Clause>
              <Clause num="15.2" title="Legal Basis">
                <p>We process your data under the following legal bases: performance of a contract (to provide the Platform services); legal obligation (KYC/AML compliance); and legitimate interests (fraud prevention, platform security).</p>
              </Clause>
              <Clause num="15.3" title="Data Sharing">
                <p>Your data is never sold to third parties. It is shared only with: (a) KYC/identity verification providers (NIMC, WAEC API); (b) payment processors (Squad by GTco, Korapay); (c) regulatory authorities when legally required. All third parties are contractually bound to data protection standards.</p>
              </Clause>
              <Clause num="15.4" title="Biometric Data">
                <p>Facial biometric data is used solely for liveness detection and identity matching during the verification process. It is not stored longer than necessary and is not used for marketing or sold to any third party.</p>
              </Clause>
              <Clause num="15.5" title="Your Rights">
                <p>Under applicable data protection law, you have the right to: access your personal data; request corrections; request deletion (subject to legal retention requirements); object to processing; and lodge a complaint with the relevant supervisory authority. To exercise your rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-tsia-green underline">{CONTACT_EMAIL}</a>.</p>
              </Clause>
              <Clause num="15.6" title="Data Retention">
                <p>We retain your personal data for as long as your account is active and for at least 7 years afterwards in compliance with UK financial record-keeping regulations.</p>
              </Clause>
            </Section>

            {/* 16. Prohibited Activities */}
            <Section id="prohibited" icon={AlertTriangle} title="16. Prohibited Activities">
              <p>The following activities are strictly prohibited and will result in immediate account suspension and potential legal action:</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  "Providing false identity documents or NIN/BVN",
                  "Fabricating or altering WAEC results",
                  "Using mock GPS or VPN to falsify location",
                  "Creating multiple accounts to circumvent limits",
                  "Generating fraudulent referrals or fake students",
                  "Manipulating the trade market or AI bot results",
                  "Listing illegal, counterfeit, or prohibited products",
                  "Impersonating TSIA staff or sending phishing messages",
                  "Money laundering or financing prohibited activities",
                  "Attempting to hack, scrape, or reverse-engineer the Platform",
                  "Harassing or threatening other Platform users",
                  "Using the Platform in violation of any applicable law",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-3 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 17. Liability */}
            <Section id="liability" icon={Scale} title="17. Limitation of Liability">
              <Clause num="17.1" title="No Liability for Investment Losses">
                <p>TSIA is not liable for any financial losses arising from trade market activity, investment decisions, broker performance, or market volatility. Investing in the trade market carries inherent risk.</p>
              </Clause>
              <Clause num="17.2" title="No Liability for Third-Party Services">
                <p>TSIA acts as an intermediary for payment processors, KYC providers, brokers, hotels, car rental companies, airlines, and other third-party service providers. TSIA is not liable for their acts, omissions, service failures, or losses arising from their services.</p>
              </Clause>
              <Clause num="17.3" title="Platform Availability">
                <p>TSIA does not guarantee uninterrupted access to the Platform. Scheduled and unscheduled maintenance, server outages, or force majeure events may temporarily disrupt services. TSIA is not liable for any loss arising from Platform unavailability.</p>
              </Clause>
              <Clause num="17.4" title="Cap on Liability">
                <p>To the maximum extent permitted by law, TSIA's total aggregate liability to you for any claim arising from your use of the Platform shall not exceed the total amount of portal fees and transaction fees paid by you to TSIA in the 12 months preceding the claim.</p>
              </Clause>
              <Clause num="17.5" title="Indemnification">
                <p>You agree to indemnify, defend, and hold harmless {COMPANY}, its directors, employees, agents, and affiliates from and against any claims, damages, losses, and expenses (including legal fees) arising from your breach of these Terms or misuse of the Platform.</p>
              </Clause>
            </Section>

            {/* 18. Disputes */}
            <Section id="disputes" icon={Scale} title="18. Disputes &amp; Governing Law">
              <Clause num="18.1" title="Governing Law">
                <p>These Terms are governed by and construed in accordance with the laws of <strong>England and Wales</strong>. This choice of law does not deprive you of any mandatory consumer protection rights available under the laws of your country of residence.</p>
              </Clause>
              <Clause num="18.2" title="Dispute Resolution">
                <p>Before commencing any formal legal proceedings, you agree to contact TSIA at <a href={`mailto:${CONTACT_EMAIL}`} className="text-tsia-green underline">{CONTACT_EMAIL}</a> and allow a period of 30 days for informal resolution. Both parties agree to negotiate in good faith.</p>
              </Clause>
              <Clause num="18.3" title="Jurisdiction">
                <p>Subject to clause 18.2, any dispute that cannot be resolved informally shall be submitted to the exclusive jurisdiction of the courts of England and Wales, or (at TSIA's discretion) an agreed international arbitration body.</p>
              </Clause>
            </Section>

            {/* 19. Amendments */}
            <Section id="amendments" icon={FileText} title="19. Amendments &amp; Termination">
              <Clause num="19.1" title="Right to Amend">
                <p>TSIA reserves the right to update, modify, or replace these Terms at any time. Material changes will be notified to you via email or a prominent in-platform notice at least 7 days before they take effect. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
              </Clause>
              <Clause num="19.2" title="Account Termination by User">
                <p>You may close your account at any time by contacting support. Any outstanding loan balance must be settled before account closure. Closing your account does not entitle you to a refund of any fees already paid.</p>
              </Clause>
              <Clause num="19.3" title="Termination by TSIA">
                <p>TSIA may suspend or terminate your account immediately and without notice if: (a) you breach any provision of these Terms; (b) TSIA is required to do so by law or regulation; (c) TSIA has reasonable grounds to suspect fraud or misuse.</p>
              </Clause>
              <Clause num="19.4" title="Effect of Termination">
                <p>Upon termination, your access to the Platform ceases. Any legitimate wallet balance (net of outstanding liabilities) will be disbursed to your registered bank account within 14 business days, subject to applicable fees and deductions.</p>
              </Clause>
              <Clause num="19.5" title="Severability">
                <p>If any provision of these Terms is found to be unenforceable, the remaining provisions continue in full force and effect.</p>
              </Clause>
            </Section>

            {/* Final box */}
            <div className="bg-gradient-to-r from-tsia-green/10 to-tsia-gold/10 border rounded-2xl p-6 text-center">
              <p className="font-bold text-foreground mb-2">Last Updated: {EFFECTIVE_DATE}</p>
              <p className="text-sm text-muted-foreground mb-4">
                By creating an account, making any payment, or using any feature of the TSIA Platform, you confirm that you have read these Terms in full and agree to be legally bound by them.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/signup">
                  <Button className="bg-tsia-green hover:bg-tsia-green/90" data-testid="button-terms-signup">
                    Create Account
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" data-testid="button-terms-home">
                    Return Home
                  </Button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
