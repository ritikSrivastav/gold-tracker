// lib/sms.ts
// Sends SMS via Fast2SMS (https://fast2sms.com) — Indian numbers only.
// Free credits on signup (~₹50 worth). Top up at ₹200/1000 SMS.
// Sign up at fast2sms.com → Dashboard → Dev API → copy API key.

interface SMSParams {
  phone: string       // 10-digit Indian mobile number
  city: string
  currentPrice: number
  targetPrice: number
  direction: 'above' | 'below'
}

export async function sendAlertSMS(params: SMSParams) {
  const { phone, city, currentPrice, targetPrice, direction } = params
  const fmt = (n: number) => 'Rs.' + n.toLocaleString('en-IN')

  const message =
    `Gold Alert: ${city} 24K is now ${fmt(currentPrice)}/g — ` +
    `${direction} your target of ${fmt(targetPrice)}/g. (Goodreturns/IBJA, excl. GST)`

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: process.env.FAST2SMS_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',           // transactional route (DLT registered)
      numbers: phone,
      message,
      language: 'english',
      flash: 0,
    }),
  })

  const data = await res.json()
  if (!data.return) {
    throw new Error(`Fast2SMS error: ${JSON.stringify(data)}`)
  }
  return data
}
