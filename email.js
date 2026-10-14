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
  if (!response.ok) throw new Error('The email provider could not accept this email. Ask the administrator to check the sender and email service settings.');
}
