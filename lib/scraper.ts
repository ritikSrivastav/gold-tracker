// lib/scraper.ts
// Scrapes Goodreturns.in for Indian gold rates (IBJA-aligned).
// Called by /api/scrape which runs every 4 hours via Vercel cron.

import * as cheerio from 'cheerio'

export interface GoldRates {
  hyderabad: CityRates
  mumbai: CityRates
  delhi: CityRates
  bangalore: CityRates
  chennai: CityRates
  kolkata: CityRates
  fetchedAt: string   // ISO timestamp
}

export interface CityRates {
  city: string
  rate24k: number    // ₹ per gram, excl. GST
  rate22k: number
  change: number     // day-over-day change in ₹
}

const CITY_URLS: Record<string, string> = {
  hyderabad: 'https://www.goodreturns.in/gold-rates/hyderabad.html',
  mumbai:    'https://www.goodreturns.in/gold-rates/mumbai.html',
  delhi:     'https://www.goodreturns.in/gold-rates/delhi.html',
  bangalore: 'https://www.goodreturns.in/gold-rates/bangalore.html',
  chennai:   'https://www.goodreturns.in/gold-rates/chennai.html',
  kolkata:   'https://www.goodreturns.in/gold-rates/kolkata.html',
}

// Browser-like headers to avoid 403
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.goodreturns.in/',
  'Cache-Control': 'no-cache',
}

async function scrapeCityRates(city: string, url: string): Promise<CityRates> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Failed to fetch ${city}: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Goodreturns layout: gold rate cards show "24K Gold /g · ₹XX,XXX · + ₹XXX"
  // Selectors target the rate table / card present on their city pages
  let rate24k = 0, rate22k = 0, change = 0

  // Primary selectors — adjust if Goodreturns updates their HTML
  $('table tr, .gold-rate-table tr').each((_, row) => {
    const text = $(row).text()
    if (text.includes('24K') || text.includes('24 Karat')) {
      const nums = text.match(/[\d,]+/g)?.map(n => parseInt(n.replace(/,/g, ''))) ?? []
      if (nums.length >= 1) rate24k = nums[0]
      if (nums.length >= 3) change = nums[2]
    }
    if (text.includes('22K') || text.includes('22 Karat')) {
      const nums = text.match(/[\d,]+/g)?.map(n => parseInt(n.replace(/,/g, ''))) ?? []
      if (nums.length >= 1) rate22k = nums[0]
    }
  })

  // Fallback: scan all text nodes for the price pattern
  if (!rate24k) {
    const bodyText = $('body').text()
    const m24 = bodyText.match(/24[Kk][^₹]*₹\s*([\d,]+)/)
    const m22 = bodyText.match(/22[Kk][^₹]*₹\s*([\d,]+)/)
    if (m24) rate24k = parseInt(m24[1].replace(/,/g, ''))
    if (m22) rate22k = parseInt(m22[1].replace(/,/g, ''))
  }

  return { city, rate24k, rate22k, change }
}

export async function scrapeAllCities(): Promise<GoldRates> {
  const results = await Promise.allSettled(
    Object.entries(CITY_URLS).map(([city, url]) => scrapeCityRates(city, url))
  )

  const rates: Partial<GoldRates> = { fetchedAt: new Date().toISOString() }

  results.forEach((r, i) => {
    const city = Object.keys(CITY_URLS)[i] as keyof Omit<GoldRates, 'fetchedAt'>
    if (r.status === 'fulfilled') {
      rates[city] = r.value
    } else {
      console.error(`Scrape failed for ${city}:`, r.reason)
      // Fall back to last known value — KV handles this in the API route
    }
  })

  return rates as GoldRates
}
