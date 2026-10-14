import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function emailConfigured() {
  if (process.env.NODE_ENV === 'test' && process.env.EMAIL_TRANSPORT === 'test') return true;
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.APP_URL);
}

export function appUrl() {
  const raw = process.env.APP_URL;
  if (!raw) throw new Error('APP_URL is not configured.');
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new Error('APP_URL must be the public HTTPS website origin.');
  }
  return url.origin;
}

export async function sendAccountEmail({ to, kind, token, dataDir }) {
  if (!emailConfigured()) throw new Error('Email delivery is not configured. Please contact the site administrator.');
  const verify = kind === 'verify';
  const url = `${appUrl()}/${verify ? 'verify-email' : 'reset-password'}#token=${token}`;
  const subject = verify ? 'Verify your Digital Dukan email' : 'Reset your Digital Dukan password';
  const text = `${verify ? 'Confirm your email address' : 'Choose a new password'} for Digital Dukan:\n\n${url}\n\nThis link expires in ${verify ? '24 hours' : '30 minutes'} and can be used once. If you did not request this, ignore this email. Never share this link.`;
  if (process.env.NODE_ENV === 'test' && process.env.EMAIL_TRANSPORT === 'test') {
    const outbox = join(dataDir, 'test-outbox');
    mkdirSync(outbox, { recursive: true, mode: 0o700 });
    writeFileSync(join(outbox, `${Date.now()}-${randomBytes(8).toString('hex')}.json`),
      JSON.stringify({ to, kind, subject, text, url }), { mode: 0o600 });
    return;
  }
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error('Email delivery is temporarily unavailable. Please try again shortly.');
  }
  if (!response.ok) {
    let details;try { details=await response.json(); } catch { details={}; }
    const message=typeof details?.message==='string'?details.message:'';
    // Classify provider diagnostics, but never forward raw messages or request data.
    if(/only send testing emails|testing emails.*(?:your own|account).*email/i.test(message))
      throw new Error('Resend testing emails can only go to your Resend account email. To verify a different store-owner email, verify your sender domain in Resend and update MAIL_FROM.');
    if(/domain.*not verified|domain.*is not.*verified|verify.*(?:your|a) domain/i.test(message))
      throw new Error('Your email sender domain is not verified in Resend. Verify the domain and use its sender address in MAIL_FROM.');
    if(response.status===401||/invalid.*api.?key|api.?key.*invalid/i.test(message))
      throw new Error('Resend did not accept the API key. Check RESEND_API_KEY in Railway and deploy the saved variables.');
    if(response.status===429)
      throw new Error('Resend email sending limit reached. Check your Resend usage and try again after its limit resets.');
    throw new Error('Resend rejected this email (HTTP '+response.status+'). Check API key sending access, MAIL_FROM, and recipient eligibility.');
  }
}
