// app/api/alert/route.ts
// POST: saves a new price alert (email + optional SMS) to KV.
// Alerts are evaluated every time the cron scrape runs (every 4 hours).

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

interface AlertPayload {
  city: string
  target: number
  direction: 'above' | 'below'
  email?: string
  phone?: string   // 10-digit Indian number
}

export async function POST(req: NextRequest) {
  const body: AlertPayload = await req.json()
  const { city, target, direction, email, phone } = body

  if (!city || !target || !direction || (!email && !phone)) {
    return NextResponse.json(
      { error: 'city, target, direction, and at least one of email/phone are required' },
      { status: 400 }
    )
  }

  if (target < 1000 || target > 200000) {
    return NextResponse.json({ error: 'Target price out of reasonable range' }, { status: 400 })
  }

  const alerts: Alert[] = (await kv.get('gold:alerts')) ?? []

  const newAlert: Alert = {
    id: randomUUID(),
    city,
    target,
    direction,
    email,
    phone,
    fired: false,
    createdAt: new Date().toISOString(),
  }

  alerts.push(newAlert)
  await kv.set('gold:alerts', alerts, { ex: 60 * 60 * 24 * 30 })

  return NextResponse.json({ success: true, alertId: newAlert.id })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const alerts: Alert[] = (await kv.get('gold:alerts')) ?? []
  const filtered = alerts.filter(a => a.id !== id)
  await kv.set('gold:alerts', filtered, { ex: 60 * 60 * 24 * 30 })

  return NextResponse.json({ success: true })
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
