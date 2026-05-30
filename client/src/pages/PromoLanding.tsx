import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import {
  GraduationCap, Shield, Wallet, Trophy, CheckCircle2, ChevronDown,
  ArrowRight, Star, Users, TrendingUp, Banknote, Home, ShoppingBag,
  Plane, MessageCircle, X, Send, Bot, Phone, Sparkles, Clock,
  BookOpen, Award, Zap, Globe, Lock,
  AlertCircle, Info, Check, ChevronUp, Menu, ExternalLink, Gift,
} from "lucide-react";

// ── Constants ───────────────────────────────────────────────────────────────
const WA_NUMBER = "447552647146";
const WA_URL = `https://wa.me/${WA_NUMBER}?text=Hello%20TSIA%20Support%2C%20I%20have%20a%20question%20about%20the%20platform.`;

// ── AI Knowledge Base ────────────────────────────────────────────────────────
interface KBEntry { patterns: RegExp[]; response: string }

const KB: KBEntry[] = [
  {
    patterns: [/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greet|yo|sup)\b/i],
    response: `Hello! Welcome to TSIA — the Tuition Support Initiative for Africa. 👋\n\nI'm your dedicated TSIA guide. I can answer questions on:\n\n🎓 **Sponsorship & Academic Tiers** — how merit-based payouts are assigned\n💳 **Wallet Activation** — the $5.50 minimum deposit\n🔐 **Verification Process** — NIN, WAEC, portal fee, biometrics\n📅 **Semester Disbursements** — 2 per year × 3 years = 6 total payouts\n🤝 **Affiliate Program** — earn by referring students\n📈 **Trade Market** — AI-powered investments\n🏠 **Tenancy Program** — housing made affordable\n💰 **Loans & Cashback** — borrow and earn rewards\n\nWhat would you like to know?`,
  },
  {
    patterns: [/what is tsia|about tsia|who.*tsia|tsia.*what|explain tsia|tell me about tsia|what.*platform|overview/i],
    response: `**TSIA — Tuition Support Initiative for Africa** is a registered fintech platform (operated by **SMAKEMGGOLD Ltd**, RC: 1359954) designed to:\n\n🎓 Fund African students' tuition based on academic merit\n🤝 Empower affiliates with income & investment tools\n📈 Provide investment & financial services to all members\n\n**Core Features:**\n• **Student Sponsorship** — merit-based payouts per semester, determined by WAEC results\n• **Digital Wallet** — secure USD wallet for all transactions\n• **Trade Market** — AI-powered daily returns on crypto/forex\n• **Co-Affiliate Trust Fund** — invest once, earn lifetime profit share\n• **Tenancy Programme** — affordable housing across Africa\n• **Quick Loans** — borrow against your verified earnings\n• **TS-Mart Online Stores** — buy & sell in the TSIA community\n• **Cashback System** — earn 10% back on every transaction\n\n👉 Visit **/signup** to create your free account and start your journey!`,
  },
  {
    patterns: [/sign.?up|register|create.*account|how.*join|how.*start|get started|new.*account/i],
    response: `**Creating your TSIA account is completely FREE.** Here's how:\n\n**Step 1 — Go to /signup**\n• Choose your account type: Student, Business (Affiliate), or Both\n• Enter your name, email, and phone number\n• No password needed — TSIA uses secure OTP login\n\n**Step 2 — Activate your wallet**\n• Deposit a minimum of **$5.50** to activate your TSIA digital wallet\n• This unlocks all platform features\n• Fund via bank transfer, card, or crypto (USDT)\n\n**Step 3 — Complete verification**\n• NIN verification (National ID)\n• WAEC/NECO/GCE result entry\n• Document upload\n• $3 portal fee payment\n• Biometric face scan\n\nOnce admin approves (within 24–48 hours), your sponsorship payout is credited to your wallet!\n\n👉 **Start now at /signup** — it takes less than 10 minutes.`,
  },
  {
    patterns: [/wallet.*activ|activ.*wallet|5\.5|5\.50|minimum.*deposit|deposit.*minimum|fund.*wallet|wallet.*fund|how.*activate/i],
    response: `**TSIA Wallet Activation — $5.50 Minimum Deposit**\n\nTo unlock all platform features, you must fund your TSIA digital wallet with at least **$5.50**.\n\n**Why $5.50?**\nThis small commitment confirms your serious intent to participate in the platform and unlocks:\n✅ Identity verification process\n✅ Portal fee payment capability\n✅ Bill payments (airtime, data, electricity, cable TV)\n✅ Peer-to-peer transfers\n✅ Trade market access\n✅ Loan eligibility\n✅ Cashback earnings (10% on every transaction)\n\n**How to fund your wallet:**\n1. Log in → go to Financial Hub\n2. Tap "Fund Account"\n3. Choose: **Bank Transfer** (Korapay/Squad), **Card Payment**, or **Crypto (USDT TRC20/BEP20)**\n4. Complete payment — balance reflects instantly`,
  },
  {
    patterns: [/verif|nin|biometric|face.*scan|kyc|identity|onboard|how.*verify|document.*upload|upload.*doc/i],
    response: `**Full TSIA Verification Process — 4 Steps**\n\n**Step 1 — NIN Verification** (National ID)\n• Enter your 11-digit NIN\n• Verified instantly against the NIMC database\n• Must match your registered name\n\n**Step 2 — WAEC/NECO/GCE Entry**\n• Enter your exam reg number, year, and grades\n• Select at least 5 subjects (2 compulsory: Math + English + 3 electives)\n• Upload a government-issued ID document (JPEG, PNG, PDF — max 5MB)\n\n**Step 3 — Wallet KYC + Portal Fee**\n• Complete 3-step KYC: NIN confirm + BVN + GPS location\n• Pay the **one-time $3 portal fee**\n• Wallet must be active ($5.50+ funded) before this step\n\n**Step 4 — Biometric Face Scan**\n• Quick selfie verification to confirm identity\n• Processed using AI facial recognition\n\n⏱️ Admin reviews submissions within **24–48 hours**\n✅ Approval triggers your sponsorship payout to your wallet`,
  },
  {
    patterns: [/waec|neco|gce|academic|grade|score|subject|result|performance|apm|percentage|average|math|english|50.*percent|below.*50|50.*average/i],
    response: `**TSIA Academic Performance Matrix (APM)**\n\nYour sponsorship tier is determined by your WAEC/NECO/GCE grade average using TSIA's proprietary algorithmic scoring system.\n\n**Compulsory Subjects (required):** Mathematics + English Language\n**Elective Subjects:** Physics, Chemistry, Biology, Economics, etc.\n\n**⚠️ Minimum Requirement: 50% average**\nScoring below 50% means you do not qualify for any sponsorship tier. A score of exactly 50%+ unlocks the Silver tier.\n\n**Tier Thresholds:**\n🥈 **Silver** — 50–59% average → competitive merit payout\n🥇 **Gold** — 60–74% average → higher merit payout\n🏆 **Platinum** — 75%+ average → highest merit payout\n\nResults are submitted once and reviewed by our admin team. You cannot change your submitted grades.\n\n💡 Sign up to see your exact payout after your academic performance is assessed.`,
  },
  {
    patterns: [/portal.*fee|fee.*portal|\$3|portal.*cost|how much.*fee|one.*time.*fee|registration.*fee/i],
    response: `**TSIA Portal Fee — $3 (One-Time Only)**\n\nThe portal fee is a **one-time, non-refundable** payment of **$3** that:\n\n✅ Activates your verification submission\n✅ Covers the cost of admin review & verification\n✅ Confirms your commitment to the programme\n✅ Cannot be paid without first activating your wallet ($5.50 minimum)\n\n**How to pay:**\n1. Complete your NIN + WAEC entry\n2. Go to "Pay Portal Fee" in your dashboard\n3. Fee is deducted from your TSIA wallet\n4. Biometric face scan is immediately unlocked\n\n⚠️ Total minimum to fully verify: **$5.50 wallet activation + $3 portal fee = $8.50**`,
  },
  {
    patterns: [/tier|platinum|gold|silver|payout|sponsorship.*amount|how much.*earn|earn.*how much|disburs|reward|benefit/i],
    response: `**TSIA Sponsorship Tiers**\n\nOnce verified, you receive semester payouts based on your WAEC academic tier:\n\n🏆 **Platinum Tier** (75%+ average)\n→ Highest merit-based payout per semester\n→ Highest student loan eligibility\n\n🥇 **Gold Tier** (60–74% average)\n→ Mid-level merit-based payout per semester\n→ Mid-level student loan eligibility\n\n🥈 **Silver Tier** (50–59% average)\n→ Entry-level merit-based payout per semester\n→ Entry-level student loan eligibility\n\n**Payout Schedule:**\n• 2 disbursements per academic year for 3 years\n• Total: **6 payouts** (1st Semester + 2nd Semester × Year 1, 2, 3)\n\n💰 All payouts go directly to your TSIA wallet. Sign up to see exact amounts after assessment.`,
  },
  {
    patterns: [/semester|disbursement|1st.*semester|2nd.*semester|3.*year|6.*payout|yearly|annual.*payout|how many.*payout|when.*paid/i],
    response: `**TSIA Disbursement Schedule — 2 Semesters Per Year, 3 Years**\n\nOnce your verification is approved, you receive **2 disbursements per academic year** for **3 consecutive years** — that's **6 total payouts**:\n\n📅 **Year 1** — 1st Semester Payout + 2nd Semester Payout\n📅 **Year 2** — 1st Semester Payout + 2nd Semester Payout\n📅 **Year 3** — 1st Semester Payout + 2nd Semester Payout\n\n✅ Think of it like this: every academic year has 2 semesters. TSIA funds both, for 3 years running.\n\nDisbursements are processed by the admin team and credited directly to your TSIA wallet.\n\n⚠️ Continued good academic standing is required for subsequent semester disbursements.`,
  },
  {
    patterns: [/affiliate|refer|commission|referral.*code|my.*code|share.*code|earn.*refer|how.*affiliate/i],
    response: `**TSIA Affiliate Programme — Earn by Referring Students**\n\n**How it works:**\n1. Sign up at **/affiliate-signup** (free)\n2. Get your unique referral code (e.g. TSIA-EMM0001)\n3. Share your referral link with students\n4. Earn commission when they verify and pay fees\n\n**Affiliate Dashboard includes:**\n📈 Global Trade Market (AI bot, 2% daily ROI)\n💎 Co-Affiliate Trust Fund (lifetime profit sharing)\n💼 Business Loans\n🏠 Tenancy Programme management\n🛍️ TS-Mart Online Stores marketplace\n✈️ Glide Africa (hotel, car, flight bookings)\n💬 Community Forum & real-time chat\n\n👉 Go to **/affiliate-signup** to join!`,
  },
  {
    patterns: [/student.*loan|loan.*student|borrow.*student|education.*loan|how.*borrow/i],
    response: `**TSIA Student Loan Programme**\n\n✅ Available to all verified students with a QCE SwiftVault contribution\n\n**Loan limits scale with your sponsorship tier** — higher tier = higher loan eligibility.\n\n**Terms:**\n• Interest rate: **10% per annum** (flat)\n• Repayment options: 6, 12, or 18 months\n• Monthly payment auto-deducted from wallet\n• No collateral — identity-based\n• One active loan at a time\n\n**How to apply:**\n1. Log in to your student dashboard\n2. Open Financial Hub → Finance tab\n3. Click "Apply for Loan"\n4. Select amount + term → submit\n5. Admin approves within 24–48 hours\n\n💡 Making your first QCE SwiftVault contribution unlocks loan eligibility automatically.`,
  },
  {
    patterns: [/trade|invest|roi|return|bot|daily.*profit|profit.*daily|crypto|usdt|trc20|bep20|trade.*market|ai.*bot/i],
    response: `**TSIA Global Trade Market — AI-Powered Investing**\n\n📈 **Target ROI:** 2% daily profit via AI trading bot\n⏰ **BOT Window:** 1PM – 1AM GMT on working days\n💼 **Deposit Methods:** USDT via TRC20 (TRON) or BEP20 (BNB Chain)\n\n**Fee Structure on Deposit:**\n• 75% → your trade wallet\n• 20% → strategic reserve fund\n• 5% → affiliate commission pool\n\n**Withdrawal Fees:**\n• Exchange withdrawal: 5% + 5% affiliate pool\n• Bank withdrawal: 8% + 5% affiliate pool\n\n**Minimum:** $10 deposit | $5 withdrawal\n**Broker Partners:** Binance, Exness, OctaFX, Bybit, XM Group, eToro, IQ Option\n\n🔒 20% of all deposits go into a **Strategic Reserve Fund** protecting all investors.\n\nAccess via **Affiliate Dashboard → Trade Market**`,
  },
  {
    patterns: [/co.?affiliate|trust.*fund|initiator|lifetime.*profit|invest.*lifetime|starter|growth|elite|fund.*invest/i],
    response: `**Co-Affiliate / Initiator Trust Fund — Lifetime Investment**\n\nInvest once. Earn forever.\n\n💎 **Starter** — invest a base amount → lifetime profit participation\n💎 **Growth** — invest more → higher lifetime profit share\n💎 **Elite** — invest at premium → maximum custom share %\n\n**Programme Details:**\n🎯 Target: 1,000,000 co-affiliate investors worldwide\n📈 Every 150,000 new investors = **+20% price increase** on subscriptions\n💰 **5% of all TSIA platform profits** shared proportionally — forever\n✅ One-time payment, no renewal, no expiry\n\nEarly investors get the best prices before price milestones kick in!\n\nAccess: **Affiliate Dashboard → Co-Affiliate Fund**`,
  },
  {
    patterns: [/tenancy|landlord|rent|house|property|tenant|accommodation|housing|flat|apartment|monthly.*rent/i],
    response: `**TSIA Tenancy Programme — Affordable Housing Across Africa**\n\n🏠 **For Landlords:**\n• List your property for a 3–10 year TSIA lease\n• Receive a **lump sum upfront** (88% of total rent value)\n• No more chasing tenants for annual payments\n• TSIA handles the tenants and collections\n\n🏠 **For Tenants:**\n• Browse properties across African cities by budget\n• Pay in **monthly installments** at just 5% annual interest\n• No large lump sums, no deposit stress\n\n**How to Access:**\n→ Visit **/tenancy** from the main menu\n→ Affiliates can manage tenancy from their dashboard`,
  },
  {
    patterns: [/cashback|cash.*back|10.*percent.*back|earn.*back|reward.*transaction|reward.*spend/i],
    response: `**TSIA Cashback System — 10% Back on Every Transaction**\n\nEvery time you spend on the platform, you earn **10% cashback automatically!**\n\n**Cashback applies to:**\n💸 Airtime purchases\n📶 Data bundle purchases\n⚡ Electricity bill payments\n📺 Cable TV subscriptions\n🎮 Betting wallet top-ups\n📤 Peer-to-peer wallet transfers\n\n**How it works:**\n1. Make any qualifying transaction\n2. 10% is instantly added to your **Cashback Wallet**\n3. Withdraw to your personal wallet anytime — no minimum\n\n**Where to find it:**\nFinancial Hub → Rewards tab → Cashback Balance`,
  },
  {
    patterns: [/fee|cost|price|charge|all.*fee|fee.*list|total.*cost|how much.*total|what.*charge/i],
    response: `**Complete TSIA Fee Breakdown — No Hidden Charges**\n\n✅ **Account Registration:** FREE\n💳 **Wallet Activation:** $5.50 minimum deposit\n🔐 **Portal Verification Fee:** $3 one-time\n\n**Withdrawal Fees:**\n• Bank withdrawal: 7.5% VAT (Nigerian law)\n• Trade market exchange: 5% + 5% affiliate pool\n• Trade market bank: 8% + 5% affiliate pool\n\n**Service Fees:**\n• Peer-to-peer transfers: 8% platform fee\n• TS-Mart Online Stores (sellers): 8% commission per sale\n• Glide Africa bookings: 10% commission\n\n**Loan Interest:**\n• Student loans: 10% p.a. (flat)\n• Business loans: 30% p.a. (flat)\n\n**Savings:**\n• Savings goals: up to 20% p.a. interest\n• Cashback: 10% back on all transactions`,
  },
  {
    patterns: [/contact|support|help.*team|human|agent|speak|whatsapp|call|email.*team|reach.*team|talk.*to|get.*help/i],
    response: `**Reach the TSIA Support Team**\n\nI'm happy to escalate this to our human team!\n\n📱 **WhatsApp / Call** — Click the button below to open WhatsApp directly\n📞 **Number:** +4407916395474\n⏰ **Hours:** Monday–Friday, 9am–6pm GMT\n\n📧 **Email:** support@tsia.africa\n→ Response within 24 hours\n\n📋 **Contact Form:** Visit **/contact** to send a formal inquiry\n\nOur team typically responds within **2–4 hours** on business days. For urgent verification issues, WhatsApp is fastest! 🚀`,
  },
  {
    patterns: [/login|sign.*in|otp|password|forgot|can'?t.*log|not.*log|session|logout|access.*account/i],
    response: `**TSIA Login — Passwordless & Secure**\n\nTSIA uses **OTP (One-Time Password)** login — no passwords to remember!\n\n**How to log in:**\n1. Visit **/login**\n2. Enter your registered email address\n3. Check your inbox for a **6-digit code** (valid 10 minutes)\n4. Enter the code — you're in!\n\n**Security Features:**\n🔒 Auto-logout after 15 minutes of inactivity\n🔄 One active session per device\n📧 OTP sent to verified email only\n\n**Common Issues:**\n• Didn't get OTP? Check your spam/junk folder\n• Wait 2 minutes, then request a new code\n• Still stuck? WhatsApp our support team (button below)\n\n**Dual Account:** One email can hold both a **Student + Affiliate account** — switch roles from your dashboard header.`,
  },
  {
    patterns: [/eligible|who.*can|can.*join|qualif|requirement|criteria|who.*apply|apply.*who|nationality|country/i],
    response: `**Who Can Join TSIA?**\n\n✅ **Students eligible for sponsorship:**\n• African students (Nigeria primary market)\n• Have sat WAEC, NECO, or GCE examinations\n• Must score **50% or above** on the APM scoring matrix\n• Must be able to provide a valid NIN (National ID Number)\n\n✅ **Affiliates can join from anywhere:**\n• No geographic restriction for the affiliate programme\n• Must be 18+ years old\n• Requires a valid email and phone number\n\n**Disqualifying factors:**\n❌ WAEC average below 50%\n❌ Fraudulent document submissions\n❌ Using another person's NIN or identity\n❌ Multiple accounts under the same identity\n\n💡 Even students who don't qualify for sponsorship can still use the wallet, trade market, marketplace, tenancy, and loans!`,
  },
  {
    patterns: [/saving|savings.*goal|save|savings.*plan|qce|swift.*vault|interest.*saving/i],
    response: `**TSIA Savings Features**\n\n**1. Savings Goals (Financial Hub)**\n• Create custom savings goals\n• Set a target amount and optional target date\n• Earn up to **20% p.a. interest** on locked goals\n\n**2. QCE SwiftVault (Students)**\n• A 90-day locked savings pot\n• Your first contribution instantly unlocks **student loan eligibility**\n• Auto-matures after 90 days — 24-hour withdrawal window opens\n\nAccess: **Financial Hub → Finance tab → Savings Goals**`,
  },
  {
    patterns: [/market.*place|ts.?mart|shop|buy|sell|product|order|ecommerce|e.?commerce|seller/i],
    response: `**TS-Mart Online Stores — TSIA's Built-in Marketplace**\n\n🛍️ **Buyers:**\n• Browse products from TSIA community sellers\n• Filter by category, price, condition, and location\n• Pay directly from your TSIA wallet\n• Rate and review sellers after purchase\n• Real-time chat with sellers before buying\n\n📦 **Sellers (Affiliates only):**\n• List unlimited products for sale\n• TSIA retains **8% commission** per completed sale\n• You receive **92%** — credited directly to your wallet\n• Full order management from dashboard\n\nAccess: **Dashboard → TS-Mart Online Stores**`,
  },
  {
    patterns: [/glide|tour|hotel|car.*rent|flight|travel|booking|transport|airport|ride/i],
    response: `**Glide Africa — Travel & Mobility Services**\n\n✈️ **Flight Booking** — book by route and passenger count\n🏨 **Hotel Booking** — browse hotels across African cities\n🚗 **Car Rental** — self-drive or chauffeured options\n📦 **Dispatch & E-Taxi** *(Coming soon!)*\n\n**All bookings:** paid from your TSIA wallet | TSIA retains 10% service commission\n\nAccess: **Dashboard → Glide Africa**`,
  },
  {
    patterns: [/safe|secure|legit|scam|fraud|trust|real|registered|RC|company|SMAKEMGGOLD/i],
    response: `**Is TSIA Legitimate & Safe?**\n\n✅ **Yes — TSIA is a registered fintech company.**\n\n**Company Details:**\n• Full name: **SMAKEMGGOLD Ltd**\n• Registration Number: **RC 1359954**\n• Category: Fintech / EdTech / Financial Services\n\n**Security Measures:**\n🔐 OTP-based passwordless authentication\n🆔 NIN verification via NIMC database\n😊 Biometric face scan (liveness detection)\n🔒 Encrypted sessions with auto-logout\n🏦 Payments via Korapay & Squad (CBN-licensed gateways)\n\n**Financial Security:**\n• 20% of all trade deposits held in a Strategic Reserve Fund\n• Admin oversight on all verification and disbursement decisions\n\n💬 Still have concerns? WhatsApp our team directly (button below)!`,
  },
];

function getBotResponse(msg: string): string {
  const lower = msg.toLowerCase().trim();
  for (const entry of KB) {
    if (entry.patterns.some(p => p.test(lower))) return entry.response;
  }
  return `I understand you're asking about **"${msg}"**.\n\nI may not have a specific answer for that, but here's what I cover best:\n\n• **Sign-up & account creation** — type "how do I sign up"\n• **Wallet activation** — type "wallet activation"\n• **Verification process** — type "how do I verify"\n• **WAEC grades & tiers** — type "sponsorship tiers"\n• **Semester payouts** — type "how many disbursements"\n• **Affiliate earnings** — type "affiliate program"\n• **Loans** — type "student loan"\n• **Security** — type "is TSIA safe"\n\n📱 For a specific or complex question, click **"Chat on WhatsApp"** below — our team typically responds within 2 hours!`;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    return <span key={i}>{formatted}{i < lines.length - 1 && <br />}</span>;
  });
}

// ── Full-Screen AI Chat ──────────────────────────────────────────────────────
interface Msg { id: string; role: "user" | "ai"; text: string }

function PromoAiChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{
    id: "init", role: "ai",
    text: `Hello! 👋 I'm TSIA's AI Guide.\n\nAsk me anything about the platform — from sign-up to semester payouts, loans, trade market, and more.\n\nOr tap **"Chat on WhatsApp"** above to speak with a human agent directly.`,
  }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMsgs(prev => [...prev, { id: Date.now() + "u", role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMsgs(prev => [...prev, { id: Date.now() + "a", role: "ai", text: getBotResponse(text) }]);
      setTyping(false);
    }, 800 + Math.random() * 500);
  }, [input]);

  const sendQuick = (q: string) => {
    setMsgs(prev => [...prev, { id: Date.now() + "u", role: "user", text: q }]);
    setTyping(true);
    setTimeout(() => {
      setMsgs(prev => [...prev, { id: Date.now() + "a", role: "ai", text: getBotResponse(q) }]);
      setTyping(false);
    }, 800);
  };

  const quickQ = [
    "How do I sign up?",
    "What is wallet activation?",
    "How are tiers determined?",
    "How many disbursements?",
    "Is TSIA safe?",
    "Affiliate programme",
    "What is the portal fee?",
    "How does the trade market work?",
  ];

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-tsia-green to-green-700 text-white rounded-full shadow-2xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open AI Assistant"
        data-testid="btn-open-promo-chat"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-tsia-gold rounded-full flex items-center justify-center text-[9px] font-black text-white">AI</span>
      </motion.button>

      {/* Full-screen overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-tsia-green to-green-800 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base leading-tight">TSIA AI Guide</p>
                <p className="text-green-100 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse inline-block" />
                  Online — ask me anything about TSIA
                </p>
              </div>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0"
                data-testid="link-whatsapp-header"
              >
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white transition-colors shrink-0"
                data-testid="btn-close-promo-chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-muted/10">
              {msgs.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${m.role === "ai" ? "bg-tsia-green/15 border border-tsia-green/20" : "bg-tsia-gold/15 border border-tsia-gold/20"}`}>
                    {m.role === "ai"
                      ? <Bot className="w-4 h-4 text-tsia-green" />
                      : <span className="text-[10px] font-black text-tsia-gold">You</span>}
                  </div>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === "ai" ? "bg-card border border-border text-foreground" : "bg-tsia-green text-white"}`}>
                    {m.role === "ai" ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-tsia-green/15 border border-tsia-green/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-tsia-green" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-5 py-4 flex gap-1.5 items-center shadow-sm">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 bg-tsia-green/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick questions */}
            <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap border-t border-border bg-background">
              {quickQ.map(q => (
                <button
                  key={q}
                  onClick={() => sendQuick(q)}
                  disabled={typing}
                  className="text-xs font-semibold bg-muted border border-border px-3 py-1.5 rounded-full text-muted-foreground hover:bg-tsia-green/10 hover:text-tsia-green hover:border-tsia-green/30 transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="px-4 py-3 bg-background border-t border-border flex gap-3 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask anything about TSIA…"
                className="flex-1 bg-muted rounded-2xl px-4 py-3 text-sm outline-none border border-border focus:border-tsia-green/50 transition-colors placeholder:text-muted-foreground"
                data-testid="input-promo-chat"
              />
              <button
                onClick={send}
                disabled={!input.trim() || typing}
                className="w-12 h-12 bg-tsia-green text-white rounded-2xl flex items-center justify-center hover:bg-tsia-green/90 disabled:opacity-40 transition-all shrink-0"
                data-testid="btn-send-promo-chat"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* WhatsApp footer banner */}
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shrink-0"
              data-testid="link-whatsapp-promo-footer"
            >
              <Phone className="w-4 h-4" />
              Prefer a person? Chat with TSIA Team on WhatsApp
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Step card ────────────────────────────────────────────────────────────────
function StepCard({ step, icon: Icon, title, desc, color, detail }: {
  step: number; icon: any; title: string; desc: string; color: string; detail?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: step * 0.08 }}
      className="relative"
    >
      <div className="bg-card border border-border rounded-2xl p-5 ml-14 relative hover:border-tsia-green/30 transition-colors">
        <div className={`absolute w-12 h-12 ${color} rounded-2xl flex items-center justify-center shadow-lg`} style={{ left: "-3.25rem" }}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Step {step}</span>
            <h3 className="font-black text-base mt-0.5">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
          </div>
          {detail && (
            <button onClick={() => setOpen(!open)} className="shrink-0 text-tsia-green mt-1">
              {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </div>
        <AnimatePresence>
          {open && detail && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3 pt-3 border-t border-border text-xs text-muted-foreground leading-relaxed whitespace-pre-line"
            >
              {detail}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Tier card ────────────────────────────────────────────────────────────────
function TierCard({ icon, label, range, qualifier, color, bg, border }: {
  icon: string; label: string; range: string; qualifier: string;
  color: string; bg: string; border: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className={`${bg} ${border} border rounded-3xl p-6 flex flex-col gap-3`}
    >
      <div className="text-4xl">{icon}</div>
      <div>
        <p className={`font-black text-lg ${color}`}>{label} Tier</p>
        <p className="text-xs text-muted-foreground font-semibold mt-0.5">{range} WAEC/NECO/GCE average</p>
      </div>
      <div className="space-y-2">
        <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Semester Disbursement</p>
          <p className={`font-black text-base ${color} mt-0.5`}>Merit-based funding</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">× 6 total (2 semesters/year × 3 years)</p>
        </div>
        <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Requirement</p>
          <p className={`font-semibold text-sm ${color} mt-0.5`}>{qualifier}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
        <span className="font-bold text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Cohort Banner ─────────────────────────────────────────────────────────────
function CohortBanner() {
  const { data } = useQuery<any>({ queryKey: ["/api/public/batch-status"], retry: false, staleTime: 60_000 });
  if (!data) return null;
  const pct = data.totalCapacity > 0 ? Math.round((data.enrolled / data.totalCapacity) * 100) : 0;
  return (
    <section className="py-10 px-4 bg-tsia-green/5 border-y border-tsia-green/10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-1">Current Enrollment Cohort</p>
          <h3 className="text-2xl font-black">
            {data.batchNumber ? `Cohort #${data.batchNumber}` : "Active Cohort"}
            {data.isFull ? (
              <span className="ml-3 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 align-middle">FULL</span>
            ) : (
              <span className="ml-3 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 align-middle">OPEN</span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data.isFull
              ? "This cohort has reached capacity. Register now to be notified when the next cohort opens."
              : `${data.remaining} seat${data.remaining === 1 ? "" : "s"} remaining — secure your spot before this cohort fills up.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Enrolled", value: data.enrolled.toLocaleString(), color: "text-tsia-green" },
            { label: "Capacity", value: data.totalCapacity.toLocaleString(), color: "text-slate-700" },
            { label: "Seats Left", value: data.remaining.toLocaleString(), color: data.remaining > 50 ? "text-tsia-green" : data.remaining > 0 ? "text-amber-600" : "text-red-600" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Cohort Fill Rate</span>
            <span className="text-xs font-black text-tsia-green">{pct}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-tsia-green"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {!data.isFull && (
          <div className="mt-5 text-center">
            <Link href="/signup">
              <button className="inline-flex items-center gap-2 bg-tsia-green hover:bg-tsia-green/90 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg transition-all hover:scale-105" data-testid="btn-cohort-apply">
                Claim Your Spot <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PromoLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const PIXEL_ID = "4693177124260614";
    if ((window as any).fbq) { (window as any).fbq("track", "PageView"); return; }
    const f = window as any;
    const n: any = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode!.insertBefore(script, firstScript);
    f.fbq("init", PIXEL_ID);
    f.fbq("track", "PageView");
    const noscript = document.createElement("noscript");
    const img = document.createElement("img");
    img.height = 1; img.width = 1; img.style.display = "none";
    img.src = `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.head.appendChild(noscript);
    return () => { script.remove(); noscript.remove(); };
  }, []);

  const navLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Tiers & Payouts", href: "#tiers" },
    { label: "Disbursements", href: "#disbursements" },
    { label: "Benefits", href: "#benefits" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo → back to /promo */}
          <a href="/promo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Logo variant="badge" height={40} />
          </a>
          {/* Desktop nav — native anchors for reliable scrolling */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <button className="hidden sm:flex text-sm font-bold px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors">Log In</button>
            </Link>
            <Link href="/signup">
              <button className="text-sm font-black px-4 py-2.5 rounded-xl bg-tsia-green text-white hover:bg-tsia-green/90 transition-colors">
                Apply Now
              </button>
            </Link>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border md:hidden bg-background">
              <div className="px-4 py-3 flex flex-col gap-1">
                {navLinks.map(l => (
                  <a key={l.label} href={l.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-semibold py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-tsia-green via-green-800 to-green-950 text-white py-20 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-tsia-gold rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5 text-tsia-gold" />
              Merit-Based Education Funding Across Africa
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6"
          >
            Your Academic Results<br />
            <span className="text-tsia-gold">Deserve Funding</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            TSIA (Tuition Support Initiative for Africa) funds African students based on WAEC/NECO/GCE performance —
            awarding <strong className="text-white">merit-based semester funding</strong> for <strong className="text-white">3 academic years</strong>.
            Sign up free. No sponsor needed. Your results earn the money.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup">
              <button className="flex items-center gap-2 bg-tsia-gold hover:bg-amber-500 text-amber-950 font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-105" data-testid="btn-hero-apply">
                Apply for Free <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <a href="#how-it-works"
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all"
              data-testid="btn-hero-learn"
            >
              <BookOpen className="w-5 h-5" /> How It Works
            </a>
          </motion.div>

          {/* Quick stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {[
              { label: "Semesters Funded", value: "6 total" },
              { label: "How Counted", value: "2/year × 3yrs" },
              { label: "Years of Support", value: "3 years" },
              { label: "Registration Cost", value: "FREE" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                <p className="text-xl font-black text-tsia-gold">{s.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Sponsorship Cohort Info ── */}
      <CohortBanner />

      {/* ── What is TSIA ── */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Platform Overview</p>
            <h2 className="text-3xl font-black">Everything TSIA Offers</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">One platform. Education funding, digital finance, investment tools, and community services — all in one.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: GraduationCap, label: "Student Sponsorship", desc: "Merit-based semester funding", color: "text-tsia-green bg-tsia-green/10" },
              { icon: Award, label: "Scholarship CBT", desc: "Win $100–$250 via merit test", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
              { icon: Wallet, label: "Digital Wallet", desc: "USD/NGN wallet", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
              { icon: TrendingUp, label: "Trade Market", desc: "AI bot investing", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
              { icon: Trophy, label: "Co-Affiliate Fund", desc: "Lifetime profit share", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" },
              { icon: Home, label: "Tenancy Programme", desc: "Affordable housing", color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" },
              { icon: Banknote, label: "Quick Loans", desc: "Tier-based borrowing", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
              { icon: ShoppingBag, label: "TS-Mart Online Stores", desc: "Buy & sell products", color: "text-teal-600 bg-teal-50 dark:bg-teal-900/20" },
              { icon: Gift, label: "Cashback Rewards", desc: "10% on every spend", color: "text-pink-600 bg-pink-50 dark:bg-pink-900/20" },
              { icon: Plane, label: "Glide Africa", desc: "Flights, hotels, cars", color: "text-sky-600 bg-sky-50 dark:bg-sky-900/20" },
              { icon: Users, label: "Affiliate Programme", desc: "Refer & earn", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" },
              { icon: MessageCircle, label: "Community Forum", desc: "Connect & discuss", color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
              { icon: Shield, label: "Verified & Secure", desc: "SMAKEMGGOLD Ltd", color: "text-gray-600 bg-gray-100 dark:bg-gray-800" },
            ].map(({ icon: Icon, label, desc, color }) => (
              <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 hover:border-tsia-green/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-black text-sm leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Step-by-Step Journey</p>
            <h2 className="text-3xl font-black">From Sign-Up to Your First Payout</h2>
            <p className="text-muted-foreground mt-2 text-sm">Follow these 6 steps and receive your sponsorship within 48 hours of verification.</p>
          </div>

          <div className="relative pl-14 space-y-5">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-tsia-green/60 to-transparent" />

            <StepCard step={1} icon={GraduationCap} color="bg-tsia-green"
              title="Create Your Free Account"
              desc="Sign up at tsiforafrica.com/signup. Choose Student, Business (Affiliate), or Both. Enter your name, email, and phone number — no password required."
              detail={"• 100% free to create\n• Supports student and/or affiliate accounts under one email\n• OTP-based secure login — no passwords to forget\n• Takes less than 2 minutes to complete\n• Available on mobile and desktop"}
            />
            <StepCard step={2} icon={Wallet} color="bg-blue-600"
              title="Activate Your Digital Wallet ($5.50 minimum)"
              desc="Fund your TSIA wallet with a minimum of $5.50 to unlock all platform features including verification, bill payments, and the trade market."
              detail={"• Minimum: $5.50\n• Payment methods: Bank transfer, card payment, crypto (USDT TRC20/BEP20)\n• Powered by Korapay & Squad — CBN-licensed payment gateways\n• Funds reflect in your wallet within minutes\n• Wallet displays in both USD and NGN"}
            />
            <StepCard step={3} icon={Shield} color="bg-purple-600"
              title="Complete NIN Identity Verification"
              desc="Submit your 11-digit National Identification Number (NIN). It is instantly verified against the NIMC database — takes under 30 seconds."
              detail={"• NIN verified in real-time via NIMC's secure API\n• Your name on TSIA must match your NIN record exactly\n• Also requires BVN confirmation (for wallet KYC)\n• GPS location check for compliance\n• All data is encrypted and never shared"}
            />
            <StepCard step={4} icon={BookOpen} color="bg-amber-600"
              title="Submit Your WAEC/NECO/GCE Results"
              desc="Enter your exam registration number, year, and grades for at least 5 subjects (Mathematics + English compulsory, plus 3 electives). Upload a valid government ID."
              detail={"• Accepted exams: WAEC, NECO, GCE\n• Compulsory: Mathematics + English Language\n• Electives: Physics, Chemistry, Biology, Economics, and 15+ more\n• ID documents: NIN slip, driver's licence, international passport\n• ⚠️ MINIMUM 50% average required to qualify for any tier\n• Submitted grades cannot be changed after submission"}
            />
            <StepCard step={5} icon={Award} color="bg-rose-600"
              title="Pay the One-Time $3 Portal Fee"
              desc="Pay a one-time $3 portal verification fee from your TSIA wallet. This activates your verification submission and unlocks the biometric face scan."
              detail={"• One-time, non-refundable fee\n• Covers admin review costs and identity verification\n• Deducted directly from your TSIA wallet\n• Unlocks the biometric face scan step immediately\n• Total minimum to fully verify: $5.50 + $3 = $8.50"}
            />
            <StepCard step={6} icon={CheckCircle2} color="bg-tsia-green"
              title="Biometric Face Scan & Admin Approval"
              desc="Complete a quick AI-powered selfie scan to confirm your identity. Admin reviews your full submission within 24–48 hours and assigns your sponsorship tier."
              detail={"• AI facial recognition liveness detection\n• Compared against your uploaded ID document\n• Admin reviews: NIN, WAEC grades, document, face scan\n• Approval notification via in-app + email\n• Once approved: your 1st semester payout is credited to your wallet\n• Rejection includes a reason — some issues can be corrected and resubmitted"}
            />
          </div>
        </div>
      </section>

      {/* ── Tiers & Payouts ── */}
      <section id="tiers" className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Academic Performance Matrix</p>
            <h2 className="text-3xl font-black">Your Results Determine Your Tier</h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-xl mx-auto">
              TSIA uses a proprietary algorithmic scoring system (APM) to calculate your grade average. Score 50%+ to qualify. The higher your average, the more you earn.
            </p>
          </div>

          {/* Minimum score notice */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 mb-8 flex items-start gap-3 max-w-xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm text-red-700 dark:text-red-400">Minimum Score Required: 50%</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                Students scoring below 50% average on the WAEC/NECO/GCE Academic Performance Matrix do not qualify for any sponsorship tier. All other platform features remain accessible.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <TierCard icon="🥈" label="Silver" range="50–59%"
              qualifier="Score 50% to 59% average"
              color="text-slate-600 dark:text-slate-300"
              bg="bg-slate-50 dark:bg-slate-900/30" border="border-slate-200 dark:border-slate-700/50" />
            <TierCard icon="🥇" label="Gold" range="60–74%"
              qualifier="Score 60% to 74% average"
              color="text-amber-600"
              bg="bg-amber-50 dark:bg-amber-900/20" border="border-amber-200 dark:border-amber-700/50" />
            <TierCard icon="🏆" label="Platinum" range="75%+"
              qualifier="Score 75% or above"
              color="text-tsia-green"
              bg="bg-tsia-green/5" border="border-tsia-green/30" />
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Exact payout amounts are revealed upon successful registration and academic assessment. Sign up to see your tier eligibility.
          </p>
        </div>
      </section>

      {/* ── Disbursement Schedule ── */}
      <section id="disbursements" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Payout Schedule</p>
            <h2 className="text-3xl font-black">2 Semesters Per Year, Over 3 Years</h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-xl mx-auto">
              Funding is disbursed every semester — that's <strong>2 payouts per year</strong> for <strong>3 consecutive years</strong>, giving you a total of <strong>6 semester disbursements</strong>.
            </p>
          </div>

          {/* Explainer banner */}
          <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-2xl p-4 mb-8 flex items-start gap-3 max-w-2xl mx-auto">
            <Info className="w-5 h-5 text-tsia-green shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm text-tsia-green">Why 6 disbursements?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A standard academic year has 2 semesters — 1st Semester and 2nd Semester. TSIA funds both, every year, for 3 years.
                That's <strong>2 × 3 = 6 total payouts</strong>. Each one lands directly in your TSIA wallet.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {[1, 2, 3].map(year => (
              <motion.div key={year} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="bg-card border border-border rounded-3xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-tsia-green/10 rounded-2xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-tsia-green" />
                  </div>
                  <div>
                    <p className="font-black text-base">Year {year}</p>
                    <p className="text-xs text-muted-foreground">Academic Year {year} — 2 disbursements</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 bg-tsia-green/10 border border-tsia-green/20 rounded-full px-3 py-1">
                    <Check className="w-3 h-3 text-tsia-green" />
                    <span className="text-[11px] font-bold text-tsia-green">Both semesters funded</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["1st Semester", "2nd Semester"].map(sem => (
                    <div key={sem} className="rounded-2xl p-4 border bg-tsia-green/5 border-tsia-green/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-tsia-green" />
                        <p className="text-[11px] font-bold text-muted-foreground">{sem} Payout</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Merit-based disbursement — amount determined by your academic tier (Silver, Gold, or Platinum).
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-8 bg-gradient-to-br from-tsia-green/10 to-tsia-gold/10 border border-tsia-green/20 rounded-3xl p-6">
            <p className="font-black text-center text-lg mb-2">3-Year Disbursement Summary</p>
            <p className="text-center text-sm text-muted-foreground mb-5">2 semesters/year × 3 years = 6 total payouts</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { tier: "🥈 Silver", note: "Entry-level funding", color: "text-slate-600 dark:text-slate-300" },
                { tier: "🥇 Gold", note: "Mid-level funding", color: "text-amber-600" },
                { tier: "🏆 Platinum", note: "Top-level funding", color: "text-tsia-green" },
              ].map(({ tier, note, color }) => (
                <div key={tier} className="bg-card rounded-2xl p-4 border border-border">
                  <p className="text-sm font-black mb-1">{tier}</p>
                  <p className={`font-bold text-sm ${color}`}>{note}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">across 6 semesters</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">Sign up to see exact payout amounts after your academic assessment.</p>
          </div>
        </div>
      </section>

      {/* ── Benefits / Features ── */}
      <section id="benefits" className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Platform Benefits</p>
            <h2 className="text-3xl font-black">More Than Just Sponsorship</h2>
            <p className="text-muted-foreground mt-2 text-sm">Every TSIA member gets access to a full financial ecosystem — not just education funding.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Gift, color: "bg-pink-100 dark:bg-pink-900/30 text-pink-600",
                title: "10% Cashback on All Transactions",
                desc: "Every bill payment, airtime purchase, data subscription, or peer-to-peer transfer earns 10% back to your Cashback Wallet — withdrawable anytime.",
              },
              {
                icon: Banknote, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600",
                title: "Quick Loans (No Collateral)",
                desc: "Borrow against your verified tier at competitive interest rates. Loan limits scale with your academic tier. Repay over 6–18 months with no collateral needed.",
              },
              {
                icon: TrendingUp, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600",
                title: "AI-Powered Trade Market",
                desc: "Deposit USDT and activate the AI trading bot. Target 2% daily returns during the 1PM–1AM GMT trading window. Choose from 7 verified broker partners.",
              },
              {
                icon: Users, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600",
                title: "Affiliate Referral Income",
                desc: "Share your unique TSIA referral link. Earn commissions on every student who signs up and verifies using your code. Track all referrals on your dashboard.",
              },
              {
                icon: Home, color: "bg-rose-100 dark:bg-rose-900/30 text-rose-600",
                title: "Tenancy Programme",
                desc: "Pay rent in monthly installments instead of a lump sum. TSIA pays your landlord upfront. Available for properties across African cities at 5% p.a. interest.",
              },
              {
                icon: Wallet, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                title: "Multi-Service Digital Wallet",
                desc: "Pay airtime, data, electricity, cable TV, and betting from one wallet. All amounts shown in both USD and NGN. Withdraw to any Nigerian bank account anytime.",
              },
              {
                icon: ShoppingBag, color: "bg-teal-100 dark:bg-teal-900/30 text-teal-600",
                title: "TS-Mart Online Stores Marketplace",
                desc: "Buy and sell products within the TSIA community. Chat with sellers, voice call, rate purchases, and pay with your wallet. Affiliates keep 92% of each sale.",
              },
              {
                icon: Trophy, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700",
                title: "Co-Affiliate Trust Fund",
                desc: "Invest once and receive a lifetime share of TSIA's annual profits. No renewal. No expiry. Early investors lock in lower prices before milestone increases.",
              },
              {
                icon: Plane, color: "bg-sky-100 dark:bg-sky-900/30 text-sky-600",
                title: "Glide Africa — Travel Services",
                desc: "Book hotels, car rentals, and flights across Africa using your TSIA wallet. TSIA retains 10% service fee; the rest goes directly to the service provider.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="bg-card border border-border rounded-2xl p-5 hover:border-tsia-green/30 transition-colors"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-black text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fee Transparency ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Full Transparency</p>
            <h2 className="text-3xl font-black">Every Fee, Clearly Stated</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { category: "Getting Started", items: ["Account registration: FREE", "Wallet activation: $5.50 minimum deposit", "NIN verification: Included free", "Portal fee: $3 one-time"] },
              { category: "Withdrawals", items: ["Bank withdrawal VAT: 7.5% (Nigerian law)", "Trade exchange withdrawal: 5% fee", "Trade bank withdrawal: 8% fee", "Cashback withdrawal: FREE"] },
              { category: "Services", items: ["Peer-to-peer transfers: 8% platform fee", "TS-Mart sales commission: 8% per sale", "Glide Africa bookings: 10% commission", "Savings interest earned: up to 20% p.a."] },
              { category: "Loans", items: ["Student loan interest: 10% p.a. (flat)", "Business loan interest: 30% p.a. (flat)", "Student loan max term: 18 months", "Business loan max term: 24 months"] },
            ].map(({ category, items }) => (
              <div key={category} className="bg-card border border-border rounded-2xl p-5">
                <p className="font-black text-sm mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-tsia-green" /> {category}
                </p>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-tsia-green shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Verified & Trusted</p>
          <h2 className="text-2xl font-black mb-6">TSIA Is Registered, Regulated & Secure</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: "Registered Company", sub: "SMAKEMGGOLD Ltd\nRC: 1359954" },
              { icon: Lock, label: "Encrypted Security", sub: "OTP login, session protection, auto-logout" },
              { icon: Globe, label: "Licensed Payments", sub: "Korapay & Squad — CBN-licensed gateways" },
              { icon: Zap, label: "Real-Time Verification", sub: "NIMC NIN + biometric face scan" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                <Icon className="w-6 h-6 text-tsia-green mx-auto mb-2" />
                <p className="font-black text-xs">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-1 whitespace-pre-line">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-black text-tsia-green uppercase tracking-widest mb-2">Frequently Asked</p>
            <h2 className="text-3xl font-black">Questions & Answers</h2>
          </div>
          <div className="space-y-3">
            <FaqItem q="Is TSIA free to join?" a="Account registration is completely free. To access verification and sponsorship features, you need to activate your wallet with a minimum $5.50 deposit, followed by a one-time $3 portal fee. Total minimum: $8.50." />
            <FaqItem q="What WAEC score do I need to qualify?" a="You need a minimum of 50% average on the APM (Academic Performance Matrix) across at least 5 subjects — Mathematics and English Language are compulsory. Scoring below 50% means you won't qualify for any sponsorship tier." />
            <FaqItem q="How many times will I receive a payout?" a="You receive 2 disbursements per academic year for 3 years — a total of 6 payouts. Think of it as: every academic year has a 1st Semester and a 2nd Semester. TSIA funds both, every year, for 3 years straight." />
            <FaqItem q="What does '6 semesters' mean exactly?" a="It means 2 semesters per year × 3 years = 6 total semester payouts. Each academic year has 2 semesters (1st and 2nd). TSIA disburses funding at the start of each semester, for 3 consecutive years after your verification is approved." />
            <FaqItem q="Can I withdraw my wallet balance to my bank?" a="Yes. You can withdraw from your TSIA wallet to any Nigerian bank account at any time. A 7.5% VAT (required by Nigerian law) applies to bank withdrawals. Withdrawals are processed within 24–48 business hours." />
            <FaqItem q="What happens if my WAEC score is below 50%?" a="Unfortunately, you won't qualify for a sponsorship tier. However, you can still use all other TSIA features — digital wallet, trade market, bill payments, marketplace, tenancy programme, loans, and more." />
            <FaqItem q="Can I have both a student and affiliate account?" a="Yes! One email address can hold both a student account and an affiliate (business) account simultaneously. Switch between them from your dashboard header without logging out." />
            <FaqItem q="How long does verification take after I submit?" a="Admin reviews typically take 24–48 hours on business days. You'll receive an in-app notification and email once your verification is approved or if additional information is needed." />
            <FaqItem q="Is the $3 portal fee refundable?" a="No. The portal fee is a one-time, non-refundable payment that covers identity verification, admin review, and document processing. It is only charged once." />
            <FaqItem q="How do I earn as an affiliate?" a="Sign up as an affiliate, get your unique referral code, and share it with students. You earn commission whenever someone signs up and completes verification using your code. Additional income streams include the trade market, co-affiliate trust fund, and TS-Mart marketplace sales." />
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-20 px-4 bg-gradient-to-br from-tsia-green to-green-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-tsia-gold rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-tsia-gold font-black uppercase tracking-widest text-xs mb-3">Ready to Start?</p>
            <h2 className="text-4xl font-black mb-4">Your WAEC Results Are Worth Funding</h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
              African students are already receiving merit-based semester funding for their academic performance.
              Your results could earn you 6 semester payouts over 3 years. Sign up free today and get assessed.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/signup">
                <button className="flex items-center gap-2 bg-tsia-gold hover:bg-amber-500 text-amber-950 font-black text-base px-8 py-4 rounded-2xl transition-all hover:scale-105 shadow-xl" data-testid="btn-cta-apply">
                  Apply for Free <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all" data-testid="btn-cta-whatsapp">
                  <Phone className="w-5 h-5" /> WhatsApp Us
                </button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-white/60">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-tsia-gold" /> Free to register</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-tsia-gold" /> No collateral</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-tsia-gold" /> Results-based, not social status</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-tsia-gold" /> 2 semesters/year × 3 years</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-background border-t border-border py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center sm:items-start gap-2">
              <Logo variant="badge" height={36} />
              <p className="text-xs text-muted-foreground">SMAKEMGGOLD Ltd · RC: 1359954</p>
              <p className="text-xs text-muted-foreground">support@tsia.africa · +4407916395474</p>
              {/* Social media links */}
              <div className="flex items-center gap-2 mt-1">
                {[
                  { href: "https://www.facebook.com/tsiforafrica", label: "Facebook", bg: "bg-[#1877f2]", symbol: "f" },
                  { href: "https://www.instagram.com/tsiforafrica", label: "Instagram", bg: "bg-gradient-to-br from-[#fdf497] via-[#fd5949] to-[#285AEB]", symbol: "IG" },
                  { href: "https://x.com/tsiforafrica", label: "X / Twitter", bg: "bg-black", symbol: "𝕏" },
                  { href: "https://www.youtube.com/@tsiforafrica", label: "YouTube", bg: "bg-[#ff0000]", symbol: "▶" },
                  { href: "https://www.tiktok.com/@tsiforafrica", label: "TikTok", bg: "bg-[#010101]", symbol: "TT" },
                ].map(({ href, label, bg, symbol }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    aria-label={label}
                    className={`w-8 h-8 ${bg} rounded-full flex items-center justify-center text-white text-[11px] font-black hover:opacity-80 transition-opacity shrink-0`}
                    data-testid={`link-social-${label.toLowerCase().replace(/[^a-z]/g, "")}`}
                  >
                    {symbol}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <a href="/promo" className="hover:text-foreground transition-colors">Home</a>
              <Link href="/signup"><span className="hover:text-foreground transition-colors cursor-pointer">Sign Up</span></Link>
              <Link href="/login"><span className="hover:text-foreground transition-colors cursor-pointer">Log In</span></Link>
              <Link href="/affiliate-signup"><span className="hover:text-foreground transition-colors cursor-pointer">Affiliate</span></Link>
              <Link href="/tenancy"><span className="hover:text-foreground transition-colors cursor-pointer">Tenancy</span></Link>
              <Link href="/contact"><span className="hover:text-foreground transition-colors cursor-pointer">Contact</span></Link>
              <Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms</span></Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} TSIA — Tuition Support Initiative for Africa. All rights reserved. · This is an advertising/informational page.
          </div>
        </div>
      </footer>

      {/* ── Full-Screen AI Chat (only on this page) ── */}
      <PromoAiChat />
    </div>
  );
}
