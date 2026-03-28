'use client'
// AlertForm.tsx — handles alert submission on the client.
// Submits to /api/alert which saves to Vercel KV.
// Alert fires on the next 4-hourly cron run via email and/or SMS.

import { useState } from 'react'

export default function AlertForm({ cities }: { cities: string[] }) {
  const [city, setCity] = useState('hyderabad')
  const [direction, setDirection] = useState<'above' | 'below'>('below')
  const [target, setTarget] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit() {
    if (!target || (!email && !phone)) {
      setMsg('Enter a target price and at least one of email or phone.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          direction,
          target: parseFloat(target),
          email: email || undefined,
          phone: phone || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setStatus('success')
      setMsg(`Alert set! You'll be notified when ${city} 24K goes ${direction} ₹${parseFloat(target).toLocaleString('en-IN')}/g.`)
    } catch (e: unknown) {
      setStatus('error')
      setMsg(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
      <p className="text-sm text-stone-500">
        Alerts are checked every 4 hours when rates are refreshed. You&apos;ll get an email and/or SMS when your target is hit.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* City */}
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-stone-500 mb-1 block">City</label>
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {cities.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div>
          <label className="text-xs text-stone-500 mb-1 block">When</label>
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as 'above' | 'below')}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="below">drops below</option>
            <option value="above">rises above</option>
          </select>
        </div>

        {/* Target */}
        <div className="col-span-2">
          <label className="text-xs text-stone-500 mb-1 block">Target price (₹/g, 24K)</label>
          <input
            type="number"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="e.g. 14500"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Notification channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Email (via Resend — free)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Mobile (via Fast2SMS — free credits)</label>
          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
            <span className="px-3 py-2 text-sm bg-stone-50 text-stone-500 border-r border-stone-200">+91</span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
            />
          </div>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={status === 'loading' || status === 'success'}
        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
      >
        {status === 'loading' ? 'Setting alert…' : status === 'success' ? 'Alert set ✓' : 'Set alert'}
      </button>

      {msg && (
        <p className={`text-sm ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>
      )}
    </div>
  )
}
