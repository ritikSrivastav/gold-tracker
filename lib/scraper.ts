export interface GoldRates {
  hyderabad:  CityRates
  mumbai:     CityRates
  delhi:      CityRates
  bangalore:  CityRates
  chennai:    CityRates
  kolkata:    CityRates
  fetchedAt:  string
  xauUsd:     number
  usdInr:     number
}

export interface CityRates {
  city:    string
  rate24k: number
  rate22k: number
  change:  number
}

const CITY_PREMIUM: Record<string, number> = {
  hyderabad:  0.0000,
  mumbai:     0.0000,
  delhi:      0.0012,
  bangalore:  0.0031,
  chennai:    0.0048,
  kolkata:    0.0039,
}

const INDIA_DUTY = 1.128

export async function scrapeAllCities(): Promise<GoldRates> {
  const [spotRes, fxRes] = await Promise.all([
    fetch('https://metals.live/api/spot', { next: { revalidate: 0 } }),
    fetch('https://api.frankfurter.app/latest?from=USD&to=INR', { next: { revalidate: 0 } }),
  ])

  if (!spotRes.ok) throw new Error(`metals.live failed: ${spotRes.status}`)
  if (!fxRes.ok)   throw new Error(`frankfurter failed: ${fxRes.status}`)

  const spotData = await spotRes.json()
  const fxData   = await fxRes.json()

  const xauEntry = Array.isArray(spotData)
    ? spotData.find((x: { symbol: string }) => x.symbol === 'XAU')
    : null
  const xauUsd: number = xauEntry?.price ?? 0
  if (!xauUsd) throw new Error('XAU price missing from metals.live response')

  const usdInr: number = fxData?.rates?.INR ?? 84.5

  const base24k = Math.round((xauUsd / 31.1035) * usdInr * INDIA_DUTY)
  const base22k = Math.round(base24k * 0.9167)

  const cities = Object.keys(CITY_PREMIUM)
  const rates: Partial<GoldRates> = { fetchedAt: new Date().toISOString(), xauUsd, usdInr }

  for (const city of cities) {
    const prem = CITY_PREMIUM[city]
    rates[city as keyof Omit<GoldRates, 'fetchedAt' | 'xauUsd' | 'usdInr'>] = {
      city,
      rate24k: Math.round(base24k * (1 + prem)),
      rate22k: Math.round(base22k * (1 + prem)),
      change: 0,
    }
  }

  return rates as GoldRates
}
