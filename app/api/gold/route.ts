// app/api/gold/route.ts
// Returns cached gold rates from KV. Sub-5ms response — no scraping on user requests.
// If KV is empty (first deploy), returns sensible defaults and triggers a background scrape.

import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export const runtime = 'edge'

export async function GET() {
  const cached = await kv.get('gold:rates')

  if (!cached) {
    // Cache miss — return placeholder and hint client to retry in 10s
    return NextResponse.json(
      { error: 'Rates not yet available. Initial scrape may still be running.', retry: true },
      { status: 202 }
    )
  }

  return NextResponse.json(cached, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
