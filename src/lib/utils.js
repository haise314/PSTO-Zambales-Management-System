export const pad = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x }
export const fmtShort = (d) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const unique = (a) => [...new Set(a.filter(Boolean))].sort()

export function fmtDate(s) {
  if (!s) return ''
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : String(s)
}
export function dateRangeText(a, b) {
  if (!a && !b) return '—'
  return a && b && a !== b ? `${fmtDate(a)} → ${fmtDate(b)}` : fmtDate(a || b)
}
export function daysSince(s) {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d)) return null
  return Math.floor((new Date().setHours(0, 0, 0, 0) - d.getTime()) / 86400000)
}
export const peso = (n) => '₱' + (Number(n) || 0).toLocaleString()

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 500)
}

export function parseCSV(text) {
  const rows = []; let row = []; let f = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (c !== '\r') f += c
  }
  if (f.length || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

// accepts ISO or mm/dd/yyyy (as exported from Excel / Sheets)
export function normalizeDate(s) {
  const t = String(s || '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`
  const d = new Date(t)
  return isNaN(d) ? null : iso(d)
}
