import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import RecordForm from '../components/RecordForm'
import { SignedImg } from '../components/FileViews'
import { useAuth } from '../lib/auth'
import { fetchAll, saveRow, deleteRow, logAction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { removeFiles } from '../lib/files'
import { fmtDate, today, daysSince } from '../lib/utils'
import { eventColor } from './Calendar'

const SEARCH = [
  ['Personnel', 'personnel', 'personnel', (r) => `${r.name} ${r.position} ${r.department}`, (r) => r.name],
  ['Contacts', 'contacts', 'contacts', (r) => `${r.name} ${r.designation} ${r.department} ${r.municipality}`, (r) => r.name],
  ['Memo', 'memos', 'memos', (r) => `${r.memo_number} ${r.subject} ${r.program} ${r.remarks}`, (r) => r.subject || r.memo_number],
  ['Documentations', 'documentation', 'documentation', (r) => `${r.reference_no} ${r.title} ${r.from_to} ${r.doc_type} ${r.action}`, (r) => r.title],
  ['Calendar', 'calendar_events', 'calendar', (r) => `${r.title} ${r.venue} ${r.category} ${r.remarks}`, (r) => r.title],
  ['Training', 'trainings', 'trainings', (r) => `${r.title} ${r.conducted_by} ${r.funding}`, (r) => r.title],
]

function QRForm({ row, onClose, onSaved }) {
  const { user } = useAuth()
  async function save(out) {
    if (!out.label.trim()) throw new Error('Please enter a QR Code label.')
    if (!out.real_image && !out.real_link && !out.decoy_image && !out.decoy_link) throw new Error('Please upload or encode at least one QR Code.')
    const s = await saveRow('qr_codes', out, row?.id)
    await logAction(user, row ? 'Edit' : 'Add', 'qrcodes', `${row ? 'Edited' : 'Added'} QR Code ${out.label}`)
    onSaved()
  }
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} QR Code`} onClose={onClose}>
      <RecordForm initial={row || {}} onSubmit={save} onCancel={onClose} submitLabel="Save QR Code" fields={[
        { key: 'label', label: 'Label / Name of QR Code *', required: true },
        { key: 'real_image', label: 'Upload Real QR Code', type: 'image', folder: 'qr-real', hint: 'Shown to Staff and Administrators.' },
        { key: 'real_link', label: 'Encode Link for the Real QR Code', type: 'url' },
        { key: 'decoy_image', label: 'Upload Decoy QR Code', type: 'image', folder: 'qr-decoy', hint: 'Shown to Guests only.' },
        { key: 'decoy_link', label: 'Link for the Decoy QR Code', type: 'url' }]} />
    </Modal>
  )
}

export default function Dashboard() {
  const { user, can, isAdmin } = useAuth()
  const nav = useNavigate()
  const [c, setC] = useState({})
  const [upcoming, setUpcoming] = useState([])
  const [recentDocs, setRecentDocs] = useState([])
  const [emails, setEmails] = useState([])
  const [qrs, setQrs] = useState([])
  const [q, setQ] = useState(''), [hits, setHits] = useState([])
  const [qrForm, setQrForm] = useState(null)
  const [people, setPeople] = useState([])

  const count = async (t, f) => { let r = supabase.from(t).select('id', { count: 'exact', head: true }); if (f) r = f(r); const { count: n } = await r; return n ?? 0 }
  async function load() {
    const [pe, act, ev, pl, al, mm, dc, tr, ct] = await Promise.all([
      count('personnel'), count('personnel', (r) => r.neq('status', 'Inactive')), count('calendar_events'),
      count('leave_records', (r) => r.eq('status', 'Pending')), count('leave_records', (r) => r.eq('status', 'Approved')),
      count('memos', (r) => r.is('sent', null)), count('documentation'), count('trainings'), count('contacts')])
    setC({ pe, act, ev, pl, al, mm, dc, tr, ct })
    supabase.from('calendar_events').select('*').gte('start_date', today()).order('start_date').limit(7).then(({ data }) => setUpcoming(data || []))
    supabase.from('documentation').select('*').order('date_received', { ascending: false }).limit(5).then(({ data }) => setRecentDocs(data || []))
    supabase.from('personnel').select('id,name').then(({ data }) => setPeople(data || []))
    if (can('email', 'view')) supabase.from('email_records').select('*').in('status', ['Pending', 'For Action']).order('date').then(async ({ data }) => {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'emailOverdueDays').maybeSingle()
      const th = Number(s?.value) || 3
      setEmails((data || []).filter((x) => (daysSince(x.date) ?? -1) >= th))
    })
    const { data: qr } = await supabase.rpc('get_qr_codes'); setQrs(qr || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function search(v) {
    setQ(v)
    const t = v.trim().toLowerCase()
    if (!t) return setHits([])
    const out = []
    for (const [label, table, page, hay, name] of SEARCH) {
      let rows = []
      try { rows = await fetchAll(table) } catch { /* no access */ }
      rows.filter((r) => hay(r).toLowerCase().includes(t)).slice(0, 5).forEach((r) => out.push({ label, page, name: name(r) || 'Record', k: table + r.id }))
    }
    setHits(out)
  }
  async function delQR(x) {
    if (!confirm('Delete this QR Code?')) return
    const { data: row } = await supabase.from('qr_codes').select('*').eq('id', x.id).single()
    await deleteRow('qr_codes', row, user, 'qrcodes'); await removeFiles([row.real_image, row.decoy_image]); load()
  }
  const who = (e) => people.filter((p) => (e.person_ids || []).includes(p.id)).map((p) => p.name).join(', ') || 'Office-wide'
  const stats = [['PSTO Personnel', c.pe, `${c.act ?? 0} active`], ['Calendar Activities', c.ev], ['Pending Leave', c.pl], ['Approved Leave', c.al], ['Memos Without Date Sent', c.mm], ['Documentations', c.dc], ['Training Records', c.tr], ['Contacts', c.ct]]

  return (
    <>
      <div className="topbar"><div><h1>DASHBOARD</h1><div className="sub">PSTO Zambales internal information hub</div></div></div>
      <div className="panel">
        <div className="toolbar"><input className="dashboard-search" style={{ flex: 1 }} placeholder="🔎 Search personnel, memo, document, contact, activity..." value={q} onChange={(e) => search(e.target.value)} /></div>
        <div className="search-results">
          {hits.map((h) => <div className="result-item" key={h.k}><b>{h.label}</b> — {h.name} <button className="btn secondary small" onClick={() => nav('/' + h.page)}>Open</button></div>)}
          {q && !hits.length && <div className="small">No matching records found.</div>}
        </div>
      </div>
      <div className="cardgrid" style={{ marginTop: 16 }}>
        {stats.map(([l, n, sub]) => <div className="card" key={l}><div className="num">{n ?? '…'}</div><div className="label">{l}</div>{sub && <div className="stat-mini">{sub}</div>}</div>)}
      </div>
      <div className="panel"><h2>📅 Upcoming Activities</h2>
        {upcoming.map((x) => <div key={x.id} style={{ margin: '8px 0' }}><span className="color-dot" style={{ background: eventColor(x) }} /><b>{fmtDate(x.start_date)}</b> — {x.title} <span className="badge">{x.category}</span> <span className="small">{who(x)}</span></div>)}
        {!upcoming.length && <div className="empty">No upcoming activities encoded.</div>}</div>
      <div className="panel"><h2>📨 Recent Documentations</h2>
        {recentDocs.map((x) => <div key={x.id} style={{ margin: '8px 0' }}><b>{x.reference_no || '—'}</b> • {x.direction} • {fmtDate(x.date_received)} — {x.title || 'Untitled'}</div>)}
        {!recentDocs.length && <div className="empty">No documentation records yet.</div>}</div>
      {can('email', 'view') && <div className="panel"><h2>✉️ Emails Needing Attention</h2>
        {emails.map((x) => <div key={x.id} style={{ margin: '8px 0' }}><span className="badge warn">⚠ {daysSince(x.date)}d</span> <b>{x.subject}</b> — {x.from_to} <span className="small">({x.status}{x.assigned_to ? `, assigned to ${x.assigned_to}` : ''})</span></div>)}
        {!emails.length && <div className="empty">Nothing overdue. 🎉</div>}</div>}
      <div className="panel">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>🔗 Quick Links / QR Codes</h2>{isAdmin && <button className="btn" onClick={() => setQrForm({})}>+ Add QR Code</button>}</div>
        <div className="cardgrid">
          {qrs.map((x) => (
            <div className="card qr-card" key={x.id}>
              <div className="label" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{x.label || 'QR Code'}</div>
              {x.image ? <SignedImg path={x.image} className="qr-display" alt={x.label} /> : <div className="qr-placeholder">No QR image uploaded</div>}
              <div className="actionrow" style={{ justifyContent: 'center' }}>
                {x.link && <a className="btn secondary small" href={x.link} target="_blank" rel="noopener noreferrer">Open</a>}
                {isAdmin && <><button className="btn secondary small" onClick={async () => { const { data } = await supabase.from('qr_codes').select('*').eq('id', x.id).single(); setQrForm({ row: data }) }}>Edit</button><button className="btn danger small" onClick={() => delQR(x)}>Delete</button></>}
              </div>
            </div>
          ))}
          {!qrs.length && <div className="empty">No QR Codes have been added.</div>}
        </div>
      </div>
      {qrForm && <QRForm row={qrForm.row} onClose={() => setQrForm(null)} onSaved={() => { setQrForm(null); load() }} />}
    </>
  )
}
