import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Phone, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const WHATSAPP_NUMBER = "447552647146";
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
  "Tell me about the marketplace",
  "I need to speak with the team",
];

const KB: { patterns: RegExp[]; response: string }[] = [
  // ─── Greetings ──────────────────────────────────────────────────────
  {
    patterns: [/^(hello|hi|hey|good morning|good afternoon|good evening|yo|sup|greet)/i],
    response: `Hello! welcome to TSIA ai support. i'm here to help you with anything on our platform.\n\nI can help you with:\n• **Student verification & sponsorship** — how to get funded\n• **Digital wallet & transactions** — withdrawals, balance in USD & NGN\n• **Trade market & AI bot** — invest and earn 2% daily\n• **Co-Affiliate trust fund** — lifetime investment tiers\n• **Tenancy program** — landlord and tenant services\n• **Student & business loans** — borrow against your earnings\n• **TS-Mart Online Stores marketplace** — buy and sell products\n• **Glide Africa** — hotel, car, and flight bookings\n• **Account & login issues** — OTP, security, inactivity\n\nWhat would you like to know?`,
  },

  // ─── What is TSIA ───────────────────────────────────────────────────
  {
    patterns: [/what is tsia|about tsia|who.*tsia|tsia.*what|explain tsia|tell me about/i],
    response: `**TSIA** (Tuition Support Initiative for Africa) is a full-service fintech platform built to empower African students, entrepreneurs, and investors. Operated by **SMAKEMGGOLD Ltd** (RC: 1359954).\n\nhere's what we offer:\n\n🎓 **Student sponsorship** — earn $110–$230 based on your WAEC performance\n🤝 **Affiliate program** — refer students and earn lifetime commissions\n📈 **Global trade market** — AI-powered 2% daily ROI via crypto/forex trading\n💎 **Co-Affiliate trust fund** — invest $100–$10,000 and get lifetime profit share\n🏠 **Tenancy program** — TSIA pays landlords upfront; tenants pay monthly\n💳 **Student & business loans** — borrow against your verified earnings\n🛍️ **TS-Mart Online Stores marketplace** — buy and sell products using your TSIA wallet\n✈️ **Glide Africa** — book hotels, car rentals, and flights across Africa\n\nour mission: democratize education, housing, and financial prosperity across Africa.`,
  },

  // ─── Verification / Onboarding ──────────────────────────────────────
  {
    patterns: [/verif|nin|waec|biometric|kyc|identity|onboard|enroll|sign.?up|register/i],
    response: `to get verified on TSIA, here is the full 4-step process:\n\n**step 1 — identity verification**\n• provide your NIN (National Identification Number)\n• verified instantly against the NIMC database\n\n**step 2 — WAEC result validation**\n• enter your WAEC examination details — registration number, year, and grades for at least 5 subjects (2 compulsory + 3 electives)\n• upload a government-issued ID document (JPEG, PNG, or PDF up to 5MB)\n\n**step 3 — payment + wallet KYC**\n• complete 3-step KYC: NIN re-confirm + BVN + GPS location\n• pay the one-time **$3 portal fee** (≈₦4,380) to activate your account\n• payment is processed securely via Paystack\n\n**step 4 — biometric face scan**\n• after payment, complete a quick face scan for biometric identity confirmation\n• your WAEC results are then submitted and your tier is assigned\n\nafter verification, your WAEC scores are analysed via the APM and you are assigned a tier:\n🏆 **Platinum** — 75%+ average → $225–$230 payout\n🥇 **Gold** — 60–74% → $160–$180 payout\n🥈 **Silver** — 50–59% → $110–$130 payout\n\n👉 go to **/signup** to start the process right now!`,
  },

  // ─── Sponsorship tiers & payout ─────────────────────────────────────
  {
    patterns: [/tier|platinum|gold|silver|payout|sponsorship|how much|reward|grade|score|waec.*grade|academic|performance/i],
    response: `TSIA assigns your sponsorship tier based on your **WAEC Academic Performance Matrix (APM)**:\n\n🏆 **Platinum** (75%+ average score)\n→ payout range: **$225–$230**\n\n🥇 **Gold** (60–74% average score)\n→ payout range: **$160–$180**\n\n🥈 **Silver** (50–59% average score)\n→ payout range: **$110–$130**\n\nyour As, Bs, Cs – Fs are calculated via the APM using Arithmetical Algorithms with alpha numeric points from A–Z.\n\npayouts go directly to your TSIA digital wallet. you can withdraw or use them for fees anytime.`,
  },

  // ─── Wallet & transactions ───────────────────────────────────────────
  {
    patterns: [/wallet|balance|withdraw|transaction|fund|naira|ngn|usd|money|pay.*out|vat|tax/i],
    response: `your **TSIA digital wallet** holds your sponsorship payouts and earnings.\n\n**key details:**\n• balance shown in both **USD and NGN** (₦1,600/$1 display rate)\n• all bank withdrawals carry a **7.5% VAT** as required by Nigerian law\n• exchange withdrawals also carry a service fee\n• transactions are processed within 24–48 hours\n\n**how to withdraw:**\n1. go to your dashboard → wallet section\n2. click "withdraw"\n3. enter the amount and your bank details\n4. our team processes it within 2 working days\n\n💡 payment rate: ₦1,460/$1 | payout rate: ₦1,280/$1 | display: ₦1,600/$1`,
  },

  // ─── Student Loans ───────────────────────────────────────────────────
  {
    patterns: [/student.*loan|loan.*student|education.*loan|borrow.*student|study.*loan|tuition.*loan/i],
    response: `**TSIA student loan program** — available to all enrolled and verified students!\n\n**eligibility:**\n✅ verification approved by admin team\n✅ your tier determines your maximum loan amount\n\n**loan limits by tier:**\n🏆 Platinum students → up to **$200**\n🥇 Gold students → up to **$150**\n🥈 Silver students → up to **$100**\n\n**loan terms:**\n• interest rate: **10% per year** (flat)\n• repayment periods: 6, 12, or 18 months\n• repayment is deducted from your wallet balance monthly\n• no collateral required\n\n**how to apply:**\n1. go to your student dashboard\n2. open "student loan" from the quick access menu\n3. select your desired amount and repayment term\n4. submit — approval within 48 hours\n\n💡 you can only have one active loan at a time.`,
  },

  // ─── Affiliate / Business Loans ─────────────────────────────────────
  {
    patterns: [/business.*loan|loan.*business|affiliate.*loan|loan.*affiliate|borrow.*affiliate/i],
    response: `**TSIA business loan** — available to affiliates who have started earning!\n\n**eligibility:**\n✅ registered affiliate with at least 1 verified referral OR trade wallet balance above $0\n\n**loan limit calculation:**\n• base limit: $500\n• per verified referral: +$50 (up to $2,000)\n• trade balance credit: 50% of trade wallet balance (up to $3,000)\n• co-affiliate multiplier: Starter = 1×, Growth = 1.5×, Elite = 2×\n• maximum: **$5,000**\n\n**loan terms:**\n• interest rate: **15% per year** (flat)\n• repayment periods: 6, 12, or 24 months\n• no collateral — identity-based underwriting\n\n**how to apply:**\n1. go to your affiliate dashboard\n2. open "loan" from the quick access menu\n3. your available limit is shown automatically\n4. select amount and repayment term — decision within 48 hours`,
  },

  // ─── Trade Market ────────────────────────────────────────────────────
  {
    patterns: [/trade|market|roi|return|invest|bot|daily|profit|crypto|usdt|trc20|bep20|binance|bybit|exness|octafx|etoro|iq option|xm group/i],
    response: `**TSIA global trade market** — our AI-powered investment platform:\n\n📈 **target ROI:** 100% total return via 2% daily profit\n⏰ **BOT window:** active **1PM – 1AM GMT** on working days (activate manually at 1PM)\n💼 **deposit methods:** TRC20 (USDT on TRON) or BEP20 (USDT on BSC)\n🔒 **20% reserve fund:** every deposit allocates 20% to TSIA's safety reserve\n🤖 **broker selection:** choose from 7 verified partners\n\n**fee structure on deposit:**\n• 75% → your trade wallet\n• 20% → strategic reserve fund\n• 5% → affiliate pool\n\n**withdrawal fees:**\n• exchange: 5% + 5% affiliate pool\n• bank: 8% + 5% affiliate pool\n\n**minimum deposit:** $10\n\nyou can track live trades via the embedded TradingView chart and switch between BTC/USDT, ETH/USDT, and EUR/USD.`,
  },

  // ─── Brokers ─────────────────────────────────────────────────────────
  {
    patterns: [/broker|trading partner|who trade|trader|fund manager|exness|octafx|bybit|etoro/i],
    response: `TSIA's verified broker partners for the trade market:\n\n🔶 **Binance** — crypto & futures | rating: 4.9★ | min: $10 | fee: 0.1%\n📊 **Exness** — forex & crypto | rating: 4.8★ | min: $10 | fee: 0.3 pips\n🌍 **OctaFX** — forex & CFDs | rating: 4.7★ | min: $25 | fee: 0.4 pips\n💹 **Bybit** — crypto derivatives | rating: 4.7★ | min: $10 | fee: 0.1%\n⚖️ **XM Group** — forex & metals | rating: 4.6★ | min: $5 | fee: 0.6 pips\n👥 **eToro** — social copy trading | rating: 4.5★ | min: $50 | fee: 1%\n📱 **IQ Option** — options & crypto | rating: 4.4★ | min: $10 | fee: 0.5%\n\ngo to **affiliate dashboard → trade market → select your broker** to choose your partner.`,
  },

  // ─── Affiliate Program ───────────────────────────────────────────────
  {
    patterns: [/affiliate|refer|commission|referral|code|earn|link|share.*code|my code/i],
    response: `**TSIA affiliate program** — earn by referring students:\n\n🔗 **how it works:**\n1. sign up at /affiliate-signup\n2. get your unique referral code (e.g., TSIA-EMM0001)\n3. share your code or referral link with students\n4. earn commission for every student who verifies using your code\n\n📊 **affiliate dashboard features:**\n• co-affiliate trust fund (invest for lifetime profits)\n• global trade market (AI bot, 2% daily ROI)\n• business loans (borrow against your earnings)\n• TS-Mart Online Stores marketplace (buy & sell products)\n• Glide Africa (hotel, car, flight bookings)\n• tenancy business management\n• forum & community discussions\n• voice calls within the platform\n\ngo to **/affiliate-signup** to join now!`,
  },

  // ─── Co-Affiliate Trust Fund ─────────────────────────────────────────
  {
    patterns: [/co.?affiliate|initiator|trust fund|investor|starter|growth|elite|lifetime.*profit|1.*million|milestone/i],
    response: `**co-affiliate / initiator trust fund** — a lifetime investment program:\n\n💎 **starter** — invest $100 → lifetime profit participation\n💎 **growth** — invest $300 → higher lifetime profit share\n💎 **elite** — invest $500–$10,000 → custom profit share %\n\n**program details:**\n🎯 target: 1,000,000 co-affiliate investors\n📈 every 150,000 new investors = **+20% price increase** on new subscriptions\n💰 **5% of all TSIA profits shared** proportionally with co-affiliates forever\n✅ one-time payment — no renewal, no expiry\n\n**how elite profit share is calculated:**\nyour investment ÷ total elite pool × 5% annual TSIA profits\n\naccess from **affiliate dashboard → co-affiliate fund** section.`,
  },

  // ─── Tenancy Program ─────────────────────────────────────────────────
  {
    patterns: [/tenancy|landlord|rent|house|property|lease|tenant|accommodation|flat|apartment|housing/i],
    response: `**TSIA tenancy program** — making housing affordable across Africa:\n\n🏠 **for landlords:**\n• list your property on TSIA tenancy (3–10 year lease)\n• TSIA pays you a **lump sum upfront** (88% of total rent value)\n• no more chasing annual payments\n\n🏠 **for tenants:**\n• browse available properties by city and budget\n• pay in **monthly installments** at just 5% annual interest\n• instead of ₦1M upfront, pay ~₦87,500/month!\n\n**how to access:**\n→ visit **/tenancy** from the main menu\n→ affiliates can access tenancy from their dashboard`,
  },

  // ─── TS-Mart Online Stores ──────────────────────────────────────────
  {
    patterns: [/e.?commerce|shop|store|buy|purchase|product|order|sell|marketplace|listing|rating|review/i],
    response: `**TSIA TS-Mart Online Stores marketplace** — buy and sell within the TSIA community:\n\n🛍️ **buyers:**\n• browse products from verified sellers\n• filter by category, price, condition, and location\n• pay directly from your TSIA wallet\n• rate and review products after purchase\n• all prices shown in **USD and NGN**\n\n📦 **sellers (affiliates):**\n• list your products for sale\n• TSIA retains **8% commission** on every sale\n• you keep 92% — credited to your wallet\n• manage your listings and orders from your dashboard\n\n💬 **chat with sellers** before purchasing for negotiation or questions.\n\naccess from **your dashboard → TS-Mart Online Stores** section.`,
  },

  // ─── Glide Africa ─────────────────────────────────────────────────────
  {
    patterns: [/tour africa|hotel|car.*rent|car.*hire|flight|dispatch|taxi|e.?taxi|transport|ride|delivery|logistics|booking/i],
    response: `**Glide Africa** is TSIA's travel and mobility division:\n\n🏨 **hotel booking** — search and book hotels in any African city. pay directly from your wallet. TSIA retains 10% as service commission.\n\n🚗 **car rental** — self-drive or chauffeured rentals across Africa. daily rates, pay from wallet.\n\n✈️ **flight booking** — book flights by route and passenger count. ticket price per person, paid from your wallet.\n\n📦 **dispatch & e-taxi** — coming soon!\n\n**all bookings:**\n• paid from your TSIA personal wallet\n• TSIA retains 10% commission; balance forwarded to provider\n• prices shown in both USD and NGN\n\naccess from **your dashboard → Glide Africa** section.`,
  },

  // ─── Login / OTP / Account ───────────────────────────────────────────
  {
    patterns: [/login|sign.?in|password|otp|code.*email|access|account|forgot|can't.*log|not.*log|session|logout|auto.*log|switch.*role|two.*account/i],
    response: `TSIA uses **passwordless OTP login** for maximum security:\n\n**how to log in:**\n1. go to **/login**\n2. enter your registered email address\n3. receive a 6-digit code in your email\n4. enter the code within 10 minutes\n\n⏱️ **auto-logout:** after 15 minutes of inactivity for account security.\n\n🔄 **dual account:** one email can hold both a **student** and **affiliate** account — switch roles seamlessly from your dashboard header.\n\n📝 **new user?**\n• students → **/signup**\n• affiliates → **/affiliate-signup**\n\n**common issues:**\n• didn't receive OTP? check spam, or wait 2 minutes and request a new one\n• still stuck? click "talk to TSIA team" below`,
  },

  // ─── Fees & costs ────────────────────────────────────────────────────
  {
    patterns: [/fee|cost|price|charge|how much.*portal|portal.*pay|\$3|registration.*cost/i],
    response: `here is a full breakdown of all TSIA fees:\n\n✅ **student sign-up** — completely free\n💳 **portal verification fee** — $3 one-time (≈₦4,380 at ₦1,460/$)\n📊 **wallet withdrawals** — 7.5% VAT on bank withdrawals\n\n**trade market fees:**\n• deposit: 20% → reserve, 5% → affiliate pool, 75% → your wallet\n• exchange withdrawal: 5% + 5% affiliate pool\n• bank withdrawal: 8% + 5% affiliate pool\n\n**TS-Mart Online Stores:** 8% commission per sale (seller pays)\n**Glide Africa:** 10% commission per booking\n\n**loan interest:**\n• student loans: 10% per year (flat)\n• affiliate business loans: 15% per year (flat)\n\nall fees shown transparently before you confirm any action. no hidden charges.`,
  },

  // ─── Contact / Support ───────────────────────────────────────────────
  {
    patterns: [/contact|support|help|team|staff|human|person|agent|speak|whatsapp|call|email.*team/i],
    response: `i'd love to help further! for issues needing our team's direct attention:\n\n📱 **whatsapp / call** — +447552647146 — or click "talk to TSIA team" below to open whatsapp directly\n⏰ available monday–friday, 9am–6pm (GMT)\n\n📧 **email** — support@tsia.africa — response within 24 hours\n\n📋 **contact form** — visit /contact to send a formal inquiry\n\nour team responds within 2–4 hours on business days.`,
  },

  // ─── Admin / Admin Panel ─────────────────────────────────────────────
  {
    patterns: [/admin|approve|reject|verif.*admin|disburs|panel/i],
    response: `**TSIA admin panel** — for authorized TSIA administrators only:\n\n🔐 access at **/admin** using admin credentials\n\n**admin functions:**\n• review and approve student verification submissions\n• view NIN, WAEC grades, biometric data, and documents\n• approve or reject with reason\n• process loan disbursements\n• view platform statistics\n\n**verification flow (updated):**\n1. student completes NIN + WAEC\n2. student pays $3 portal fee\n3. student completes biometric face scan\n4. admin reviews within 24–48 hours\n5. approval triggers wallet funding\n\nif you're a student waiting, you'll receive a notification once processed.`,
  },

  // ─── General fallback ────────────────────────────────────────────────
];

function getBotResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase().trim();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(msg))) {
      return entry.response;
    }
  }
  return `i understand you're asking about: **"${userMessage}"**\n\nlet me help you find the right answer. here are the topics i know well:\n\n• **verification & sponsorship** — type "how do i get verified"\n• **student loans** — type "student loan"\n• **trade market** — type "how does trade work"\n• **tenancy** — type "tenancy program"\n• **affiliate loans** — type "business loan"\n• **co-affiliate fund** — type "trust fund"\n• **TS-Mart Online Stores** — type "marketplace"\n• **tour africa** — type "tour africa"\n• **account issues** — type "login help"\n\nor click **"talk to TSIA team"** below to speak directly with our team on whatsapp — they'll sort you out in minutes! 📱`;
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
    text: `hello${user ? ` ${user.firstName}` : ""}! 👋 i'm TSIA's ai assistant — i know everything about this platform. ask me anything!\n\nquick topics: verification • sponsorship tiers • loans • trade market • TS-Mart Online Stores • Glide Africa • tenancy • co-affiliate fund • account help`,
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
                    <Trash2 className="w-3.5 h-3.5" /> end chat
                  </button>
                  <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" data-testid="button-close-chat">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="w-7 h-7 rounded-full bg-tsia-green/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-tsia-green" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-tsia-green text-white rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}>
                      {formatMessage(msg.text)}
                      <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-white/60 text-right" : "text-muted-foreground"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {typing && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-tsia-green/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-tsia-green" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 bg-tsia-green/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                {showQuickActions && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium px-1">Quick questions:</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map(action => (
                        <button
                          key={action}
                          onClick={() => sendMessage(action)}
                          className="text-xs bg-tsia-green/10 hover:bg-tsia-green/20 text-tsia-green font-medium px-3 py-1.5 rounded-full transition-colors border border-tsia-green/20"
                          data-testid={`quick-action-${action.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* WhatsApp CTA */}
              <div className="px-4 py-2 border-t bg-muted/30 flex-shrink-0">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium hover:underline"
                  data-testid="link-whatsapp-support">
                  <Phone className="w-3.5 h-3.5" /> talk to TSIA team on whatsapp
                </a>
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t bg-card flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="ask me anything about TSIA..."
                    className="flex-1 h-10 rounded-xl text-sm"
                    data-testid="input-ai-message"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || typing}
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-tsia-green hover:bg-tsia-green/90 shrink-0"
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-5 z-30 w-14 h-14 bg-tsia-green text-white rounded-full shadow-2xl flex items-center justify-center"
        data-testid="button-open-ai"
        aria-label="Open AI assistant"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-tsia-gold rounded-full text-[9px] font-black text-slate-900 flex items-center justify-center">AI</span>
      </motion.button>
    </>
  );
}
