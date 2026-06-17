import { supabaseAdmin } from '@/lib/supabaseAdmin'

function getTodayYYMMDD(): string {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

export async function nextQuoteNumber(offset: number = 0): Promise<string> {
  const dateStr = getTodayYYMMDD()
  const prefix = `Q-${dateStr}-`

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select('quote_number')
    .ilike('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })

  let seq = 1
  if (data && data.length > 0) {
    let maxSeq = 0
    for (const row of data) {
      if (!row.quote_number) continue
      // Expected format: Q-YYMMDD-NNN or Q-YYMMDD-NNN-vX
      const parts = row.quote_number.split('-')
      if (parts.length >= 3) {
        const nnn = parseInt(parts[2], 10)
        if (!isNaN(nnn) && nnn > maxSeq) {
          maxSeq = nnn
        }
      }
    }
    seq = maxSeq + 1
  }

  seq += offset

  return `${prefix}${String(seq).padStart(3, '0')}`
}
