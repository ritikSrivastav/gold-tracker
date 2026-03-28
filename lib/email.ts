// lib/email.ts
// Sends price alerts via Resend (https://resend.com)
// Free tier: 3,000 emails/month, 100/day. No credit card needed.

import { Resend } from 'resend'



interface AlertEmailParams {
  to: string
  city: string
  currentPrice: number
  targetPrice: number
  direction: 'above' | 'below'
}

export async function sendAlertEmail(params: AlertEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)  // ← add here
  const { to, city, currentPrice, targetPrice, direction } = params
  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

  const subject = `Gold Alert: ${city} is now ${fmt(currentPrice)}/g`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#92400e;margin-top:0;">Gold Price Alert Triggered</h2>
      <p>Your alert for <strong>${city}</strong> has been triggered.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px;color:#6b7280;font-size:14px;">Current price (24K)</td>
          <td style="padding:8px;font-weight:600;font-size:18px;color:#111;">${fmt(currentPrice)}/g</td>
        </tr>
        <tr>
          <td style="padding:8px;color:#6b7280;font-size:14px;">Your target</td>
          <td style="padding:8px;color:#6b7280;">${direction} ${fmt(targetPrice)}/g</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin-bottom:0;">
        Rates are indicative and sourced from Goodreturns/IBJA. Excludes GST &amp; making charges.
      </p>
    </div>
  `

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'alerts@yourdomain.com',
    to,
    subject,
    html,
  })
}
