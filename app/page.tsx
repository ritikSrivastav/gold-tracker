// app/page.tsx
// Server component — fetches gold rates from KV at request time (ISR, 5-min revalidation).
// Client component handles the alert form submission.

import { kv } from '@vercel/kv'
import AlertForm from './components/AlertForm'

const CITIES = ['hyderabad', 'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata'] as const
type City = typeof CITIES[number]

interface CityRates {
  city: string
  rate24k: number
  rate22k: number
  change: number
}

interface GoldRates {
  [key: string]: CityRates | string
  fetchedAt: string
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000 / 60
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)}m ago`
  return `${Math.round(diff / 60)}h ago`
}

export const revalidate = 300 // revalidate every 5 minutes

export default async function Home() {
  const rates = await kv.get<GoldRates>('gold:rates')

  const hyderabad = rates?.hyderabad as CityRates | undefined

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">Gold Rate India</h1>
            <p className="text-xs text-stone-500">24K · IBJA / Goodreturns · excl. GST</p>
          </div>
          {rates?.fetchedAt && (
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="live-dot w-2 h-2 rounded-full bg-green-500 inline-block" />
              Updated {timeAgo(rates.fetchedAt as string)}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Hero price — Hyderabad */}
        <div className="text-center fade-in">
          <p className="text-sm text-stone-500 mb-1">Hyderabad · 24K gold</p>
          <div className="text-6xl font-semibold tracking-tight text-stone-900">
            {hyderabad ? fmt(hyderabad.rate24k) : '—'}
          </div>
          <p className="text-sm text-stone-500 mt-1">per gram</p>
          {hyderabad?.change ? (
            <p className={`text-sm mt-2 font-medium ${hyderabad.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hyderabad.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(hyderabad.change))} today
            </p>
          ) : null}
        </div>

        {/* City grid */}
        <section>
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-3">Price by city · 24K</h2>
          {!rates ? (
            <p className="text-stone-500 text-sm">Rates loading — check back in a moment.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CITIES.map(city => {
                const d = rates[city] as CityRates | undefined
                const isBase = city === 'hyderabad'
                return (
                  <div
                    key={city}
                    className={`bg-white rounded-xl border px-4 py-4 fade-in ${
                      isBase ? 'border-amber-400' : 'border-stone-200'
                    }`}
                  >
                    <p className="text-xs text-stone-500 capitalize mb-1">
                      {city}{isBase ? ' · base' : ''}
                    </p>
                    <p className="text-xl font-semibold text-stone-900 tabular-nums">
                      {d ? fmt(d.rate24k) : '—'}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {d ? fmt(d.rate22k) : '—'} <span className="text-stone-300">22K</span>
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Alert form — client component */}
        <section>
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-3">Price alert</h2>
          <AlertForm cities={CITIES as unknown as string[]} />
        </section>

        {/* Info */}
        <footer className="text-xs text-stone-400 border-t border-stone-200 pt-4 space-y-1">
          <p>Rates sourced from Goodreturns / IBJA. Updated every 4 hours.</p>
          <p>Indicative only. Excludes 3% GST, making charges, and local levies.</p>
          <p>Alerts checked at each scrape (every 4 hours). For faster alerts, check with your jeweller.</p>
        </footer>
      </div>
    </main>
  )
}
