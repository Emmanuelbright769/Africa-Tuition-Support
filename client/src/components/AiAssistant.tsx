import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Phone, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const WHATSAPP_NUMBER = "2348012345678";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const STORAGE_KEY = "tsia_ai_chat_history";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: string;
}

const QUICK_ACTIONS = [
  "How do I get verified?",
  "How does the trade market work?",
  "What is the co-affiliate program?",
  "How does the tenancy program work?",
  "How do I apply for a loan?",
  "What are the sponsorship tiers?",
  "I need to speak with the team",
];

const KB: { patterns: RegExp[]; response: string }[] = [
  // ─── Greetings ──────────────────────────────────────────────────────
  {
    patterns: [/^(hello|hi|hey|good morning|good afternoon|good evening|yo|sup|greet)/i],
    response: `Hello! welcome to TSIA ai support. i'm here to help you with anything on our platform.\n\nI can help you with:\n• **Student verification & sponsorship** — how to get funded\n• **Digital wallet & transactions** — withdrawals, VAT, balance\n• **Trade market & brokers** — how to invest and earn 2% daily\n• **Co-Affiliate trust fund** — lifetime investment tiers\n• **Tenancy program** — landlord and tenant services\n• **Student loans** — borrow against your sponsorship\n• **Business loans** — affiliate loan limits and repayment\n• **Tour Africa** — dispatch and e-taxi services\n• **Account & login issues** — OTP, security, inactivity\n\nWhat would you like to know?`,
  },

  // ─── What is TSIA ───────────────────────────────────────────────────
  {
    patterns: [/what is tsia|about tsia|who.*tsia|tsia.*what|explain tsia|tell me about/i],
    response: `**TSIA** (Tuition Support Initiative for Africa) is a full-service fintech platform built to empower African students, entrepreneurs, and investors.\n\nhere's what we offer:\n\n🎓 **Student sponsorship** — earn $110–$230 based on your WAEC performance\n🤝 **Affiliate program** — refer students and earn lifetime commissions\n📈 **Global trade market** — AI-powered 2% daily ROI via crypto/forex trading\n💎 **Co-Affiliate trust fund** — invest $100–$10,000 and get 5% lifetime profit share\n🏠 **Tenancy program** — TSIA pays landlords upfront; tenants pay monthly\n💳 **Student & business loans** — borrow against your verified earnings\n🚗 **Tour Africa** — e-taxi and dispatch logistics (coming soon)\n\nour mission: democratize education, housing, and financial prosperity across Africa.`,
  },

  // ─── Verification / Onboarding ──────────────────────────────────────
  {
    patterns: [/verif|nin|waec|biometric|kyc|identity|onboard|enroll|sign.?up|register/i],
    response: `to get verified on TSIA, here is the full 2-step process:\n\n**step 1 — identity verification**\n• provide your NIN (National Identification Number)\n• enter your WAEC examination details — registration number, year, and grades for at least 5 subjects (2 compulsory + 3 electives)\n• upload a government-issued ID document (JPEG, PNG, or PDF up to 5MB)\n\n**step 2 — biometric + payment**\n• complete a quick face scan for biometric identity confirmation\n• pay the one-time **$3 portal fee** (approximately ₦4,380) to activate your account\n\nafter verification, your WAEC scores are analysed and you are assigned a tier:\n🏆 **Platinum** — 75%+ average → $225–$230 payout\n🥇 **Gold** — 60–74% → $160–$180 payout\n🥈 **Silver** — 50–59% → $110–$130 payout\n\n👉 go to **/signup** to start the process right now!`,
  },

  // ─── Sponsorship tiers & payout ─────────────────────────────────────
  {
    patterns: [/tier|platinum|gold|silver|payout|sponsorship|how much|reward|grade|score|waec.*grade|academic|performance/i],
    response: `TSIA assigns your sponsorship tier based on your **WAEC Academic Performance Matrix**:\n\n🏆 **Platinum** (75%+ average score)\n→ payout range: **$225–$230**\n\n🥇 **Gold** (60–74% average score)\n→ payout range: **$160–$180**\n\n🥈 **Silver** (50–59% average score)\n→ payout range: **$110–$130**\n\nyour As, Bs, Cs – Fs are calculated via the APM using Arithmetical Algorithms with alpha numeric points from A–Z.\n\npayouts go directly to your TSIA digital wallet. you can withdraw or use them for fees anytime.`,
  },

  // ─── Wallet & transactions ───────────────────────────────────────────
  {
    patterns: [/wallet|balance|withdraw|transaction|fund|naira|ngn|usd|money|pay.*out|vat|tax/i],
    response: `your **TSIA digital wallet** holds your sponsorship payouts and earnings.\n\n**key details:**\n• balance shown in both USD and NGN (converted at ₦1,280 per $1 for payouts)\n• all bank withdrawals carry a **7.5% VAT** as required by Nigerian law\n• exchange withdrawals also carry a service fee\n• transactions are processed within 24–48 hours\n\n**how to withdraw:**\n1. go to your student dashboard → wallet section\n2. click "withdraw"\n3. enter the amount and your bank details\n4. our team processes it within 2 working days\n\n💡 keep in mind: the $3 onboarding fee is charged at ₦1,460 per $1 (payment rate), while payouts are calculated at ₦1,280 per $1 (payout rate).`,
  },

  // ─── Student Loans ───────────────────────────────────────────────────
  {
    patterns: [/student.*loan|loan.*student|education.*loan|borrow.*student|study.*loan|tuition.*loan/i],
    response: `**TSIA student loan program** — available to all enrolled and verified students!\n\n**eligibility:**\n✅ you must have completed verification (NIN + WAEC + biometric + $3 fee)\n✅ your verification must be approved by the admin team\n✅ your tier determines your maximum loan amount\n\n**loan limits by tier:**\n🏆 Platinum students → up to **$200**\n🥇 Gold students → up to **$150**\n🥈 Silver students → up to **$100**\n\n**loan terms:**\n• interest rate: **10% per year** (flat)\n• repayment periods: 6, 12, or 18 months\n• repayment is deducted from your wallet balance monthly\n• no collateral required — your verified identity is enough\n\n**how to apply:**\n1. go to your student dashboard\n2. click "student loan" in the sidebar\n3. select your desired amount and repayment term\n4. submit your application\n5. approval decision within 48 hours\n\n💡 you can only have one active loan at a time. repay it first before applying for another.`,
  },

  // ─── Affiliate / Business Loans ─────────────────────────────────────
  {
    patterns: [/business.*loan|loan.*business|affiliate.*loan|loan.*affiliate|borrow.*affiliate/i],
    response: `**TSIA business loan** — available to affiliates who have started earning!\n\n**eligibility:**\n✅ you must be a registered affiliate\n✅ you must have at least 1 verified referral OR a trade wallet balance above $0\n✅ your loan limit is calculated based on your total activity\n\n**loan limit calculation:**\n• **base limit:** $500\n• **per verified referral:** +$50 (up to $2,000 from referrals)\n• **trade balance credit:** 50% of your current trade wallet balance (up to $3,000)\n• **co-affiliate multiplier:** Starter = 1×, Growth = 1.5×, Elite = 2×\n• **maximum loan:** $5,000\n\n**loan terms:**\n• interest rate: **15% per year** (flat)\n• repayment periods: 6, 12, or 24 months\n• monthly payments auto-calculated\n• no collateral — identity-based underwriting\n\n**how to apply:**\n1. go to your affiliate dashboard\n2. click "loan" in the sidebar\n3. your available limit is shown automatically\n4. select amount and repayment term\n5. apply — decision within 48 hours`,
  },

  // ─── Trade Market ────────────────────────────────────────────────────
  {
    patterns: [/trade|market|roi|return|invest|bot|daily|profit|crypto|usdt|trc20|bep20|binance|bybit|exness|octafx|etoro|iq option|xm group/i],
    response: `**TSIA global trade market** — our AI-powered investment platform:\n\n📈 **target ROI:** 100% total return via 2% daily profit\n⏰ **BOT activation:** must be manually activated at **1pm on every working day**\n💼 **deposit methods:** TRC20 (USDT on TRON) or BEP20 (USDT on BSC)\n🔒 **20% reserve fund:** every deposit allocates 20% to TSIA's safety reserve\n🤖 **broker selection:** choose from 7 verified partners\n\n**fee structure:**\n• on deposit: 75% to your wallet, 20% reserve, 5% affiliate pool\n• exchange withdrawal: 5% fee + 5% affiliate pool\n• bank withdrawal: 8% fee + 5% affiliate pool\n\n**minimum deposit:** $10\n\nyou can track live trades via the embedded TradingView chart in your dashboard. switch between BTC/USDT, ETH/USDT, and EUR/USD.`,
  },

  // ─── Brokers ─────────────────────────────────────────────────────────
  {
    patterns: [/broker|trading partner|who trade|trader|fund manager|exness|octafx|bybit|etoro/i],
    response: `TSIA's verified broker partners for the trade market:\n\n🔶 **Binance** — crypto & futures | rating: 4.9★ | min: $10 | fee: 0.1%\n📊 **Exness** — forex & crypto | rating: 4.8★ | min: $10 | fee: 0.3 pips\n🌍 **OctaFX** — forex & CFDs | rating: 4.7★ | min: $25 | fee: 0.4 pips\n💹 **Bybit** — crypto derivatives | rating: 4.7★ | min: $10 | fee: 0.1%\n⚖️ **XM Group** — forex & metals | rating: 4.6★ | min: $5 | fee: 0.6 pips\n👥 **eToro** — social copy trading | rating: 4.5★ | min: $50 | fee: 1%\n📱 **IQ Option** — options & crypto | rating: 4.4★ | min: $10 | fee: 0.5%\n\ngo to **affiliate dashboard → trade market → select your broker** to choose your preferred partner.`,
  },

  // ─── Affiliate Program ───────────────────────────────────────────────
  {
    patterns: [/affiliate|refer|commission|referral|code|earn|link|share.*code|my code/i],
    response: `**TSIA affiliate program** — earn by referring students:\n\n🔗 **how it works:**\n1. sign up at /affiliate-signup\n2. get your unique referral code (e.g., TSIA-EMM0001)\n3. share your code or referral link with students\n4. earn commission for every student who verifies using your code\n\n📊 **track your earnings:**\n• view referral list and commissions in your affiliate dashboard\n• commissions are credited to your trade wallet\n\n🏦 **affiliate dashboard access:**\n• co-affiliate trust fund (invest for lifetime profits)\n• global trade market (deposit and earn 2% daily)\n• business loans (borrow against your earnings)\n• tenancy business management\n\ngo to **/affiliate-signup** to join the program now!`,
  },

  // ─── Co-Affiliate Trust Fund ─────────────────────────────────────────
  {
    patterns: [/co.?affiliate|initiator|trust fund|investor|starter|growth|elite|lifetime.*profit|1.*million|milestone/i],
    response: `**co-affiliate / initiator trust fund** — a lifetime investment program:\n\n💎 **starter** — invest $100 → lifetime profit participation\n💎 **growth** — invest $300 → higher lifetime profit share\n💎 **elite** — invest $500 to $10,000 → custom profit share %\n\n**program details:**\n🎯 target: 1,000,000 co-affiliate investors\n📈 every 150,000 new investors = **+20% price increase** on new subscriptions\n💰 **5% of all TSIA profits shared** proportionally with co-affiliates forever\n✅ one-time payment — no renewal fees, no expiry\n\n**how elite profit share is calculated:**\nyour investment ÷ total elite pool × 5% annual TSIA profits\n\naccess from **affiliate dashboard → co-affiliate fund** section.`,
  },

  // ─── Tenancy Program ─────────────────────────────────────────────────
  {
    patterns: [/tenancy|landlord|rent|house|property|lease|tenant|accommodation|flat|apartment|housing/i],
    response: `**TSIA tenancy program** — making housing affordable across Africa:\n\n🏠 **for landlords:**\n• list your property on TSIA tenancy (3–10 year lease)\n• TSIA pays you a **lump sum upfront** (88% of total rent value)\n• you get your money immediately — no more chasing annual payments\n• TSIA manages all tenant sourcing, payment collection, and communication\n• example: ₦1,000,000/yr × 5 years = ₦4,400,000 paid to you upfront\n\n🏠 **for tenants:**\n• browse available properties by city and budget\n• apply for a lease through TSIA\n• pay in **monthly installments** at just 5% annual interest\n• instead of paying ₦1M upfront, pay ₦87,500/month!\n\n**how to access:**\n→ visit **/tenancy** from the main menu\n→ affiliates can also access tenancy from their dashboard "tenancy" section`,
  },

  // ─── Tour Africa ─────────────────────────────────────────────────────
  {
    patterns: [/tour africa|dispatch|taxi|e.?taxi|transport|ride|delivery|logistics/i],
    response: `**tour Africa** is TSIA's mobility and logistics division:\n\n🚗 **e-taxi** — book safe, affordable rides across Africa *(coming soon)*\n📦 **dispatch** — same-day and next-day package delivery *(coming soon)*\n\nwe're expanding into transportation to provide more value to African communities. both drivers and delivery agents can register interest now.\n\naccess from **your dashboard → tour Africa** section.`,
  },

  // ─── Login / OTP / Account ───────────────────────────────────────────
  {
    patterns: [/login|sign.?in|password|otp|code.*email|access|account|forgot|can't.*log|not.*log|session|logout|auto.*log/i],
    response: `TSIA uses **passwordless OTP login** for maximum security:\n\n**how to log in:**\n1. go to **/login**\n2. enter your registered email address\n3. receive a 6-digit code in your email\n4. enter the code within 10 minutes to access your account\n\n⏱️ **security feature:** you are **automatically logged out after 15 minutes** of inactivity to protect your account.\n\n📝 **new user?**\n• students → go to **/signup**\n• affiliates / business → go to **/affiliate-signup**\n\n**common issues:**\n• didn't receive OTP? check your spam folder, or wait 2 minutes and request a new one\n• in development mode, OTP codes are shown as a hint on the login page\n• still stuck? click "talk to TSIA team" below to get direct support`,
  },

  // ─── Fees & costs ────────────────────────────────────────────────────
  {
    patterns: [/fee|cost|price|charge|how much.*portal|portal.*pay|$3|registration.*cost/i],
    response: `here is a full breakdown of all TSIA fees:\n\n✅ **student sign-up** — completely free (no cost to register)\n💳 **portal verification fee** — $3 one-time (≈₦4,380 at ₦1,460/$)\n📊 **wallet transactions** — 7.5% VAT applied on bank withdrawals\n\n**trade market fees:**\n• deposit: 20% to reserve fund, 5% to affiliate pool, 75% to your wallet\n• exchange withdrawal: 5% service fee + 5% affiliate pool\n• bank withdrawal: 8% service fee + 5% affiliate pool\n\n**loan interest:**\n• student loans: 10% per year (flat rate)\n• affiliate business loans: 15% per year (flat rate)\n\nall fees are shown transparently before you confirm any action. no hidden charges.`,
  },

  // ─── Contact / Support ───────────────────────────────────────────────
  {
    patterns: [/contact|support|help|team|staff|human|person|agent|speak|whatsapp|call|email.*team/i],
    response: `i'd love to help further! for issues that need our team's direct attention:\n\n📱 **whatsapp support** — click "talk to TSIA team" below to chat with us directly\n⏰ available monday–friday, 9am–6pm (WAT)\n\n📧 **contact form** — visit /contact to send a formal inquiry\n\n🧭 **office:** Port Harcourt, Rivers State, Nigeria\n\nour team responds within 2–4 hours on business days. for urgent account issues, whatsapp is the fastest option.`,
  },

  // ─── Admin / Admin Panel ─────────────────────────────────────────────
  {
    patterns: [/admin|approve|reject|verif.*admin|disburs|panel/i],
    response: `**TSIA admin panel** — for authorized TSIA administrators only:\n\n🔐 access at **/admin** using admin credentials\n\n**admin functions:**\n• review and approve student verification submissions\n• view NIN, WAEC grades, biometric data, and documents\n• approve or reject with reason\n• process loan disbursements\n• view platform statistics (total students, pending verifications, disbursements)\n\n**student verification flow:**\n1. student submits identity + WAEC + biometric\n2. admin reviews within 24–48 hours\n3. approval triggers wallet funding\n\nif you are a student waiting for approval, you'll receive a notification once processed.`,
  },

  // ─── E-Commerce ──────────────────────────────────────────────────────
  {
    patterns: [/e.?commerce|shop|store|buy|purchase|product|order/i],
    response: `**TSIA e-commerce** is a purchasing marketplace available to affiliate members:\n\n🛒 browse and purchase products from verified vendors\n📦 products ship across Africa\n💳 pay using your TSIA wallet balance\n\naccess from **affiliate dashboard → e-commerce** section.\n\nnote: this is a purchasing platform — you can buy, not sell on TSIA e-commerce. sellers can reach us via /contact to discuss partnership.`,
  },

  // ─── General fallback ────────────────────────────────────────────────
];

function getBotResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase().trim();
  // Try to match knowledge base
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(msg))) {
      return entry.response;
    }
  }
  // Fallback
  return `i understand you're asking about: **"${userMessage}"**\n\nlet me help you find the right answer. here are the topics i know well:\n\n• **verification & sponsorship** — type "how do i get verified"\n• **student loans** — type "student loan"\n• **trade market** — type "how does trade work"\n• **tenancy** — type "tenancy program"\n• **affiliate loans** — type "business loan"\n• **co-affiliate fund** — type "trust fund"\n• **account issues** — type "login help"\n\nor click **"talk to TSIA team"** below to speak directly with our team on whatsapp — they'll sort you out in minutes! 📱`;
}

function formatMessage(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
    return (
      <span key={lineIdx}>
        {formatted}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {}
}

export function AiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const welcomeMsg: Message = {
    id: "welcome",
    role: "ai",
    text: `hello${user ? ` ${user.firstName}` : ""}! 👋 i'm TSIA's ai assistant — i know everything about this platform. ask me anything!\n\nquick topics: verification • loans • trade market • tenancy • co-affiliate fund • tour Africa • account help`,
    timestamp: new Date().toISOString(),
  };

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadHistory();
    return saved.length > 0 ? saved : [welcomeMsg];
  });

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: msg, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 700));

    const response = getBotResponse(msg);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: response, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, aiMsg]);
    setTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const endChat = () => {
    const fresh = [{ ...welcomeMsg, id: Date.now().toString(), timestamp: new Date().toISOString() }];
    setMessages(fresh);
    saveHistory(fresh);
    localStorage.removeItem(STORAGE_KEY);
  };

  const showQuickActions = messages.filter(m => m.role === "user").length === 0 && !typing;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Full-screen panel */}
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed inset-0 z-50 flex flex-col bg-background md:inset-auto md:bottom-6 md:right-5 md:w-[420px] md:h-[680px] md:rounded-2xl md:shadow-2xl md:border md:border-border overflow-hidden"
            >
              {/* Header */}
              <div className="bg-tsia-green text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-tsia-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">TSIA ai assistant</p>
                    <p className="text-xs text-white/70">i know everything about TSIA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={endChat}
                    title="End chat and clear history"
                    className="flex items-center gap-1 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-full transition-colors"
                    data-testid="button-end-chat"
                  >
                    <Trash2 className="w-3 h-3" />
                    end chat
                  </button>
                  <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors ml-1" data-testid="button-close-assistant">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-2`}>
                    {msg.role === "ai" && (
                      <div className="w-7 h-7 rounded-full bg-tsia-green/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                        <Bot className="w-4 h-4 text-tsia-green" />
                      </div>
                    )}
                    <div className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-tsia-green text-white rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}>
                      {msg.role === "ai" ? formatMessage(msg.text) : msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-tsia-gold/20 flex items-center justify-center ml-2 mt-1 flex-shrink-0">
                        <User className="w-4 h-4 text-tsia-gold" />
                      </div>
                    )}
                  </div>
                ))}

                {typing && (
                  <div className="flex justify-start mb-2">
                    <div className="w-7 h-7 rounded-full bg-tsia-green/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <Bot className="w-4 h-4 text-tsia-green" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1.5 items-center h-4">
                        {[0, 1, 2].map((i) => (
                          <motion.div key={i} className="w-2 h-2 bg-tsia-green/60 rounded-full"
                            animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick actions */}
              {showQuickActions && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button key={action} onClick={() => sendMessage(action)}
                      className="text-xs px-2.5 py-1.5 rounded-full border border-tsia-green/40 text-tsia-green hover:bg-tsia-green hover:text-white transition-colors bg-tsia-green/5"
                      data-testid={`button-quick-${action.slice(0, 12).replace(/\s/g, "-").toLowerCase()}`}>
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {/* WhatsApp */}
              <div className="px-4 pb-2">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                  data-testid="link-whatsapp-support">
                  <Phone className="w-3.5 h-3.5" />
                  talk to TSIA team on whatsapp
                </a>
              </div>

              {/* Input */}
              <div className="border-t border-border px-3 py-3 flex gap-2 flex-shrink-0 bg-muted/30">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ask me anything about TSIA..."
                  className="flex-1 h-10 text-sm bg-background"
                  data-testid="input-ai-message"
                />
                <Button size="sm" onClick={() => sendMessage()} disabled={!input.trim() || typing}
                  className="h-10 w-10 p-0 bg-tsia-green hover:bg-tsia-green/90 flex-shrink-0" data-testid="button-send-ai-message">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-tsia-green text-white shadow-lg hover:bg-tsia-green/90 flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        data-testid="button-open-ai-assistant"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {!open && messages.filter(m => m.role === "user").length > 0 && (
          <motion.span className="absolute -top-1 -right-1 w-5 h-5 bg-tsia-gold rounded-full flex items-center justify-center text-[9px] font-bold text-slate-900"
            animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            {Math.min(messages.filter(m => m.role === "user").length, 9)}
          </motion.span>
        )}
        {!open && messages.filter(m => m.role === "user").length === 0 && (
          <motion.span className="absolute -top-1 -right-1 w-4 h-4 bg-tsia-gold rounded-full flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <span className="text-[9px] font-bold text-slate-900">AI</span>
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
