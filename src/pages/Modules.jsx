import { useEffect, useState } from 'react'
import DataPage from '../components/DataPage'
import Modal from '../components/Modal'
import { FileList } from '../components/FileViews'
import { useAuth } from '../lib/auth'
import { useRows, useSetting, logAction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { LEAVE_TYPES, MEMO_PROGRAMS } from '../lib/constants'
import { fmtDate, dateRangeText, daysSince, peso, unique } from '../lib/utils'

const files = { key: 'files', label: 'Document(s)', render: (r) => <FileList files={r.files} />, sortable: false, value: () => '' }
const D = (key, label) => ({ key, label, render: (r) => fmtDate(r[key]), value: (r) => r[key] || '' })

/* ---------------- Attendance ---------------- */
export const Attendance = () => (
  <DataPage title="ATTENDANCE" desc="Daily attendance records" table="attendance" tab="attendance" order="date"
    columns={[D('date', 'Date'), { key: 'employee', label: 'Employee' }, { key: 'status', label: 'Status' }, { key: 'time_in', label: 'Time In' }, { key: 'time_out', label: 'Time Out' }, { key: 'remarks', label: 'Remarks' }]}
    fields={[
      { key: 'employee', label: 'Employee', type: 'personnelSelect' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Present', 'Absent', 'Leave', 'Official Business', 'Work From Home', 'Late', 'Half Day'] },
      { key: 'time_in', label: 'Time In', type: 'time' }, { key: 'time_out', label: 'Time Out', type: 'time' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }]} />
)

/* ---------------- Leave (+ summary; approved leave syncs to the calendar via a database trigger) ---------------- */
function LeaveSummary({ rows }) {
  if (!rows.length) return <div className="panel"><h2>Leave Summary — Days per Personnel, per Leave Type</h2><div className="empty">No leave records yet.</div></div>
  const people = unique(rows.map((x) => x.employee)), types = unique(rows.map((x) => x.type))
  return (
    <div className="panel"><h2>Leave Summary — Days per Personnel, per Leave Type</h2>
      <div className="tablewrap"><table className="leavesum-table">
        <thead><tr><th>Personnel</th>{types.map((t) => <th key={t}>{t}</th>)}<th>Total Days</th></tr></thead>
        <tbody>{people.map((p) => {
          const per = types.map((t) => rows.filter((x) => x.employee === p && x.type === t).reduce((s, x) => s + (Number(x.days) || 0), 0))
          return <tr key={p}><td><b>{p}</b></td>{per.map((d, i) => <td key={i}>{d || '—'}</td>)}<td><b>{per.reduce((a, b) => a + b, 0)}</b></td></tr>
        })}</tbody>
      </table></div></div>
  )
}
export const Leave = () => (
  <DataPage title="LEAVE" desc="Employee leave tracker — approved leave automatically appears on the Calendar." table="leave_records" tab="leave" order="date_from"
    columns={[{ key: 'employee', label: 'Employee' }, { key: 'type', label: 'Leave Type', value: (r) => (r.type === 'Others' && r.other_type ? `Others — ${r.other_type}` : r.type) },
      D('date_from', 'From'), D('date_to', 'To'), { key: 'days', label: 'Days' }, { key: 'status', label: 'Status' }, { key: 'remarks', label: 'Remarks' }, files]}
    fields={[
      { key: 'employee', label: 'Employee', type: 'personnelSelect' },
      { key: 'type', label: 'Leave Type', type: 'select', options: LEAVE_TYPES },
      { key: 'other_type', label: 'If "Others", specify', showIf: (v) => v.type === 'Others' },
      { key: 'date_from', label: 'From', type: 'date' }, { key: 'date_to', label: 'To', type: 'date' },
      { key: 'days', label: 'Number of Days', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Disapproved'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }, { key: 'files', label: 'Upload Document(s) (optional)', type: 'files' }]}
    rowClass={(r) => (r.status === 'Pending' ? 'row-pending' : r.status === 'Approved' ? 'row-approved' : '')}
    bottom={(rows) => <LeaveSummary rows={rows} />} />
)

/* ---------------- Contacts ---------------- */
export function Contacts() {
  const { isGuest } = useAuth()
  const [dept, setDept] = useState(''), [muni, setMuni] = useState('')
  const { rows } = useRows('contacts')
  return (
    <DataPage title="CONTACTS" desc="Searchable contact directory — filter by department and municipality" table="contacts" tab="contacts" order="name" asc
      toolbar={<>
        <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All Departments</option>{unique(rows.map((x) => x.department)).map((x) => <option key={x}>{x}</option>)}</select>
        <select value={muni} onChange={(e) => setMuni(e.target.value)}><option value="">All Address/Municipality</option>{unique(rows.map((x) => x.municipality)).map((x) => <option key={x}>{x}</option>)}</select>
      </>}
      filterRows={(l) => l.filter((x) => (!dept || x.department === dept) && (!muni || x.municipality === muni))}
      columns={[{ key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' }, { key: 'department', label: 'Department' }, { key: 'municipality', label: 'Address/Municipality' },
        ...(isGuest ? [] : [{ key: 'phone', label: 'Contact' }, { key: 'email', label: 'Email' }]), D('date_acquired', 'Date Acquired'), { key: 'remarks', label: 'Remarks', sortable: false }]}
      fields={[{ key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' }, { key: 'department', label: 'Department' }, { key: 'municipality', label: 'Address/Municipality' },
        { key: 'phone', label: 'Contact Number' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'date_acquired', label: 'Date Acquired', type: 'date' }, { key: 'remarks', label: 'Remarks', type: 'textarea' }]} />
  )
}

/* ---------------- Memos ---------------- */
export const Memos = () => (
  <DataPage title="MEMO" desc="Memo series and sending tracker" table="memos" tab="memos" order="date"
    rowClass={(r) => (!r.sent ? 'row-missing-date' : '')}
    columns={[{ key: 'memo_number', label: 'Memo Number' }, D('date', 'Date'), { key: 'subject', label: 'Subject' },
      { key: 'program', label: 'Program/Project', value: (r) => (r.program === 'Others' && r.program_other ? r.program_other : r.program || '—') },
      D('sent', 'Date Emailed/Sent'), files, { key: 'remarks', label: 'Remarks' }]}
    fields={[{ key: 'memo_number', label: 'Memo Number (e.g. ZAMB-01-A)' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'subject', label: 'Subject' },
      { key: 'program', label: 'Program/Project', type: 'select', options: MEMO_PROGRAMS }, { key: 'program_other', label: 'If "Others", specify', showIf: (v) => v.program === 'Others' },
      { key: 'sent', label: 'Date Emailed/Sent', type: 'date' }, { key: 'remarks', label: 'Remarks', type: 'textarea' }, { key: 'files', label: 'Upload Document(s) (optional)', type: 'files' }]} />
)

/* ---------------- Trainings ---------------- */
function ParticipantNames({ ids }) {
  const { rows } = useRows('personnel')
  const n = rows.filter((p) => (ids || []).includes(p.id)).map((p) => p.name)
  return n.join(', ') || '—'
}
export const Trainings = () => (
  <DataPage title="TRAINING ATTENDED" desc="Training/seminar history" table="trainings" tab="trainings" order="date_from"
    columns={[{ key: 'title', label: 'Training/Seminar' }, { key: 'participants', label: 'Participants', render: (r) => <ParticipantNames ids={r.participants} />, value: (r) => (r.participants || []).join(' ') },
      { key: 'conducted_by', label: 'Conducted By' }, { key: 'duration', label: 'Duration' },
      { key: 'date_from', label: 'Date', render: (r) => dateRangeText(r.date_from, r.date_to), value: (r) => r.date_from || '' },
      { key: 'amount', label: 'Amount' }, { key: 'funding', label: 'Funding' }, { key: 'certificate', label: 'Certificate' }, { ...files, label: 'File' }, { key: 'remarks', label: 'Remarks' }]}
    fields={[{ key: 'title', label: 'Title of Training/Seminar' }, { key: 'participants', label: 'Participants (PSTO Personnel)', type: 'personnelMulti' },
      { key: 'conducted_by', label: 'Conducted By' }, { key: 'duration', label: 'Duration' }, { key: 'date_from', label: 'Date From', type: 'date' }, { key: 'date_to', label: 'Date To', type: 'date' },
      { key: 'amount', label: 'Amount (Php)', type: 'number' }, { key: 'funding', label: 'Funding' }, { key: 'certificate', label: 'With Certificate', type: 'select', options: ['Yes', 'No'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }, { key: 'files', label: 'Upload File(s) (optional)', type: 'files' }]} />
)

/* ---------------- Email tracker ---------------- */
function AgingBadge({ r, threshold }) {
  if (['Completed', 'Filed'].includes(r.status)) return <span className="badge muted-badge">—</span>
  const d = daysSince(r.date)
  if (d === null) return null
  const over = d >= threshold
  return <span className={`badge ${over ? 'warn' : 'info'}`}>{over ? '⚠ ' : ''}{d} day{d === 1 ? '' : 's'}</span>
}
function ThreadModal({ reference, onClose }) {
  const [items, setItems] = useState(null)
  useEffect(() => { supabase.from('email_records').select('*').eq('reference', reference).order('date').then(({ data }) => setItems(data || [])) }, [reference])
  return (
    <Modal title={`EMAIL THREAD — ${reference}`} onClose={onClose}>
      {(items || []).map((x) => (
        <div key={x.id} className="day-event" style={{ borderLeftColor: x.direction === 'Sent' ? '#2563eb' : '#16a34a', cursor: 'default' }}>
          <b>{x.direction}</b> • {fmtDate(x.date)} <span className={`badge ${['Completed', 'Filed'].includes(x.status) ? 'ok' : 'warn'}`}>{x.status}</span><br />
          <b>{x.subject}</b><br /><span className="small">{x.from_to}{x.assigned_to ? ` • Assigned to ${x.assigned_to}` : ''}</span>
          {x.remarks && <div className="small" style={{ marginTop: 4 }}>{x.remarks}</div>}
          {x.files?.length > 0 && <div style={{ marginTop: 4 }}><FileList files={x.files} /></div>}
        </div>
      ))}
      {items && !items.length && <div className="empty">No thread entries found.</div>}
      <div style={{ marginTop: 10 }}><button className="btn secondary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}
export function EmailTracker() {
  const { isAdmin } = useAuth()
  const [days, saveDays] = useSetting('emailOverdueDays', 3)
  const [thread, setThread] = useState(null)
  const threshold = Number(days) || 3
  return (
    <>
      <DataPage title="EMAIL TRACKER" desc="Track important office emails. Give every message in the same conversation the same Reference to group it into a thread." table="email_records" tab="email" order="date"
        toolbar={isAdmin && <span className="small">Flag as overdue after <input type="number" min="1" style={{ width: 55 }} value={threshold} onChange={(e) => saveDays(Math.max(1, Number(e.target.value) || 3))} /> day(s)</span>}
        columns={[D('date', 'Date'), { key: 'direction', label: 'Direction' }, { key: 'from_to', label: 'From/To' }, { key: 'subject', label: 'Subject' },
          { key: 'assigned_to', label: 'Assigned To', render: (r) => r.assigned_to || 'None' }, { key: 'program', label: 'Program/Project' }, { key: 'reference', label: 'Reference' }, { key: 'status', label: 'Status' },
          { key: 'aging', label: 'Aging', render: (r) => <AgingBadge r={r} threshold={threshold} />, value: (r) => daysSince(r.date) ?? '' },
          { key: 'thread', label: 'Thread', sortable: false, value: () => '', render: (r) => (r.reference ? <button className="btn secondary small" onClick={() => setThread(r.reference)}>View Thread</button> : '—') },
          files, { key: 'remarks', label: 'Remarks' }]}
        fields={[{ key: 'date', label: 'Date', type: 'date' }, { key: 'direction', label: 'Direction', type: 'select', options: ['Received', 'Sent'] }, { key: 'from_to', label: 'From / To' }, { key: 'subject', label: 'Subject' },
          { key: 'assigned_to', label: 'Assigned To', type: 'personnelSelect' }, { key: 'program', label: 'Program/Project' },
          { key: 'reference', label: 'Thread Reference (same value for every reply in this conversation)' },
          { key: 'status', label: 'Status', type: 'select', options: ['For Action', 'Pending', 'Completed', 'Filed'] },
          { key: 'remarks', label: 'Remarks', type: 'textarea' }, { key: 'files', label: 'Upload Document(s) (optional)', type: 'files' }]} />
      {thread && <ThreadModal reference={thread} onClose={() => setThread(null)} />}
    </>
  )
}

/* ---------------- Documentations ---------------- */
function DocTypeManager({ types, onClose, onChange }) {
  const [v, setV] = useState('')
  const add = async () => { const n = v.trim(); if (!n) return; const { error } = await supabase.from('doc_types').insert({ name: n }); if (error) return alert(error.message.includes('duplicate') ? 'That document type already exists.' : error.message); setV(''); onChange() }
  const rename = async (t) => { const n = prompt('New document type name:', t)?.trim(); if (!n || n === t) return; await supabase.from('doc_types').insert({ name: n }); await supabase.from('documentation').update({ doc_type: n }).eq('doc_type', t); await supabase.from('doc_types').delete().eq('name', t); onChange() }
  const del = async (t) => {
    if (types.length <= 1) return alert('Keep at least one document type.')
    const { count } = await supabase.from('documentation').select('id', { count: 'exact', head: true }).eq('doc_type', t)
    if (count) return alert('This type is in use and cannot be deleted.')
    await supabase.from('doc_types').delete().eq('name', t); onChange()
  }
  return (
    <Modal title="MANAGE DOCUMENT TYPES" onClose={onClose}>
      <ul className="doc-list">{types.map((t) => <li key={t}>{t} <button className="btn secondary small" onClick={() => rename(t)}>Edit</button> <button className="btn danger small" onClick={() => del(t)}>Delete</button></li>)}</ul>
      <div className="field full"><label>Add Type</label><div style={{ display: 'flex', gap: 8 }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Endorsement" /><button className="btn" onClick={add}>Add</button></div></div>
    </Modal>
  )
}
export function Documentation() {
  const { user, can, isGuest } = useAuth()
  const { rows: typeRows, reload } = useRows('doc_types', { order: 'name', asc: true })
  const types = typeRows.map((t) => t.name)
  const [filter, setFilter] = useState(''), [mgr, setMgr] = useState(false)
  return (
    <>
      <DataPage title="DOCUMENTATIONS" desc="Log of incoming and outgoing communications — letters, newsletters, memos from the regional office or LGUs, reminders — with attachments." table="documentation" tab="documentation" order="date_received"
        filterRows={(l) => l.filter((x) => !filter || x.doc_type === filter)}
        toolbar={<>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All Document Types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          {!isGuest && can('documentation', 'add') && <button className="btn secondary" onClick={() => setMgr(true)}>⚙ Manage Document Types</button>}
        </>}
        prepare={(o, row) => ({ ...o, reference_no: o.reference_no || row?.reference_no || `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}` })}
        columns={[{ key: 'reference_no', label: 'Reference No.' }, { key: 'direction', label: 'Direction', render: (r) => <span className={`badge ${r.direction === 'Outgoing' ? 'outgoing' : 'incoming'}`}>{r.direction}</span> },
          D('date_received', 'Date Received/Sent'), { key: 'doc_type', label: 'Type of Document' }, { key: 'from_to', label: 'Received/Sent By' }, { key: 'title', label: 'Subject/Title' },
          { key: 'action', label: 'Action Taken' }, { key: 'remarks', label: 'Remarks' }, files]}
        fields={[{ key: 'direction', label: 'Direction *', type: 'select', options: ['Incoming', 'Outgoing'] }, { key: 'date_received', label: 'Date Received/Sent *', type: 'date', required: true },
          { key: 'doc_type', label: 'Type of Document *', type: 'select', options: types.length ? types : ['Other'] },
          { key: 'reference_no', label: 'Reference No. (auto-generated if left blank)' }, { key: 'from_to', label: 'Received/Sent By (office or person) *', required: true },
          { key: 'title', label: 'Subject / Title *', required: true }, { key: 'action', label: 'Action Taken / Required', type: 'textarea', placeholder: 'e.g. Forwarded to Regional Office, for signature, filed…' },
          { key: 'remarks', label: 'Remarks', type: 'textarea' }, { key: 'files', label: 'Upload Document(s) (optional)', type: 'files' }]} />
      {mgr && <DocTypeManager types={types} onClose={() => setMgr(false)} onChange={reload} />}
    </>
  )
}

/* ---------------- Office fund (visible to staff, admin-only edits) ---------------- */
function FundTypeManager({ types, onClose, onChange }) {
  const [v, setV] = useState('')
  const add = async () => { const n = v.trim(); if (!n) return; const { error } = await supabase.from('fund_types').insert({ name: n }); if (error) return alert('That fund type already exists.'); setV(''); onChange() }
  const del = async (t) => { if (!confirm('Delete this fund type? Past transactions remain but keep this label.')) return; await supabase.from('fund_types').delete().eq('name', t); onChange() }
  return (
    <Modal title="MANAGE FUND TYPES" onClose={onClose}>
      <ul className="doc-list">{types.map((t) => <li key={t}>{t} {types.length > 1 && <button className="btn danger small" style={{ float: 'right' }} onClick={() => del(t)}>Delete</button>}</li>)}</ul>
      <div className="field full"><label>Add New Fund Type</label><div style={{ display: 'flex', gap: 8 }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Christmas Party Fund" /><button className="btn" onClick={add}>Add</button></div></div>
    </Modal>
  )
}
export function Funds() {
  const { isAdmin } = useAuth()
  const { rows: tRows, reload: reloadTypes } = useRows('fund_types', { order: 'name', asc: true })
  const { rows: people } = useRows('personnel')
  const types = tRows.map((t) => t.name)
  const [filter, setFilter] = useState(''), [mgr, setMgr] = useState(false), [tick, setTick] = useState(0)
  const who = (r) => people.find((p) => String(p.id) === String(r.person_id))?.name || r.party || '—'
  const cards = (rows) => {
    const shown = filter ? [filter] : types
    let gi = 0, go = 0
    const list = shown.map((t) => {
      const tx = rows.filter((x) => x.fund_type === t)
      const i = tx.filter((x) => x.entry_type === 'Contribution').reduce((s, x) => s + (Number(x.amount) || 0), 0)
      const o = tx.filter((x) => x.entry_type === 'Expense').reduce((s, x) => s + (Number(x.amount) || 0), 0)
      gi += i; go += o
      return <div className="card" key={t}><div className="label">{t}</div><div className="num">{peso(i - o)}</div><div className="small">In: {peso(i)} • Out: {peso(o)}</div></div>
    })
    if (!filter && shown.length > 1) list.push(<div className="card" key="g" style={{ borderColor: '#2563eb' }}><div className="label">Grand Total</div><div className="num">{peso(gi - go)}</div><div className="small">In: {peso(gi)} • Out: {peso(go)}</div></div>)
    return <div className="panel"><div className="cardgrid">{list}</div></div>
  }
  return (
    <>
      <DataPage key={tick} title="OFFICE FUND" desc="Contributions and expenses — visible to staff for transparency; only the administrator can add, edit or delete." table="funds" tab="funds" order="date"
        canAdd={isAdmin} canEditRow={() => isAdmin} canDeleteRow={() => isAdmin} importable={false}
        filterRows={(l) => l.filter((x) => !filter || x.fund_type === filter)}
        top={cards}
        toolbar={<>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All Fund Types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          {isAdmin && <button className="btn secondary" onClick={() => setMgr(true)}>⚙ Manage Fund Types</button>}
        </>}
        columns={[D('date', 'Date'), { key: 'fund_type', label: 'Fund' }, { key: 'entry_type', label: 'Type', render: (r) => <span className={`badge ${r.entry_type === 'Expense' ? 'warn' : 'ok'}`}>{r.entry_type}</span> },
          { key: 'who', label: 'Contributor / Recipient', value: who }, { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount', render: (r) => peso(r.amount), value: (r) => r.amount ?? '' }, { key: 'added_by_name', label: 'Encoded By' }]}
        fields={[{ key: 'fund_type', label: 'Fund Type', type: 'select', options: types.length ? types : ['General Office Fund'] }, { key: 'entry_type', label: 'Entry Type', type: 'select', options: ['Contribution', 'Expense'] },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'person_id', label: 'PSTO Personnel (optional)', type: 'personnelId' },
          { key: 'party', label: 'Contributor / Recipient (if not PSTO personnel)' }, { key: 'amount', label: 'Amount (Php)', type: 'number' },
          { key: 'description', label: 'Description / Purpose' }, { key: 'remarks', label: 'Remarks', type: 'textarea' }]} />
      {mgr && <FundTypeManager types={types} onClose={() => setMgr(false)} onChange={() => { reloadTypes(); setTick((t) => t + 1) }} />}
    </>
  )
}
