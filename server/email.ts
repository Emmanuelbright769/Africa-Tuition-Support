import nodemailer from "nodemailer";

const FROM_NAME = "TSIA";
const FROM_EMAIL = process.env.SMTP_FROM || process.env.FROM_EMAIL || "noreply@tsiforafrica.com";
const BREVO_API  = "https://api.brevo.com/v3/smtp/email";
const RESEND_API = "https://api.resend.com/emails";

export const ADMIN_EMAIL = "support@tsiforafrica.com";

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
            <p style="color:rgba(255,255,255,0.75);font-size:12px;margin:6px 0 0;">Tuition Support Initiative for Africa</p>
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
          <td style="background:#f7f9f7;padding:24px 32px 20px;text-align:center;border-top:1px solid #e5ede8;">
            <!-- Social links -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:0 6px;">
                        <a href="https://www.facebook.com/tsiforafrica" style="display:inline-block;width:32px;height:32px;background:#1877f2;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-weight:900;font-size:15px;text-decoration:none;" title="Facebook">f</a>
                      </td>
                      <td style="padding:0 6px;">
                        <a href="https://www.instagram.com/tsiforafrica" style="display:inline-block;width:32px;height:32px;background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%);border-radius:50%;text-align:center;line-height:32px;color:#fff;font-weight:900;font-size:13px;text-decoration:none;" title="Instagram">&#9679;</a>
                      </td>
                      <td style="padding:0 6px;">
                        <a href="https://www.youtube.com/@tsiforafrica" style="display:inline-block;width:32px;height:32px;background:#ff0000;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-weight:900;font-size:13px;text-decoration:none;" title="YouTube">&#9654;</a>
                      </td>
                      <td style="padding:0 6px;">
                        <a href="https://x.com/tsiforafrica" style="display:inline-block;width:32px;height:32px;background:#000000;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-weight:900;font-size:13px;text-decoration:none;" title="X / Twitter">𝕏</a>
                      </td>
                      <td style="padding:0 6px;">
                        <a href="https://www.tiktok.com/@tsiforafrica" style="display:inline-block;width:32px;height:32px;background:#010101;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-weight:900;font-size:11px;text-decoration:none;" title="TikTok">TT</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:6px;font-size:9px;color:#b5c0b8;text-align:center;">FB</td>
                      <td style="padding-top:6px;font-size:9px;color:#b5c0b8;text-align:center;">IG</td>
                      <td style="padding-top:6px;font-size:9px;color:#b5c0b8;text-align:center;">YT</td>
                      <td style="padding-top:6px;font-size:9px;color:#b5c0b8;text-align:center;">X</td>
                      <td style="padding-top:6px;font-size:9px;color:#b5c0b8;text-align:center;">TT</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="color:#9caa9f;font-size:11px;margin:0;">© ${new Date().getFullYear()} TSIA – Tuition Support Initiative for Africa</p>
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

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
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
          replyTo:     { name: "TSIA Support", email: "support@tsiforafrica.com" },
          subject,
          htmlContent: html,
          headers: {
            "X-Mailer": "TSIA-Mailer/1.0",
          },
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

// ─── Withdrawal OTP ───────────────────────────────────────────────────────────

export async function sendWithdrawalOtpEmail(
  to: string,
  firstName: string,
  code: string,
  amount: string,
  type: "bank" | "crypto" | "general",
): Promise<void> {
  const typeLabel = type === "bank" ? "Bank Withdrawal" : type === "crypto" ? "USDT Crypto Withdrawal" : "Withdrawal";
  const subject = `Your TSIA Withdrawal OTP — ${typeLabel}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">Withdrawal Security Code</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 6px;line-height:1.6;">
      Hi <strong>${firstName}</strong>, you requested a withdrawal of <strong>$${amount}</strong> via <strong>${typeLabel}</strong>.
    </p>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;line-height:1.6;">
      Use the one-time code below to authorise this transaction. It expires in <strong>10 minutes</strong>.
    </p>

    <!-- OTP Box -->
    <div style="background:#fff8e1;border:2px dashed #d97706;border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="color:#92400e;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Withdrawal OTP</p>
      <p style="color:#b45309;font-size:48px;font-weight:900;letter-spacing:12px;margin:0;font-family:monospace;">${code}</p>
      <p style="color:#9caa9f;font-size:11px;margin:12px 0 0;">Valid for 10 minutes · Do not share this code</p>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #d97706;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
        <strong>⚠ Security Notice:</strong> If you did not request this withdrawal, please contact support immediately at support@tsiforafrica.com. Your funds are safe until this code is used.
      </p>
    </div>

    <p style="color:#9caa9f;font-size:13px;margin:0;text-align:center;">
      Never share this code with anyone — TSIA staff will never ask for it.
    </p>
  `);
  await sendEmail(to, subject, html);
}

// ─── Transfer OTP ─────────────────────────────────────────────────────────────

export async function sendTransferOtpEmail(
  to: string,
  firstName: string,
  code: string,
  amount: string,
  recipientName: string,
): Promise<void> {
  const subject = "Your TSIA Transfer Security Code";
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">Wallet Transfer Security Code</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 6px;line-height:1.6;">
      Hi <strong>${firstName}</strong>, you requested a wallet transfer of <strong>$${amount}</strong> to <strong>${recipientName}</strong>.
    </p>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;line-height:1.6;">
      Use the one-time code below to authorise this transfer. It expires in <strong>10 minutes</strong>.
    </p>

    <!-- OTP Box -->
    <div style="background:#f0fdf4;border:2px dashed #1a5c38;border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="color:#166534;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Transfer OTP</p>
      <p style="color:#14532d;font-size:48px;font-weight:900;letter-spacing:12px;margin:0;font-family:monospace;">${code}</p>
      <p style="color:#9caa9f;font-size:11px;margin:12px 0 0;">Valid for 10 minutes · Do not share this code</p>
    </div>

    <div style="background:#dcfce7;border-left:4px solid #16a34a;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#166534;font-size:13px;margin:0;line-height:1.5;">
        <strong>⚠ Security Notice:</strong> If you did not request this transfer, please contact support immediately at support@tsiforafrica.com.
      </p>
    </div>

    <p style="color:#9caa9f;font-size:13px;margin:0;text-align:center;">
      Never share this code with anyone — TSIA staff will never ask for it.
    </p>
  `);
  await sendEmail(to, subject, html);
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string, role: "student" | "affiliate"): Promise<void> {
  const isAffiliate = role === "affiliate";
  const subject = `Welcome to TSIA, ${firstName}! — Activate Your Wallet`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">Welcome, ${firstName}! 🌍</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 16px;line-height:1.6;">
      Your <strong>${isAffiliate ? "Affiliate" : "Student"}</strong> account is now active on the TSIA platform.
      To unlock <em>all</em> features, your first step is to activate your SwiftWallet.
    </p>

    <div style="background:#f0f8f4;border:2px solid #1a6b3c;border-radius:16px;padding:20px;margin:0 0 20px;">
      <p style="color:#1a6b3c;font-size:16px;font-weight:700;margin:0 0 6px;">⚡ Wallet Activation Required</p>
      <p style="color:#4a5e50;font-size:14px;margin:0 0 12px;line-height:1.6;">
        Deposit a minimum of <strong style="color:#1a6b3c;">$5.00 USDT</strong> (TRC20 or BEP20) to your TSIA SwiftWallet.
        Admin confirms deposits within 30 minutes. Once confirmed, <strong>75% is credited to your wallet</strong>,
        20% goes to the Strategic Reserve Fund, and 5% to the Affiliate Pool.
      </p>
      <p style="color:#c17b00;font-size:13px;background:#fff8e6;border-radius:8px;padding:10px 14px;margin:0;">
        ⚠️ <strong>Important:</strong> A minimum balance of <strong>$2.00 must always remain</strong> in your wallet to keep
        platform services — payments, transfers, and features — running seamlessly.
        You can withdraw the rest at any time.
      </p>
    </div>

    <p style="color:#4a5e50;font-size:14px;margin:0 0 12px;font-weight:600;">What you can access after activation:</p>
    <ul style="color:#4a5e50;font-size:14px;padding-left:18px;line-height:2;">
      ${isAffiliate
        ? "<li>🤝 Share your referral link and earn commissions</li><li>📈 Access the AI-powered Trade Market</li>"
        : "<li>📚 Complete your WAEC profile for sponsorship</li><li>💳 Start QCE SwiftVault to build credit eligibility</li>"}
      <li>🛒 Shop and sell on the P2P marketplace</li>
      <li>🏦 Access student/affiliate loans</li>
      <li>🔔 Real-time notifications and live support</li>
    </ul>
    ${btn("https://tsiforafrica.com/wallet", "Activate My Wallet Now")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Wallet Sent — debit receipt for the sender ──────────────────────────────

export async function sendWalletSentEmail(
  to: string,
  firstName: string,
  amount: string,
  recipientName: string,
  newBalance: string,
  txRef: string,
  txDate: string,
  note?: string,
): Promise<void> {
  const subject = `Transfer receipt — $${amount} sent to ${recipientName} | TSIA`;
  const html = baseTemplate(`
    <!-- Receipt header strip -->
    <div style="background:linear-gradient(135deg,#1a6b3c 0%,#2d9d5c 100%);border-radius:14px;padding:22px 24px;margin:0 0 24px;text-align:center;">
      <div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <span style="font-size:22px;">✅</span>
      </div>
      <p style="color:#fff;font-size:13px;font-weight:700;margin:0 0 4px;letter-spacing:1px;text-transform:uppercase;">Transfer Successful</p>
      <p style="color:rgba(255,255,255,0.85);font-size:36px;font-weight:900;margin:0;letter-spacing:-1px;">-$${amount}</p>
    </div>

    <p style="color:#4a5e50;font-size:14px;margin:0 0 20px;">Hi ${firstName}, your transfer has been processed. Here is your receipt.</p>

    <!-- Receipt body -->
    <div style="background:#f7f9f7;border:1px solid #e2ede8;border-radius:16px;overflow:hidden;margin:0 0 20px;">
      <!-- Dotted divider row helper -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background:#f0f8f4;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:45%;">Reference</td>
          <td style="padding:14px 20px;font-size:13px;color:#1a1a1a;font-weight:700;font-family:monospace;text-align:right;">${txRef}</td>
        </tr>
        <tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Date &amp; Time</td>
          <td style="padding:14px 20px;font-size:13px;color:#1a1a1a;text-align:right;">${txDate}</td>
        </tr>
        <tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Sender</td>
          <td style="padding:14px 20px;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;">${firstName} (You)</td>
        </tr>
        <tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Recipient</td>
          <td style="padding:14px 20px;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;">${recipientName}</td>
        </tr>
        <tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</td>
          <td style="padding:14px 20px;font-size:15px;color:#c0392b;font-weight:900;text-align:right;">-$${amount}</td>
        </tr>
        <tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Fee</td>
          <td style="padding:14px 20px;font-size:13px;color:#1a6b3c;font-weight:700;text-align:right;">$0.00 — Free</td>
        </tr>
        ${note ? `<tr style="border-top:1px dashed #d5e8dc;">
          <td style="padding:14px 20px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Note</td>
          <td style="padding:14px 20px;font-size:13px;color:#4a5e50;font-style:italic;text-align:right;">"${note}"</td>
        </tr>` : ""}
        <tr style="border-top:2px solid #1a6b3c;background:#f0f8f4;">
          <td style="padding:16px 20px;font-size:13px;color:#1a6b3c;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">New Balance</td>
          <td style="padding:16px 20px;font-size:17px;color:#1a1a1a;font-weight:900;text-align:right;">$${newBalance}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fff8e8;border:1px solid #f0d060;border-radius:12px;padding:14px 18px;margin:0 0 20px;font-size:12px;color:#7a6010;text-align:center;">
      <strong>TSIA Platform</strong> — Peer-to-peer transfers are instant and irreversible. If you did not authorise this, contact <a href="mailto:support@tsiforafrica.com" style="color:#1a6b3c;">support@tsiforafrica.com</a> immediately.
    </div>

    ${btn("https://tsiforafrica.com/wallet", "View My Wallet")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Wallet Received (peer-to-peer transfer) ──────────────────────────────────

export async function sendWalletReceivedEmail(
  to: string,
  firstName: string,
  amount: string,
  senderName: string,
  newBalance: string,
  note?: string,
): Promise<void> {
  const subject = `You received $${amount} from ${senderName} — TSIA`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">💸 Money Received!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, a TSIA member has sent money to your wallet.</p>

    <div style="background:#f0f8f4;border:2px solid #1a6b3c;border-radius:16px;padding:24px;margin:0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7c72;font-size:13px;padding-bottom:6px;">Amount received</td>
          <td style="color:#1a6b3c;font-size:28px;font-weight:900;text-align:right;">+$${amount}</td>
        </tr>
        <tr>
          <td style="color:#6b7c72;font-size:13px;padding-bottom:6px;">From</td>
          <td style="color:#1a1a1a;font-size:15px;font-weight:700;text-align:right;">${senderName}</td>
        </tr>
        ${note ? `<tr>
          <td style="color:#6b7c72;font-size:13px;padding-top:4px;">Note</td>
          <td style="color:#4a5e50;font-size:14px;font-style:italic;text-align:right;padding-top:4px;">"${note}"</td>
        </tr>` : ""}
        <tr>
          <td style="color:#6b7c72;font-size:13px;padding-top:10px;border-top:1px solid #e5ede8;">New balance</td>
          <td style="color:#1a1a1a;font-size:16px;font-weight:700;text-align:right;padding-top:10px;border-top:1px solid #e5ede8;">$${newBalance}</td>
        </tr>
      </table>
    </div>

    <p style="color:#9caa9f;font-size:12px;text-align:center;margin:0;">
      If you did not expect this transfer, please contact support@tsiforafrica.com.
    </p>
    ${btn("https://tsiforafrica.com/wallet", "View My Wallet")}
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

export async function sendAdminDepositConfirmedEmail(data: {
  name: string; email: string; gross: string; credited: string; reserveCut: string; affiliateCut: string; newBalance: string; walletType: string; txHash?: string; userId: number;
}): Promise<void> {
  const subject = `✅ Deposit Confirmed: $${data.gross} from ${data.name}`;
  const html = adminActionTemplate(
    "✅", "Wallet Deposit Confirmed",
    "Completed", "#27ae60",
    [
      ["User", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Gross Deposit", `$${data.gross} USD`],
      ["Credited to Wallet", `$${data.credited} USD`],
      ["Reserve Fund", `$${data.reserveCut} USD`],
      ["Affiliate Pool", `$${data.affiliateCut} USD`],
      ["New Wallet Balance", `$${data.newBalance} USD`],
      ["Payment Method", data.walletType.toUpperCase()],
      ...(data.txHash ? [["Reference / Tx Hash", data.txHash] as [string, string]] : []),
    ],
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
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

// ─── New Sale (Seller) ────────────────────────────────────────────────────────

export async function sendNewSaleEmail(to: string, firstName: string, productTitle: string, sellerReceives: string, orderId: number): Promise<void> {
  const subject = `💰 New Sale! You earned $${sellerReceives}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">🛍️ You made a sale!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, great news — someone just bought your listing.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#1a1a1a;font-weight:700;font-size:15px;margin:0 0 4px;">${productTitle}</p>
      <p style="color:#6b7c72;font-size:12px;margin:0 0 12px;">Order #${orderId}</p>
      <p style="color:#4a5e50;font-size:14px;margin:0;">You received <span style="color:#1a6b3c;font-weight:900;font-size:20px;">$${sellerReceives}</span> in your TSIA SwiftWallet (after platform commission).</p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View My Sales")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Bot Earnings ─────────────────────────────────────────────────────────────

export async function sendBotEarningsEmail(to: string, firstName: string, earning: string, newBalance: string): Promise<void> {
  const subject = `🤖 AI Bot Earnings — $${earning} credited to your Trade Wallet`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">🤖 Bot Session Complete</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your Itera Trading BOT has finished its 12-hour session.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#4a5e50;font-size:14px;padding-bottom:10px;">Earnings (2% daily return)</td>
          <td style="color:#1a6b3c;font-weight:900;font-size:20px;text-align:right;">+$${earning}</td>
        </tr>
        <tr>
          <td style="color:#4a5e50;font-size:14px;">New Trade Wallet Balance</td>
          <td style="color:#1a6b3c;font-weight:700;font-size:16px;text-align:right;">$${newBalance}</td>
        </tr>
      </table>
    </div>
    <p style="color:#6b7c72;font-size:13px;text-align:center;margin:0 0 20px;">Activate the bot again tomorrow (1:00 PM GMT) to keep compounding your returns.</p>
    ${btn("https://tsiforafrica.com/dashboard", "View Trade Wallet")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Co-Affiliate Enrollment ──────────────────────────────────────────────────

export async function sendCoAffiliateEnrollmentEmail(to: string, firstName: string, amountPaid: string, reserveCut: string): Promise<void> {
  const subject = `✅ Co-Affiliate Enrolment Confirmed — Welcome to the Programme!`;
  const html = baseTemplate(`
    <h2 style="color:#c9a227;margin:0 0 8px;font-size:22px;">🎉 You're a Co-Affiliate!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your TSIA Co-Affiliate / Initiator enrolment has been confirmed.</p>
    <div style="background:#fffbf0;border:1px solid #f0d070;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#4a5e50;font-size:14px;padding-bottom:10px;">Amount Invested</td>
          <td style="color:#c9a227;font-weight:900;font-size:18px;text-align:right;">$${amountPaid}</td>
        </tr>
        <tr>
          <td style="color:#4a5e50;font-size:14px;">Strategic Reserve (20% ring-fenced)</td>
          <td style="color:#6b7c72;font-size:14px;text-align:right;">$${reserveCut}</td>
        </tr>
      </table>
    </div>
    <p style="color:#4a5e50;font-size:14px;margin:0 0 24px;">Your portfolio share grows as the TSIA Trust Fund expands. You can track your share percentage and returns on your affiliate dashboard.</p>
    ${btn("https://tsiforafrica.com/affiliate", "View My Portfolio")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Tour / Travel Booking ────────────────────────────────────────────────────

export async function sendTourBookingEmail(to: string, firstName: string, bookingType: string, totalAmount: string, reference: string): Promise<void> {
  const typeMap: Record<string, { emoji: string; label: string }> = {
    hotel: { emoji: "🏨", label: "Hotel Booking" },
    flight: { emoji: "✈️", label: "Flight Booking" },
    car_hire: { emoji: "🚗", label: "Car Hire" },
  };
  const t = typeMap[bookingType] ?? { emoji: "🗺️", label: "Travel Booking" };
  const subject = `${t.emoji} ${t.label} Confirmed — Ref: ${reference}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">${t.emoji} Booking Confirmed!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your ${t.label.toLowerCase()} has been confirmed and payment processed.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#4a5e50;font-size:14px;padding-bottom:10px;">Booking Type</td>
          <td style="color:#1a1a1a;font-weight:700;font-size:14px;text-align:right;">${t.label}</td>
        </tr>
        <tr>
          <td style="color:#4a5e50;font-size:14px;padding-bottom:10px;">Reference</td>
          <td style="color:#1a6b3c;font-weight:700;font-size:14px;text-align:right;">${reference}</td>
        </tr>
        <tr>
          <td style="color:#4a5e50;font-size:14px;">Total Charged</td>
          <td style="color:#1a6b3c;font-weight:900;font-size:20px;text-align:right;">$${totalAmount}</td>
        </tr>
      </table>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View My Bookings")}
  `);
  await sendEmail(to, subject, html);
}

// ─── QCE SwiftVault Activated ────────────────────────────────────────────────────

export async function sendQceActivationEmail(to: string, firstName: string, amount: string): Promise<void> {
  const subject = `🏦 Your QCE SwiftVault Account is Now Active!`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">🏦 QCE SwiftVault Activated</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your Quick Credit Eligibility (QCE) savings account is now active.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#1a1a1a;font-weight:700;font-size:15px;margin:0 0 4px;">Initial Deposit</p>
      <p style="color:#1a6b3c;font-weight:900;font-size:28px;margin:0 0 16px;">$${amount}</p>
      <p style="color:#4a5e50;font-size:14px;margin:0;">Contribute daily over <strong>90 days</strong> to build up to <strong>30% credit eligibility</strong>. Your Credit Portal is now unlocked — consistent savers qualify for larger loan amounts at lower rates.</p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "Go to Credit Portal")}
  `);
  await sendEmail(to, subject, html);
}

// ─── QCE Withdrawal ───────────────────────────────────────────────────────────

export async function sendQceWithdrawalEmail(to: string, firstName: string, amount: string, newWalletBalance: string): Promise<void> {
  const subject = `💸 QCE SwiftVault Withdrawal — $${amount} returned to your Wallet`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">💸 QCE Withdrawal Processed</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, your QCE SwiftVault withdrawal has been processed.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#4a5e50;font-size:14px;padding-bottom:10px;">Amount Withdrawn</td>
          <td style="color:#1a6b3c;font-weight:900;font-size:20px;text-align:right;">$${amount}</td>
        </tr>
        <tr>
          <td style="color:#4a5e50;font-size:14px;">New SwiftWallet Balance</td>
          <td style="color:#1a6b3c;font-weight:700;font-size:16px;text-align:right;">$${newWalletBalance}</td>
        </tr>
      </table>
    </div>
    <p style="color:#e67e22;font-size:13px;text-align:center;margin:0 0 20px;">Note: Withdrawing resets your QCE progress. Re-activate your savings to rebuild your credit eligibility.</p>
    ${btn("https://tsiforafrica.com/dashboard", "View My Wallet")}
  `);
  await sendEmail(to, subject, html);
}

// ─── New Arrival Alert ────────────────────────────────────────────────────────

export async function sendNewArrivalEmail(to: string, firstName: string, category: string, productTitle: string, productId: number): Promise<void> {
  const subject = `🛍️ New Listing on TS-Mart Online Stores: "${productTitle}"`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">🛍️ New Listing — TS-Mart Online Stores</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, a new item just went live on the TS-Mart Online Stores marketplace.</p>
    <div style="background:#f0f8f4;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#6b7c72;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${category}</p>
      <p style="color:#1a1a1a;font-weight:700;font-size:16px;margin:0;">${productTitle}</p>
    </div>
    <p style="color:#4a5e50;font-size:13px;margin:0 0 24px;">Pay directly from your TSIA SwiftWallet — secure, instant, and hassle-free.</p>
    ${btn(`https://tsiforafrica.com/dashboard`, "Shop on TS-Mart")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Support Contact (admin notification + user confirmation) ─────────────────

export async function sendSupportContactToAdmin(
  adminEmail: string,
  data: { name: string; email: string; phone: string; subject: string; message: string }
): Promise<void> {
  const subjectLine = `[TSIA Support] ${data.subject} — from ${data.name}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">📩 New Support Request</h2>
    <p style="color:#4a5e50;font-size:14px;margin:0 0 20px;">A visitor submitted the contact form on tsiforafrica.com.</p>
    <div style="background:#f0f8f4;border:1px solid #d0e8d8;border-radius:16px;padding:20px 24px;margin:0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="4">
        <tr><td style="color:#6b7c72;font-size:12px;font-weight:600;width:110px;vertical-align:top;padding:6px 0;">Name</td><td style="color:#1a1a1a;font-size:14px;font-weight:700;padding:6px 0;">${data.name}</td></tr>
        <tr><td style="color:#6b7c72;font-size:12px;font-weight:600;vertical-align:top;padding:6px 0;">Email</td><td style="padding:6px 0;"><a href="mailto:${data.email}" style="color:#1a6b3c;font-size:14px;">${data.email}</a></td></tr>
        ${data.phone ? `<tr><td style="color:#6b7c72;font-size:12px;font-weight:600;vertical-align:top;padding:6px 0;">Phone</td><td style="color:#1a1a1a;font-size:14px;padding:6px 0;">${data.phone}</td></tr>` : ""}
        <tr><td style="color:#6b7c72;font-size:12px;font-weight:600;vertical-align:top;padding:6px 0;">Subject</td><td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:6px 0;">${data.subject}</td></tr>
      </table>
    </div>
    <div style="background:#ffffff;border:1px solid #e0e0e0;border-radius:12px;padding:20px 24px;margin:0 0 20px;">
      <p style="color:#6b7c72;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 10px;">Message</p>
      <p style="color:#1a1a1a;font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap;">${data.message}</p>
    </div>
    <p style="color:#9caa9f;font-size:12px;margin:0;">Reply directly to <a href="mailto:${data.email}" style="color:#1a6b3c;">${data.email}</a> to respond to this enquiry.</p>
  `);
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || FROM_EMAIL;
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:      { name: "TSIA Contact Form", email: senderEmail },
        to:          [{ email: adminEmail }],
        replyTo:     { name: data.name, email: data.email },
        subject:     subjectLine,
        htmlContent: html,
      }),
    });
    const body = await res.text();
    if (res.ok) { console.log(`[EMAIL] Support → admin ✓`); return; }
    console.error(`[EMAIL] Support admin ${res.status}: ${body}`);
  }
}

export async function sendSupportConfirmation(to: string, name: string, subject: string): Promise<void> {
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">✅ We've received your message</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 20px;">Hi ${name}, thank you for reaching out to TSIA Support.</p>
    <div style="background:#f0f8f4;border:1px solid #d0e8d8;border-radius:16px;padding:20px 24px;margin:0 0 20px;">
      <p style="color:#6b7c72;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Your enquiry</p>
      <p style="color:#1a1a1a;font-size:15px;font-weight:600;margin:0;">${subject}</p>
    </div>
    <p style="color:#4a5e50;font-size:14px;line-height:1.7;margin:0 0 20px;">Our support team reviews every message and will respond within <strong>24 hours</strong> (Monday – Friday, 9 AM – 5 PM GMT). For urgent matters, you can also reach us on WhatsApp at <strong>+447552647146</strong>.</p>
    <p style="color:#9caa9f;font-size:13px;text-align:center;margin:0;">Please do not reply to this email — it is sent from an automated address.<br/>To update your enquiry, visit <a href="https://tsiforafrica.com/contact" style="color:#1a6b3c;">tsiforafrica.com/contact</a>.</p>
  `);
  await sendEmail(to, `We received your message — TSIA Support`, html);
}

// ─── Referral Signup Notification ────────────────────────────────────────────

export async function sendReferralSignupEmail(to: string, firstName: string, referredName: string, role: string): Promise<void> {
  const subject = `👥 New Referral — ${referredName} just signed up!`;
  const html = baseTemplate(`
    <h2 style="color:#c9a227;margin:0 0 8px;font-size:22px;">👥 Referral Signup!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 24px;">Hi ${firstName}, someone just joined TSIA using your referral link.</p>
    <div style="background:#fffbf0;border:1px solid #f0d070;border-radius:16px;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#4a5e50;font-size:14px;margin:0;"><strong>${referredName}</strong> has registered as a <strong>${role}</strong> on the TSIA platform. Commissions will be credited to your wallet when they activate and transact.</p>
    </div>
    ${btn("https://tsiforafrica.com/affiliate", "View My Referrals")}
  `);
  await sendEmail(to, subject, html);
}

// ─── Admin Notification Template ──────────────────────────────────────────────

function adminActionTemplate(
  emoji: string,
  title: string,
  badgeLabel: string,
  badgeColor: string,
  rows: Array<[string, string]>,
  note?: string,
  dashboardUrl = "https://tsiforafrica.com/admin",
): string {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="color:#6b7c72;font-size:12px;font-weight:600;padding:7px 0;vertical-align:top;width:140px;">${label}</td>
      <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:7px 0;">${value}</td>
    </tr>
  `).join("");

  return baseTemplate(`
    <!-- Badge -->
    <div style="text-align:center;margin:0 0 20px;">
      <span style="display:inline-block;background:${badgeColor};color:#fff;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 16px;border-radius:50px;">${badgeLabel}</span>
    </div>

    <h2 style="color:#1a6b3c;margin:0 0 6px;font-size:21px;text-align:center;">${emoji} ${title}</h2>
    <p style="color:#9caa9f;font-size:12px;text-align:center;margin:0 0 24px;">${new Date().toUTCString()}</p>

    <div style="background:#f7f9f7;border:1px solid #d8e8dd;border-radius:16px;padding:20px 24px;margin:0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${rowsHtml}
      </table>
    </div>

    ${note ? `<div style="background:#fff8e6;border:1px solid #f0d070;border-radius:12px;padding:14px 18px;margin:0 0 20px;">
      <p style="color:#7a5c00;font-size:13px;margin:0;">⚠️ ${note}</p>
    </div>` : ""}

    ${btn(dashboardUrl, "Open Admin Dashboard")}

    <p style="color:#b5c0b8;font-size:11px;text-align:center;margin:16px 0 0;">
      This is an automated admin alert from the TSIA platform. Do not reply.
    </p>
  `);
}

// ─── Admin: New User Registered ───────────────────────────────────────────────

export async function sendAdminNewUserEmail(data: {
  name: string; email: string; role: string; country?: string; phone?: string; referredBy?: string;
}): Promise<void> {
  const subject = `🆕 New ${data.role} joined — ${data.name}`;
  const html = adminActionTemplate(
    "🆕", `New ${data.role.charAt(0).toUpperCase() + data.role.slice(1)} Registered`,
    "New User", "#3498db",
    [
      ["Full Name", data.name],
      ["Email", data.email],
      ["Role", data.role],
      ...(data.country ? [["Country", data.country] as [string, string]] : []),
      ...(data.phone ? [["Phone", data.phone] as [string, string]] : []),
      ...(data.referredBy ? [["Referred By (code)", data.referredBy] as [string, string]] : []),
    ],
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Wallet Deposit Submitted ─────────────────────────────────────────

export async function sendAdminDepositEmail(data: {
  name: string; email: string; amount: string; txHash: string; walletType: string; userId: number;
}): Promise<void> {
  const subject = `💳 ACTION REQUIRED: Deposit $${data.amount} from ${data.name}`;
  const html = adminActionTemplate(
    "💳", `Wallet Deposit Awaiting Confirmation`,
    "Action Required", "#e74c3c",
    [
      ["User", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Amount", `$${data.amount} USD`],
      ["Network", data.walletType.toUpperCase()],
      ["Tx Hash", data.txHash || "Not provided"],
    ],
    "Log in to the Admin Dashboard and confirm or decline this deposit.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Bank Withdrawal Requested ─────────────────────────────────────────

export async function sendAdminWithdrawalEmail(data: {
  name: string; email: string; amount: string; method: string; bankName?: string;
  accountNumber?: string; accountName?: string; address?: string; network?: string; userId: number;
}): Promise<void> {
  const isCrypto = data.method === "crypto";
  const subject = `🏦 ACTION REQUIRED: ${isCrypto ? "Crypto" : "Bank"} Withdrawal $${data.amount} — ${data.name}`;
  const html = adminActionTemplate(
    isCrypto ? "₿" : "🏦",
    `${isCrypto ? "Crypto" : "Bank"} Withdrawal Request`,
    "Action Required", "#e67e22",
    [
      ["User", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Amount", `$${data.amount} USD`],
      ...(isCrypto
        ? [["Network", (data.network || "").toUpperCase()], ["Wallet Address", data.address || "—"]] as [string, string][]
        : [["Bank", data.bankName || "—"], ["Account No.", data.accountNumber || "—"], ["Account Name", data.accountName || "—"]] as [string, string][]
      ),
    ],
    "Process and approve/decline this withdrawal request from the Admin Dashboard.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Verification Submitted (Academic / WAEC) ─────────────────────────

export async function sendAdminVerificationEmail(data: {
  name: string; email: string; tier?: string; payoutMin?: string; payoutMax?: string;
  waecPercentage?: string; userId: number;
}): Promise<void> {
  const subject = `📋 ACTION REQUIRED: Verification Submission — ${data.name}`;
  const html = adminActionTemplate(
    "📋", "New Student Verification to Review",
    "Pending Review", "#8e44ad",
    [
      ["Student", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ...(data.waecPercentage ? [["WAEC Score", `${data.waecPercentage}%`] as [string, string]] : []),
      ...(data.tier && data.tier !== "none" ? [["Tier", data.tier.charAt(0).toUpperCase() + data.tier.slice(1)] as [string, string]] : []),
      ...(data.payoutMin && data.payoutMax ? [["Offer Range", `$${data.payoutMin} – $${data.payoutMax}`] as [string, string]] : []),
    ],
    "Review the student's KYC, WAEC results and approve or reject their offer from the Admin Dashboard.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Portal Fee Paid (Ready for Review) ────────────────────────────────

export async function sendAdminPortalFeeEmail(data: {
  name: string; email: string; amount: string; userId: number;
}): Promise<void> {
  const subject = `✅ Portal Fee Paid — ${data.name} is ready for review`;
  const html = adminActionTemplate(
    "✅", "Student Paid Portal Fee",
    "Ready to Review", "#27ae60",
    [
      ["Student", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Fee Paid", `$${data.amount}`],
      ["Status", "KYC + WAEC submitted — awaiting offer approval"],
    ],
    "Open the Admin Dashboard → Pending Verifications to approve or reject this student's offer.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Loan Application Submitted ───────────────────────────────────────

export async function sendAdminLoanEmail(data: {
  name: string; email: string; amount: string; purpose: string; termMonths: number; role: string; userId: number;
}): Promise<void> {
  const subject = `💰 ACTION REQUIRED: Loan Application $${data.amount} — ${data.name}`;
  const html = adminActionTemplate(
    "💰", "New Loan Application",
    "Action Required", "#c0392b",
    [
      ["Applicant", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Role", data.role],
      ["Amount", `$${data.amount} USD`],
      ["Term", `${data.termMonths} months`],
      ["Purpose", data.purpose || "—"],
    ],
    "Review and approve or reject this loan from the Admin Dashboard → Loans section.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Swift-Pay Plan Payment ─────────────────────────────────────────

export async function sendAdminSponsorshipEmail(data: {
  name: string; email: string; planYears: number; totalCost: string; totalPayout: string; userId: number;
}): Promise<void> {
  const subject = `🎓 Swift-Pay Plan Payment — ${data.name} (${data.planYears}-Year)`;
  const html = adminActionTemplate(
    "🎓", `${data.planYears}-Year Swift-Pay Plan Activated`,
    "Disbursement Pending", "#1a6b3c",
    [
      ["Student", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Plan", `${data.planYears}-Year`],
      ["Amount Paid", `$${data.totalCost} (incl. service charge)`],
      ["Disbursement Due", `$${data.totalPayout}`],
    ],
    "A disbursement is now pending for this student. Approve it from Admin Dashboard → Disbursements when ready.",
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Student: Swift-Pay Plan Receipt ───────────────────────────────────────

export async function sendStudentPlanReceiptEmail(data: {
  to: string;
  firstName: string;
  planYears: number;
  totalCost: string;
  totalPayout: string;
}): Promise<void> {
  const subject = `Your TSIA Sponsorship Receipt — ${data.planYears}-Year Plan`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">🎓 Swift-Pay Plan Activated</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>, your <strong>${data.planYears}-year TSIA Swift-Pay Plan</strong> is now active.
      Here is your payment receipt for your records.
    </p>

    <!-- Receipt card -->
    <div style="background:#f0f8f4;border:1px solid #c3e0ce;border-radius:16px;padding:24px;margin:0 0 20px;">
      <p style="color:#1a6b3c;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px;">Payment Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-bottom:10px;">Plan</td>
          <td style="color:#1a1a1a;font-size:14px;font-weight:700;text-align:right;padding-bottom:10px;">${data.planYears}-Year Sponsorship</td>
        </tr>
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-bottom:10px;">Amount Paid</td>
          <td style="color:#1a6b3c;font-size:22px;font-weight:900;text-align:right;padding-bottom:10px;">$${data.totalCost}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:1px dashed #c3e0ce;padding-bottom:10px;"></td>
        </tr>
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-top:4px;">Expected Payout</td>
          <td style="color:#c9a227;font-size:18px;font-weight:900;text-align:right;padding-top:4px;">$${data.totalPayout}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fff8e1;border-left:4px solid #c9a227;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
        <strong>What happens next?</strong> The TSIA team will review your disbursement and process it shortly. You will receive a notification once it is approved.
      </p>
    </div>

    <p style="color:#6b7c72;font-size:13px;margin:0 0 4px;text-align:center;">
      Questions? Contact us at
      <a href="mailto:support@tsiforafrica.com" style="color:#1a6b3c;text-decoration:none;font-weight:600;">support@tsiforafrica.com</a>
    </p>
    ${btn("https://tsiforafrica.com/dashboard", "Go to My Dashboard")}
  `);
  await sendEmail(data.to, subject, html);
}

// ─── Disbursement outcome emails (to student) ─────────────────────────────────

export async function sendDisbursementProcessedEmail(data: {
  to: string; firstName: string; amount: string; newBalance: string;
}): Promise<void> {
  const subject = `Your TSIA Sponsorship Payout Has Been Processed — $${data.amount}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">💸 Payout Processed!</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>, great news — your sponsorship disbursement has been approved and credited to your TSIA SwiftWallet.
    </p>
    <div style="background:#f0f8f4;border:1px solid #c3e0ce;border-radius:16px;padding:24px;margin:0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-bottom:10px;">Amount Credited</td>
          <td style="color:#1a6b3c;font-size:22px;font-weight:900;text-align:right;padding-bottom:10px;">$${data.amount}</td>
        </tr>
        <tr><td colspan="2" style="border-top:1px dashed #c3e0ce;padding-bottom:10px;"></td></tr>
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-top:4px;">New Wallet Balance</td>
          <td style="color:#1a1a1a;font-size:16px;font-weight:700;text-align:right;padding-top:4px;">$${data.newBalance}</td>
        </tr>
      </table>
    </div>
    <div style="background:#fff8e1;border-left:4px solid #c9a227;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
        Funds are now available in your wallet. You can use them for platform services or request a withdrawal.
      </p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "View My Wallet")}
  `);
  await sendEmail(data.to, subject, html);
}

export async function sendDisbursementDeclinedEmail(data: {
  to: string; firstName: string; amount: string; reason?: string;
}): Promise<void> {
  const subject = `TSIA Disbursement Update — Action Required`;
  const html = baseTemplate(`
    <h2 style="color:#b91c1c;margin:0 0 8px;font-size:22px;">⚠️ Disbursement Declined</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>, your pending sponsorship disbursement of <strong>$${data.amount}</strong> has been reviewed and could not be approved at this time.
    </p>
    ${data.reason ? `
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:16px;margin:0 0 20px;">
      <p style="color:#7f1d1d;font-size:13px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
      <p style="color:#991b1b;font-size:14px;margin:0;line-height:1.6;">${data.reason}</p>
    </div>` : ""}
    <div style="background:#fff8e1;border-left:4px solid #c9a227;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
        If you believe this is an error or need clarification, please contact our support team at
        <a href="mailto:support@tsiforafrica.com" style="color:#1a6b3c;text-decoration:none;font-weight:600;">support@tsiforafrica.com</a>.
      </p>
    </div>
    ${btn("https://tsiforafrica.com/dashboard", "Go to Dashboard")}
  `);
  await sendEmail(data.to, subject, html);
}

export async function sendDisbursementEditedEmail(data: {
  to: string; firstName: string; originalAmount: string; newAmount: string; note?: string;
}): Promise<void> {
  const subject = `TSIA Disbursement Amount Adjusted — $${data.newAmount}`;
  const html = baseTemplate(`
    <h2 style="color:#1a6b3c;margin:0 0 8px;font-size:22px;">✏️ Payout Amount Adjusted</h2>
    <p style="color:#4a5e50;font-size:15px;margin:0 0 20px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>, the TSIA team has reviewed and adjusted your pending disbursement amount.
    </p>
    <div style="background:#f0f8f4;border:1px solid #c3e0ce;border-radius:16px;padding:24px;margin:0 0 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-bottom:10px;">Original Amount</td>
          <td style="color:#6b7280;font-size:16px;font-weight:700;text-align:right;padding-bottom:10px;text-decoration:line-through;">$${data.originalAmount}</td>
        </tr>
        <tr><td colspan="2" style="border-top:1px dashed #c3e0ce;padding-bottom:10px;"></td></tr>
        <tr>
          <td style="color:#6b7c72;font-size:14px;padding-top:4px;">Adjusted Amount</td>
          <td style="color:#1a6b3c;font-size:22px;font-weight:900;text-align:right;padding-top:4px;">$${data.newAmount}</td>
        </tr>
      </table>
    </div>
    ${data.note ? `
    <div style="background:#f0f8f4;border-left:4px solid #1a6b3c;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
      <p style="color:#1a5c38;font-size:13px;font-weight:700;margin:0 0 4px;">Admin Note</p>
      <p style="color:#374151;font-size:14px;margin:0;line-height:1.6;">${data.note}</p>
    </div>` : ""}
    <p style="color:#6b7c72;font-size:13px;margin:0 0 20px;line-height:1.6;">
      Your disbursement is still pending final processing. You will receive another email once the funds are transferred to your wallet.
    </p>
    ${btn("https://tsiforafrica.com/dashboard", "View My Dashboard")}
  `);
  await sendEmail(data.to, subject, html);
}

// ─── Admin: KYC / Biometric Submitted ────────────────────────────────────────

export async function sendAdminKycEmail(data: {
  name: string; email: string; kycType: string; userId: number;
}): Promise<void> {
  const subject = `🔍 KYC Submission — ${data.name} (${data.kycType})`;
  const html = adminActionTemplate(
    "🔍", `KYC Verification Submitted`,
    "KYC Submitted", "#2980b9",
    [
      ["User", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["KYC Type", data.kycType],
    ],
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: New TS-Mart Online Stores Order ─────────────────────────────────────────────

export async function sendAdminOrderEmail(data: {
  buyerName: string; sellerName: string; productTitle: string;
  totalAmount: string; commissionAmount: string; orderId: number;
}): Promise<void> {
  const subject = `🛒 New Order #${data.orderId} — $${data.totalAmount} (commission $${data.commissionAmount})`;
  const html = adminActionTemplate(
    "🛒", "New TS-Mart Online Stores Order",
    "Order Placed", "#16a085",
    [
      ["Order ID", `#${data.orderId}`],
      ["Buyer", data.buyerName],
      ["Seller", data.sellerName],
      ["Product", data.productTitle],
      ["Total", `$${data.totalAmount}`],
      ["Platform Commission (8%)", `$${data.commissionAmount}`],
    ],
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Admin: Commission Withdrawal (Affiliate / Co-Affiliate) ──────────────────

export async function sendAdminCommissionWithdrawalEmail(data: {
  name: string; email: string; amount: string; type: string; userId: number;
}): Promise<void> {
  const subject = `💸 Commission Withdrawal — ${data.name} withdrawing $${data.amount}`;
  const html = adminActionTemplate(
    "💸", `${data.type} Commission Withdrawal`,
    "Withdrawal", "#8e44ad",
    [
      ["User", `${data.name} (ID: ${data.userId})`],
      ["Email", data.email],
      ["Type", data.type],
      ["Amount", `$${data.amount}`],
    ],
  );
  await sendEmail(ADMIN_EMAIL, subject, html);
}

// ─── Generic transaction receipt email ───────────────────────────────────────

export type ReceiptEmailRow = {
  label: string;
  value: string;
  color?: "red" | "green" | "gold";
  mono?: boolean;
};

export async function sendTransactionReceiptEmail(
  to: string,
  firstName: string,
  opts: {
    title: string;
    status: "success" | "processing" | "pending";
    amount: string;
    amountLabel?: string;
    reference: string;
    rows: ReceiptEmailRow[];
    footerNote?: string;
  },
): Promise<void> {
  const statusConfig = {
    success:    { color: "#1a6b3c", bg: "#f0f8f4", border: "#1a6b3c", label: "&#x2705; Successful" },
    processing: { color: "#1e40af", bg: "#eff6ff", border: "#3b82f6", label: "&#x23F3; Processing" },
    pending:    { color: "#b45309", bg: "#fffbeb", border: "#d97706", label: "&#x1F504; Pending" },
  }[opts.status];

  const rowsHtml = opts.rows.map((row, i) => {
    const valColor  = row.color === "red" ? "#c0392b" : row.color === "green" ? "#1a6b3c" : row.color === "gold" ? "#c9a227" : "#1a1a1a";
    const valWeight = row.color || row.mono ? "700" : "500";
    const valFamily = row.mono ? "font-family:monospace;" : "";
    return `<tr style="${i > 0 ? "border-top:1px dashed #d5e8dc;" : ""}">
      <td style="padding:11px 18px;font-size:12px;color:#6b7c72;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:45%;">${row.label}</td>
      <td style="padding:11px 18px;font-size:13px;color:${valColor};font-weight:${valWeight};${valFamily}text-align:right;">${row.value}</td>
    </tr>`;
  }).join("\n");

  const subject = `${opts.title} — TSIA Receipt`;
  const html = baseTemplate(`
    <div style="background:linear-gradient(135deg,#1a6b3c 0%,#2d9d5c 100%);border-radius:16px;padding:28px 24px;margin:0 0 20px;text-align:center;">
      <span style="display:inline-block;background:${statusConfig.bg};color:${statusConfig.color};border:1px solid ${statusConfig.border};font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:10px;">${statusConfig.label}</span>
      <p style="color:rgba(255,255,255,0.65);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">${opts.title}</p>
      <p style="color:#fff;font-size:38px;font-weight:900;margin:0;letter-spacing:-1px;">${opts.amount}</p>
      ${opts.amountLabel ? `<p style="color:rgba(255,255,255,0.55);font-size:11px;margin:4px 0 0;">${opts.amountLabel}</p>` : ""}
    </div>
    <p style="color:#4a5e50;font-size:14px;margin:0 0 16px;line-height:1.6;">Hi <strong>${firstName}</strong>, your transaction has been recorded. Here is your receipt from TSIA Swift Wallet.</p>

    <div style="background:#f7f9f7;border:1px solid #e2ede8;border-radius:14px;overflow:hidden;margin:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${rowsHtml}
      </table>
    </div>

    <div style="background:#f0f8f4;border-radius:10px;padding:12px 16px;margin:0 0 16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#4a5e50;">Reference: <strong style="font-family:monospace;color:#1a6b3c;letter-spacing:0.5px;">${opts.reference}</strong></p>
    </div>
    ${opts.footerNote ? `<p style="font-size:11px;color:#9caa9f;text-align:center;margin:0 0 8px;">${opts.footerNote}</p>` : ""}
    <p style="font-size:11px;color:#9caa9f;text-align:center;margin:0 0 16px;">Keep this receipt for your records. Disputes: <a href="mailto:support@tsiforafrica.com" style="color:#1a6b3c;">support@tsiforafrica.com</a></p>
    ${btn("https://tsiforafrica.com/wallet", "View My Wallet")}
  `);

  await sendEmail(to, subject, html);
}
