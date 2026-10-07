import { useState } from 'react'
import Modal from './Modal'
import { fetchAll, logAction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { parseCSV, normalizeDate } from '../lib/utils'
import { useAuth } from '../lib/auth'

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const guess = (h, fields) => {
  const n = norm(h)
  return fields.find((f) => [f.key, f.label.replace(' *', '')].map(norm).some((x) => x && (x === n || x.includes(n) || n.includes(x))))?.key || ''
}

export default function ImportModal({ table, fields, section, onClose, onDone }) {
  const { user } = useAuth()
  const [csv, setCsv] = useState(null)
  const [map, setMap] = useState([])
  const [busy, setBusy] = useState(false)
  const importable = fields.filter((f) => !['files', 'image'].includes(f.type))

  function onFile(e) {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const rows = parseCSV(r.result)
      if (rows.length < 2) return alert('No data rows found in this CSV.')
      const data = rows.slice(1).filter((x) => x.some((c) => c && c.trim()))
      setCsv({ headers: rows[0], data })
      setMap(rows[0].map((h) => guess(h, importable)))
    }
    r.readAsText(f)
  }

  async function run() {
    setBusy(true)
    try {
      const people = fields.some((f) => f.type === 'personnelMulti') ? await fetchAll('personnel') : []
      const recs = csv.data.map((row) => {
        const o = { added_by_name: user.name }
        map.forEach((key, i) => {
          if (!key) return
          const raw = (row[i] || '').trim()
          const f = importable.find((x) => x.key === key)
          if (f.type === 'personnelMulti') {
            const names = raw.split(/[;,]|\band\b/i).map((s) => s.trim().toLowerCase()).filter(Boolean)
            o[key] = people.filter((p) => names.includes((p.name || '').toLowerCase())).map((p) => p.id)
          } else if (f.type === 'date') o[key] = normalizeDate(raw)
          else if (f.type === 'time') o[key] = raw || null
          else if (f.type === 'number') o[key] = raw === '' || isNaN(Number(raw)) ? null : Number(raw)
          else if (f.type === 'stringList') o[key] = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
          else o[key] = raw
        })
        return o
      })
      const { error } = await supabase.from(table).insert(recs)
      if (error) throw error
      await logAction(user, 'Import', section, `Imported ${recs.length} record(s) from CSV`)
      onDone(recs.length)
    } catch (e) { alert(e.message); setBusy(false) }
  }

  return (
    <Modal title={`IMPORT RECORDS — ${section.toUpperCase()}`} onClose={onClose}>
      <div className="note">Export your Excel workbook or Google Sheet as <b>CSV</b> first, then choose it below and map its columns. Dates may be YYYY-MM-DD or MM/DD/YYYY.</div>
      <div className="field full"><label>Choose CSV file</label><input type="file" accept=".csv,text/csv" onChange={onFile} /></div>
      {csv && (
        <>
          <h3>Map columns ({csv.data.length} data rows found)</h3>
          <div className="tablewrap" style={{ maxHeight: 280 }}>
            <table><thead><tr><th>CSV Column</th><th>Maps To</th><th>Sample</th></tr></thead><tbody>
              {csv.headers.map((h, i) => (
                <tr key={i}><td>{h}</td>
                  <td><select value={map[i]} onChange={(e) => setMap(map.map((m, j) => (j === i ? e.target.value : m)))}>
                    <option value="">-- Skip --</option>{importable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select></td>
                  <td className="small">{csv.data[0][i]}</td></tr>
              ))}
            </tbody></table>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={run}>{busy ? 'Importing…' : `Import ${csv.data.length} Record(s)`}</button>{' '}
            <button className="btn secondary" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  )
}
