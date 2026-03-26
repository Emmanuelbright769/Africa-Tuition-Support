import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const WHATSAPP_NUMBER = "2348012345678";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  "How do I verify my identity?",
  "How does the Trade Market work?",
  "What is the Co-Affiliate program?",
  "How does tenancy work?",
  "I need to speak with the team",
];

const KB: { patterns: RegExp[]; response: string }[] = [
  {
    patterns: [/verif|nin|waec|biometric|kyc|identity|onboard/i],
    response: `To get verified on TSIA, you'll go through a 2-step process:\n\n1️⃣ **Identity Verification** – Provide your NIN (National Identification Number) and WAEC examination details (reg number, year, grades for at least 5 subjects).\n\n2️⃣ **Biometric Capture** – A quick face scan for identity confirmation.\n\nAfter verification, you pay a one-time **$3 portal fee** (≈₦4,380) and receive your sponsorship tier (Platinum, Gold, or Silver) based on your WAEC performance.\n\n👉 Go to **Sign Up** to start the process!`,
  },
  {
    patterns: [/tier|platinum|gold|silver|payout|sponsorship|how much|reward/i],
    response: `TSIA assigns you a sponsorship tier based on your WAEC Academic Performance Matrix:\n\n🏆 **Platinum** (75%+ WAEC score) → $225–$230 payout\n🥇 **Gold** (60–74%) → $160–$180 payout\n🥈 **Silver** (50–59%) → $110–$130 payout\n\nPayouts are made to your TSIA wallet and can be withdrawn or used for fees. Your tier is locked in after verification — work hard in school!`,
  },
  {
    patterns: [/wallet|balance|withdraw|deposit|fund|money|pay|naira|ngn/i],
    response: `Your **TSIA Digital Wallet** holds your sponsorship payouts.\n\n💰 Balance is shown in USD and NGN\n🏦 Withdrawals are processed to your Nigerian bank account\n📊 All transactions carry a **7.5% VAT** as required by law\n\nYou can view your wallet from the **Student Dashboard** after logging in. Need help with a specific transaction? I can connect you to our team on WhatsApp!`,
  },
  {
    patterns: [/trade|market|roi|return|invest|bot|daily|profit|crypto|usdt|trc20|bep20|binance/i],
    response: `The **TSIA Global Trade Market** is our AI-powered trading platform:\n\n📈 **100% ROI target** – 2% daily profit via AI trading BOT\n⏰ **BOT Activation** – Must be manually activated at **1PM on working days**\n💼 **Deposit** in TRC20 (USDT) or BEP20 (USDT)\n🔒 **20% Reserve Fund** from every deposit ensures sustainability\n🤖 **Choose a Broker** – Select your preferred broker for trades\n\nMinimum deposit is $10. You can track live trades on the embedded chart in your dashboard. Remember: all investments carry risk.`,
  },
  {
    patterns: [/broker|trading partner|who trade|trader|fund manager/i],
    response: `In the Trade Market, you can select from our verified broker partners:\n\n🔶 **Binance** – Crypto & Futures (Rating: 4.9⭐)\n📊 **Exness** – Forex & Crypto (Rating: 4.8⭐)\n🌍 **OctaFX** – Forex & CFDs (Rating: 4.7⭐)\n💹 **Bybit** – Crypto Derivatives (Rating: 4.7⭐)\n⚖️ **XM Group** – Forex & Metals (Rating: 4.6⭐)\n👥 **eToro** – Social Copy Trading (Rating: 4.5⭐)\n📱 **IQ Option** – Options & Crypto (Rating: 4.4⭐)\n\nGo to your **Trade Market** section → click "Select Broker" to choose your preferred partner.`,
  },
  {
    patterns: [/affiliate|refer|commission|referral|code|earn|link/i],
    response: `The **TSIA Affiliate Program** lets you earn by referring students:\n\n🔗 Share your unique **referral code** (e.g., TSIA-EMM0001)\n💵 Earn commission for every verified student you refer\n📊 Track referrals and commissions in your Affiliate Dashboard\n\nTo join, sign up at **/affiliate-signup** with your details. Affiliate accounts have access to the Co-Affiliate Trust Fund and Global Trade Market too!`,
  },
  {
    patterns: [/co.?affiliate|initiator|trust fund|investor|tier.*invest|100|300|500|elite|growth|starter/i],
    response: `The **Co-Affiliate/Initiator Trust Fund** is a lifetime investment program:\n\n💎 **Starter** – $100 → Lifetime profit share\n💎 **Growth** – $300 → Higher lifetime profit share\n💎 **Elite** – $500–$10,000 → Custom profit share percentage\n\n🎯 Target: 1,000,000 investors\n📈 Every 150,000 new investors = **+20% price increase**\n💰 **5% lifetime profit share** from all TSIA profits\n✅ One-time payment, no renewal fees\n\nAccess it from your **Affiliate Dashboard → Co-Affiliate Fund** section.`,
  },
  {
    patterns: [/tenancy|landlord|rent|house|property|lease|tenant|accommodation|flat|apartment/i],
    response: `The **TSIA Tenancy Program** makes housing affordable:\n\n🏠 **For Landlords:**\n• List your property for 3–10 year lease\n• TSIA pays you a **lump sum upfront** (with a small discount)\n• No more chasing rent every year!\n\n🏠 **For Tenants:**\n• Find a property and pay in **monthly installments**\n• Small interest added (5%) makes it manageable\n• No massive upfront annual payment needed\n\nVisit our **Tenancy page** to browse available properties or list your property! Go to the menu → Tenancy.`,
  },
  {
    patterns: [/tour africa|dispatch|taxi|e.?taxi|transport|ride|delivery/i],
    response: `**TOUR AFRICA** is TSIA's mobility and logistics division:\n\n🚗 **E-Taxi** – Book safe, affordable rides across Africa *(Coming Soon)*\n📦 **Dispatch** – Same-day package delivery service *(Coming Soon)*\n\nWe're expanding into transportation to provide more value to African communities. Stay tuned for the launch! You can access the Tour Africa page from your dashboard menu.`,
  },
  {
    patterns: [/login|sign.?in|password|otp|code|email|access|account/i],
    response: `TSIA uses **passwordless OTP login** for security:\n\n1. Go to **/login**\n2. Enter your registered email address\n3. Receive a 6-digit code in your email\n4. Enter the code to access your account\n\n⏱️ For security, you're **automatically logged out after 15 minutes** of inactivity.\n\n📝 **New user?** Go to **/signup** to create a student account, or **/affiliate-signup** for a business account.\n\nStill having issues? I'll connect you to our support team!`,
  },
  {
    patterns: [/fee|cost|how much|price|charge|pay.*portal|portal.*pay/i],
    response: `Here's a summary of TSIA fees:\n\n✅ **Student Sign-up** – Free (no cost to register)\n💳 **Portal Verification Fee** – $3 (≈₦4,380) one-time fee\n📊 **Wallet Transactions** – 7.5% VAT applied\n💰 **Trade Market** – Minimum $10 deposit; 20% reserve fund on deposits\n\nAll fees are transparent and shown before you confirm any action. No hidden charges!`,
  },
  {
    patterns: [/contact|support|help|team|staff|human|person|agent|speak/i],
    response: `I'd love to help further! For issues that need our team's direct attention:\n\n📱 **WhatsApp Support** – Click the button below to chat with the TSIA team directly\n⏰ Available Monday–Friday, 9AM–6PM (WAT)\n\nAlternatively, you can use our **Contact Us** page at /contact to send a formal inquiry.`,
  },
  {
    patterns: [/what is tsia|about tsia|who.*tsia|tsia.*what|explain tsia/i],
    response: `**TSIA** (Tuition Support Initiative for Africa) is a fintech platform that:\n\n🎓 **Provides up to $230** in tuition support for verified African students based on academic merit\n🤝 **Enables Affiliates** to earn by referring students and investing in the Trust Fund\n📈 **Operates a Trade Market** with AI-powered crypto/forex trading (2% daily ROI target)\n🏠 **Offers Tenancy** solutions for landlords and tenants across Africa\n🚗 **Launches TOUR AFRICA** for transport and logistics\n\nOur mission: Democratize access to education, housing, and financial prosperity across Africa!`,
  },
  {
    patterns: [/hello|hi |hey |good morning|good afternoon|good evening|greet|start/i],
    response: `Hello! 👋 Welcome to **TSIA AI Support**! I'm here to help you with anything on our platform.\n\nI can assist you with:\n• Student verification & sponsorship\n• Wallet & transactions\n• Trade Market & brokers\n• Co-Affiliate Trust Fund\n• Tenancy (landlord & tenant)\n• Tour Africa\n• Account access\n\nWhat would you like help with today?`,
  },
];

function getBotResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(msg))) {
      return entry.response;
    }
  }
  return `I understand you're asking about: **"${userMessage}"**\n\nI don't have a specific answer for that right now, but our team can definitely help!\n\n📱 Click **"Talk to TSIA Team"** below to connect with us directly on WhatsApp, or try asking about:\n• Student verification\n• Trade Market\n• Tenancy program\n• Co-Affiliate Fund\n• Account issues`;
}

function formatMessage(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: `Hello${user ? ` ${user.firstName}` : ""}! 👋 I'm TSIA's AI assistant. How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    const response = getBotResponse(msg);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: response, timestamp: new Date() };
    setMessages((prev) => [...prev, aiMsg]);
    setTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-4 z-50 w-[340px] sm:w-[380px] shadow-2xl rounded-2xl overflow-hidden border border-border"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            {/* Header */}
            <div className="bg-tsia-green text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-tsia-green" />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">TSIA AI Assistant</p>
                  <p className="text-xs text-white/70">Always here to help</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors" data-testid="button-close-assistant">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="bg-background flex flex-col" style={{ height: 360, overflowY: "auto", padding: "12px 12px 0" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-tsia-green/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <Bot className="w-4 h-4 text-tsia-green" />
                    </div>
                  )}
                  <div className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] text-sm leading-relaxed whitespace-pre-line ${
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
                <div className="mb-3 flex justify-start">
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
            {messages.length <= 2 && !typing && (
              <div className="bg-background px-3 pb-2 flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button key={action} onClick={() => sendMessage(action)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-tsia-green/40 text-tsia-green hover:bg-tsia-green hover:text-white transition-colors bg-tsia-green/5"
                    data-testid={`button-quick-action-${action.slice(0, 10).replace(/\s/g, "-").toLowerCase()}`}>
                    {action}
                  </button>
                ))}
              </div>
            )}

            {/* WhatsApp button */}
            <div className="bg-background px-3 pb-2">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                data-testid="link-whatsapp-support">
                <Phone className="w-3.5 h-3.5" />
                Talk to TSIA Team on WhatsApp
              </a>
            </div>

            {/* Input */}
            <div className="bg-muted/50 border-t border-border px-3 py-2.5 flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about TSIA..."
                className="flex-1 h-9 text-sm bg-background border-border"
                data-testid="input-ai-message"
              />
              <Button size="sm" onClick={() => sendMessage()} disabled={!input.trim() || typing}
                className="h-9 w-9 p-0 bg-tsia-green hover:bg-tsia-green/90" data-testid="button-send-ai-message">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-tsia-green text-white shadow-lg hover:bg-tsia-green/90 flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
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

        {!open && (
          <motion.span className="absolute -top-1 -right-1 w-4 h-4 bg-tsia-gold rounded-full flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <span className="text-[9px] font-bold text-slate-900">AI</span>
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
