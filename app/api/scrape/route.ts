// app/api/scrape/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Vercel cron endpoint — runs every 4 hours (see vercel.json).
// Scrapes Goodreturns for all 6 cities, writes to KV, then fires any pending alerts.
// Protected by CRON_SECRET so only Vercel cron (or you) can trigger it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { scrapeAllCities } from '@/lib/scraper'
import { sendAlertEmail } from '@/lib/email'
import { sendAlertSMS } from '@/lib/sms'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Auth check — Vercel passes this header automatically for cron jobs
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[scrape] Starting scrape at', new Date().toISOString())

    // 1. Scrape all cities
    const fresh = await scrapeAllCities()

    // 2. Merge with previously cached data (partial scrape failure = keep old values)
    const prev = await kv.get<typeof fresh>('gold:rates')
    const merged = { ...prev, ...fresh, fetchedAt: fresh.fetchedAt }

    // 3. Save to KV
    await kv.set('gold:rates', merged, { ex: 60 * 60 * 5 }) // TTL: 5 hours safety net

    console.log('[scrape] Saved rates to KV:', merged.hyderabad?.rate24k)

    // 4. Check and fire pending alerts
    const alerts: Alert[] = (await kv.get('gold:alerts')) ?? []
    const unfired = alerts.filter(a => !a.fired)

    for (const alert of unfired) {
      const cityData = merged[alert.city as keyof typeof merged] as { rate24k: number } | undefined
      if (!cityData) continue

      const price = cityData.rate24k
      const triggered =
        alert.direction === 'above' ? price >= alert.target : price <= alert.target

      if (triggered) {
        alert.fired = true
        alert.firedAt = new Date().toISOString()

        // Send email
        if (alert.email) {
          try {
            await sendAlertEmail({
              to: alert.email,
              city: alert.city,
              currentPrice: price,
              targetPrice: alert.target,
              direction: alert.direction,
            })
            console.log(`[scrape] Email sent to ${alert.email} for ${alert.city}`)
          } catch (e) {
            console.error('[scrape] Email send failed:', e)
          }
        }

        // Send SMS — max once per 24 hours to preserve credits
        if (alert.phone) {
          const now = Date.now()
          const lastSent = alert.lastSmsSentAt ? new Date(alert.lastSmsSentAt).getTime() : 0
          const hoursSinceLast = (now - lastSent) / 1000 / 60 / 60

          if (hoursSinceLast >= 24) {
            try {
              await sendAlertSMS({
                phone: alert.phone,
                city: alert.city,
                currentPrice: price,
                targetPrice: alert.target,
                direction: alert.direction,
              })
              alert.lastSmsSentAt = new Date().toISOString()
              console.log(`[scrape] SMS sent to ${alert.phone} for ${alert.city}`)
            } catch (e) {
              console.error('[scrape] SMS send failed:', e)
            }
          } else {
            console.log(`[scrape] SMS skipped for ${alert.phone} — sent ${Math.round(hoursSinceLast)}h ago (24h limit)`)
          }
        }
      }
    }

    // Save updated alert states
    await kv.set('gold:alerts', alerts, { ex: 60 * 60 * 24 * 30 }) // keep 30 days

    return NextResponse.json({
      success: true,
      fetchedAt: fresh.fetchedAt,
      hyd24k: merged.hyderabad?.rate24k,
      alertsFired: unfired.filter(a => a.fired).length,
    })
  } catch (err) {
    console.error('[scrape] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

interface Alert {
  id: string
  city: string
  target: number
  direction: 'above' | 'below'
  email?: string
  phone?: string
  fired: boolean
  firedAt?: string
  lastSmsSentAt?: string   // throttle: SMS sent at most once per 24 hours
  createdAt: string
}
