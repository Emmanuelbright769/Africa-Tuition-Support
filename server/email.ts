import nodemailer from "nodemailer";

const FROM_NAME = "TSIA – SMAKEMGGOLD Ltd";
const FROM_EMAIL = process.env.SMTP_FROM || process.env.FROM_EMAIL || "noreply@tsiforafrica.com";
const BREVO_API  = "https://api.brevo.com/v3/smtp/email";
const RESEND_API = "https://api.resend.com/emails";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TSIA Email</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a6b3c 0%,#2d9d5c 100%);padding:28px 32px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:44px;height:44px;background:#c9a227;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;vertical-align:middle;">T</div>
              <span style="color:#fff;font-size:20px;font-weight:800;vertical-align:middle;margin-left:8px;">TSIA</span>
            </div>
            <p style="color:rgba(255,255,255,0.75);font-size:12px;margin:6px 0 0;">SMAKEMGGOLD Ltd &nbsp;·&nbsp; RC: 1359954</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f7f9f7;padding:20px 32px;text-align:center;border-top:1px solid #e5ede8;">
            <p style="color:#9caa9f;font-size:11px;margin:0;">© ${new Date().getFullYear()} SMAKEMGGOLD Ltd · TSIA for Africa</p>
            <p style="color:#b5c0b8;font-size:10px;margin:4px 0 0;">This is an automated message, please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:#1a6b3c;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">
      ${label}
    </a>
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── SMTP transport (primary — no domain verification needed) ─────────────────
function getSmtpTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: { user, pass },
    // Force LOGIN/PLAIN — Brevo SMTP keys don't work with CRAM-MD5
    authMethod: "PLAIN",
    tls: { rejectUnauthorized: false },
  } as any);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // 1 — Brevo REST API (works over HTTPS port 443, no domain ownership verification)
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || FROM_EMAIL;
      const res = await fetch(BREVO_API, {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender:      { name: FROM_NAME, email: senderEmail },
          to:          [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const body = await res.text();
      if (res.ok) {
        console.log(`[EMAIL] Brevo ✓ "${subject}" → ${to}`);
        return;
      }
      console.error(`[EMAIL] Brevo ${res.status} for ${to}: ${body}`);
    } catch (err: any) {
      console.error(`[EMAIL] Brevo error for ${to}: ${err.message}`);
    }
  }

  // 2 — SMTP (nodemailer — requires outbound port 587/465)
  const smtp = getSmtpTransport();
  if (smtp) {
    try {
      await smtp.sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html });
      console.log(`[EMAIL] SMTP ✓ "${subject}" → ${to}`);
      return;
    } catch (err: any) {
      console.error(`[EMAIL] SMTP error for ${to}: ${err.message}`);
    }
  }

  // 3 — In development with no provider, skip silently
  if (process.env.NODE_ENV !== "production") {
    console.log(`[EMAIL] Dev mode (no provider) — skipping "${subject}" to ${to}`);
    return;
  }

  // 4 — Resend REST API (legacy fallback)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(`[EMAIL] No email provider configured — skipping send to ${to}`);
    return;
  }
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[EMAIL] Resend ${res.status} for ${to}: ${body}`);
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  console.log(`[EMAIL] Resend ✓ "${subject}" → ${to}`);
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

export async function sendOtpEmail(to: string, code: string, isSignup = false): Promise<void> {
  const subject = isSignup ? "Your TSIA sign-up code" : "Your TSIA login code";
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">
      ${isSignup ? "Welcome to TSIA 🎉" : "Your login code"}
    </h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 28px;line-height:1.6;">
      ${isSignup
        ? "Thanks for joining TSIA – the student & affiliate investment platform for Africa. Use the code below to verify your email and activate your account."
        : "Use the one-time code below to log in. It expires in <strong>10 minutes</strong>."}
    </p>

    <!-- OTP Box -->
    <div style="background:#f0f8f4;border:2px dashed #2d9d5c;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;">
      <p style="color:#6b7c72;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">One-Time Code</p>
      <p style="color:#1a6b3c;font-size:48px;font-weight:900;letter-spacing:12px;margin:0;font-family:monospace;">${code}</p>
      <p style="color:#9caa9f;font-size:11px;margin:12px 0 0;">Valid for 10 minutes · Do not share this code</p>
    </div>

    <p style="color:#9caa9f;font-size:13px;margin:0;text-align:center;">
      If you did not request this, you can safely ignore this email.
    </p>
  `);
  await sendEmail(to, subject, html);
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string, role: "student" | "affiliate"): Promise<void> {
  const isAffiliate = role === "affiliate";
  const subject = `Welcome to TSIA, ${firstName}!`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">Welcome, ${firstName}! 🌍</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 16px;line-height:1.6;">
      Your <strong>${isAffiliate ? "Affiliate" : "Student"}</strong> account is now active. Here's what you can do right away:
    </p>
    <ul style="color:#4a5e50;font-size:14px;padding-left:18px;line-height:2;">
      <li>💰 Fund your <strong>TSIA Personal Wallet</strong></li>
      ${isAffiliate
        ? "<li>🤝 Share your referral link and earn commissions</li><li>📈 Access the AI-powered Trade Market</li>"
        : "<li>📚 Complete your WAEC profile</li><li>💳 Start QCE savings to build credit eligibility</li>"}
      <li>🛒 Shop and sell on the P2P marketplace</li>
      <li>🔔 Stay updated via real-time notifications</li>
    </ul>
    ${btn("https://tsiforafrica.com", "Open My Dashboard")}
    <p style="color:#9caa9f;font-size:12px;text-align:center;margin:8px 0 0;">
      Minimum wallet activation: <strong>$5.00</strong>
    </p>
  `);
  await sendEmail(to, subject, html);
}

// ─── Wallet Credit ────────────────────────────────────────────────────────────

export async function sendWalletCreditEmail(to: string, firstName: string, amount: string, newBalance: string): Promise<void> {
  const subject = `Your TSIA Wallet was credited $${amount}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">Wallet Credited 💳</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your TSIA wallet has been topped up.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7c72;font-size:13px;">Amount credited</td>
          <td style="color:#1a6b3c;font-size:22px;font-weight:900;text-align:right;">+$${amount}</td>
        </tr>
        <tr>
          <td style="color:#6b7c72;font-size:13px;padding-top:8px;">New balance</td>
          <td style="color:#1a1a1a;font-size:16px;font-weight:700;text-align:right;padding-top:8px;">$${newBalance}</td>
        </tr>
      </table>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View Wallet")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Order Update ─────────────────────────────────────────────────────────────

export async function sendOrderUpdateEmail(to: string, firstName: string, orderStatus: string, productTitle: string, orderId: number): Promise<void> {
  const statusMap: Record<string, { emoji: string; label: string; desc: string }> = {
    confirmed: { emoji: "✅", label: "Order Confirmed", desc: "The seller has confirmed your order and will prepare it for delivery." },
    shipped: { emoji: "🚚", label: "Order Shipped", desc: "Your order is on its way! The seller has dispatched your item." },
    delivered: { emoji: "📦", label: "Order Delivered", desc: "Your order has been marked as delivered. Enjoy your purchase!" },
    cancelled: { emoji: "❌", label: "Order Cancelled", desc: "Unfortunately your order has been cancelled. Contact support if you need help." },
    pending: { emoji: "⏳", label: "Order Pending", desc: "Your order is awaiting seller confirmation." },
  };
  const s = statusMap[orderStatus] ?? { emoji: "📋", label: "Order Update", desc: `Your order status changed to: ${orderStatus}.` };
  const subject = `${s.emoji} ${s.label} – ${productTitle}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 4px;font-size:22px;">${s.emoji} ${s.label}</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName},</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 20px;">
      <p style="color:#1a1a1a;font-size:15px;font-weight:700;margin:0 0 4px;">${productTitle}</p>
      <p style="color:#6b7c72;font-size:12px;margin:0 0 12px;">Order #${orderId}</p>
      <p style="color:#4a5e50;font-size:14px;margin:0;">${s.desc}</p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "Track My Order")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Loan Update ──────────────────────────────────────────────────────────────

export async function sendLoanUpdateEmail(to: string, firstName: string, status: string, amount: string): Promise<void> {
  const approved = status === "approved";
  const subject = approved ? `Loan Approved – $${amount} disbursed` : `Loan Application Update`;
  const html = baseTemplate(`
    <h2 style="color:${approved ? "#1a6b3c" : "#c0392b"};margin:0 0 8px;font-size:22px;">
      ${approved ? "✅ Loan Approved!" : "📋 Loan Update"}
    </h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName},</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      ${approved
        ? `<p style="color:#4a5e50;font-size:14px;margin:0;">Your loan of <strong>$${amount}</strong> has been approved and will be disbursed to your TSIA wallet shortly. Repay on time to build your credit history.</p>`
        : `<p style="color:#4a5e50;font-size:14px;margin:0;">Your loan application for <strong>$${amount}</strong> is currently <strong>${status}</strong>. You will receive another update when there is a change.</p>`
      }
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View Loan Details")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Verification Update ──────────────────────────────────────────────────────

export async function sendVerificationUpdateEmail(to: string, firstName: string, status: string): Promise<void> {
  const approved = status === "approved";
  const subject = approved ? "Identity Verified ✅" : "Verification Update";
  const html = baseTemplate(`
    <h2 style="color:${approved ? "#1a6b3c" : "#e67e22"};margin:0 0 8px;font-size:22px;">
      ${approved ? "✅ Identity Verified" : "📋 Verification Update"}
    </h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName},</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      ${approved
        ? `<p style="color:#4a5e50;font-size:14px;margin:0;">Your identity has been <strong>verified</strong>. You now have full access to all TSIA features including higher loan limits and trade access.</p>`
        : `<p style="color:#4a5e50;font-size:14px;margin:0;">Your verification submission is <strong>${status}</strong>. Our team is reviewing your documents and you will hear back soon.</p>`
      }
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "Go to Dashboard")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Referral Commission ──────────────────────────────────────────────────────

export async function sendReferralCommissionEmail(to: string, firstName: string, amount: string, referredName: string): Promise<void> {
  const subject = `You earned $${amount} referral commission!`;
  const html = baseTemplate(`
    <h2 style="color:#c9a227;margin:0 0 8px;font-size:22px;">🎉 Referral Commission Earned!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName},</p>
    <div style="background:#fffbf0;border:1px solid #f0d070;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#4a5e50;font-size:14px;margin:0;"><strong>${referredName}</strong> joined TSIA using your referral link, and you have earned a commission of <span style="color:#c9a227;font-weight:900;font-size:20px;">$${amount}</span> credited to your TSIA wallet.</p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View My Earnings")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Price Drop Alert ─────────────────────────────────────────────────────────

export async function sendPriceDropEmail(to: string, firstName: string, productTitle: string, oldPrice: string, newPrice: string, productId: number): Promise<void> {
  const subject = `Price Drop! ${productTitle} is now $${newPrice}`;
  const savings = (parseFloat(oldPrice) - parseFloat(newPrice)).toFixed(2);
  const html = baseTemplate(`
    <h2 style="color:#e74c3c;margin:0 0 8px;font-size:22px;">🏷️ Price Drop Alert!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, an item on your watch list just dropped in price.</p>
    <div style="background:#fff5f5;border:1px solid #fccfcf;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#1a1a1a;font-weight:700;font-size:15px;margin:0 0 12px;">${productTitle}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#9caa9f;font-size:13px;text-decoration:line-through;">Was: $${oldPrice}</td>
          <td style="color:#e74c3c;font-size:24px;font-weight:900;text-align:right;">$${newPrice}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:8px;color:#27ae60;font-size:13px;font-weight:600;">You save: $${savings}</td>
        </tr>
      </table>
    </div>
    ${btn(`https://tsiforafrica.com/dashboard#product-${productId}`, "View Product")}
  `);
  await sendEmail(to, subject, html);
}
