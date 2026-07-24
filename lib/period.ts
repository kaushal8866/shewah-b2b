/**
 * Period boundaries for a business operating in India.
 *
 * The app mixed three conventions: bare `date` columns compared as strings,
 * `timestamptz` columns filtered with a literal `Z` suffix, and
 * `new Date().toLocaleDateString('en-CA')` evaluated on a server running in
 * UTC. On Vercel that last one means "today" is wrong for the first 5½ hours
 * of every IST day — long enough for a morning P&L to be rejected as a future
 * date, and for a night's reseller orders to land in the wrong month.
 */

export const IST_OFFSET = '+05:30'
export const IST_TIMEZONE = 'Asia/Kolkata'

/** Today's date in IST as YYYY-MM-DD, regardless of server timezone. */
export function istToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; the timeZone option is what makes this correct.
  return now.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE })
}

/** Start of an IST calendar day, as an offset-aware ISO string for timestamptz. */
export function istDayStart(date: string): string {
  return `${date}T00:00:00${IST_OFFSET}`
}

/** End of an IST calendar day, inclusive to the last microsecond. */
export function istDayEnd(date: string): string {
  return `${date}T23:59:59.999${IST_OFFSET}`
}

/** First day of the IST month containing `date` (defaults to today). */
export function istMonthStart(date: string = istToday()): string {
  return date.substring(0, 8) + '01'
}
