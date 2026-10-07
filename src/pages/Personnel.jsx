import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import RecordForm from '../components/RecordForm'
import { FileList, SignedImg } from '../components/FileViews'
import { useAuth } from '../lib/auth'
import { useRows, saveRow, deleteRow, logAction } from '../lib/db'
import { removeFiles } from '../lib/files'
import { supabase } from '../lib/supabase'
import { EMP_STATUSES } from '../lib/constants'
import { fmtDate, unique } from '../lib/utils'

const empLabel = (p) => (p.employment_status === 'Others' && p.employment_status_other ? p.employment_status_other : p.employment_status || '—')

const personFields = [
  { key: 'first_name', label: 'First Name *', required: true }, { key: 'middle_name', label: 'Middle Name / Initial' },
  { key: 'last_name', label: 'Last Name *', required: true }, { key: 'suffix', label: 'Suffix' },
  { key: 'position', label: 'Designation *', required: true }, { key: 'employee_id', label: 'Employee ID *', required: true },
  { key: 'birthdate', label: 'Birthdate', type: 'date' },
  { key: 'employment_status', label: 'Employment Status', type: 'select', options: EMP_STATUSES },
  { key: 'employment_status_other', label: 'If "Others", specify', showIf: (v) => v.employment_status === 'Others' },
  { key: 'department', label: 'Department / Unit' }, { key: 'home_address', label: 'Home Address' },
  { key: 'phones', label: 'Contact Numbers *', type: 'stringList', placeholder: 'e.g. 09xx-xxx-xxxx' },
  { key: 'emails', label: 'Email Addresses *', type: 'stringList', inputType: 'email', placeholder: 'name@example.com' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  { key: 'color', label: 'Assigned Color *', type: 'color' },
  { key: 'call_card_qr', label: 'Personal Call Card QR Code', type: 'image', folder: 'qr-personnel', hint: "Upload the QR image used for the personnel's personal call card." },
  { key: 'headshot', label: 'Official Headshot', type: 'image', folder: 'headshots', hint: 'Upload an official profile/headshot image.' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

export function PersonnelForm({ row, onClose, onSaved }) {
  const { user } = useAuth()
  async function save(out) {
    const rec = { ...out }
    if (!row) rec.status = rec.status || 'Active'
    const saved = await saveRow('personnel', rec, row?.id)
    await logAction(user, row ? 'Edit' : 'Add', 'personnel', `${row ? 'Edited' : 'Added'} personnel #${saved.id}`)
    onSaved()
  }
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} PSTO PERSONNEL`} onClose={onClose}>
      <RecordForm fields={personFields} initial={row || { color: '#2563eb', status: 'Active', employment_status: EMP_STATUSES[0] }} folder="personnel" onSubmit={save} onCancel={onClose} submitLabel="Save Personnel" />
    </Modal>
  )
}

/* ---- submitted documents (links are visible only to the owner + administrator) ---- */
function DocForm({ person, doc, canSeeLink, onClose, onSaved }) {
  const { user } = useAuth()
  const [link, setLink] = useState('')
  useEffect(() => { if (doc && canSeeLink && doc.has_link) supabase.from('personnel_doc_links').select('link').eq('doc_id', doc.id).maybeSingle().then(({ data }) => data && setLink(data.link)) }, [doc, canSeeLink])
  async function save(out) {
    const rec = { ...out, personnel_id: person.id, year: out.doc_date ? out.doc_date.slice(0, 4) : doc?.year || String(new Date().getFullYear()), has_link: canSeeLink ? !!link.trim() : !!doc?.has_link }
    const saved = await saveRow('personnel_documents', rec, doc?.id)
    if (canSeeLink) {
      if (link.trim()) await supabase.from('personnel_doc_links').upsert({ doc_id: saved.id, link: link.trim() })
      else if (doc) await supabase.from('personnel_doc_links').delete().eq('doc_id', saved.id)
    }
    await logAction(user, doc ? 'Edit' : 'Add', 'personnel', `${doc ? 'Edited' : 'Added'} document for ${person.name}`)
    onSaved()
  }
  return (
    <Modal title={`${doc ? 'Edit' : 'Add'} SUBMITTED DOCUMENT — ${person.name}`} onClose={onClose}>
      <RecordForm folder={`personnel-docs/${person.id}`} initial={doc || {}} onSubmit={save} onCancel={onClose}
        fields={[{ key: 'name', label: 'Document Name / Type' }, { key: 'doc_date', label: 'Date Submitted', type: 'date' },
          { key: 'files', label: 'Upload Document(s) (optional)', type: 'files' }, { key: 'notes', label: 'Notes / Remarks', type: 'textarea', placeholder: 'e.g. Original received, scanned copy, pending signature' }]}
        extra={canSeeLink && <div className="field full"><label>Document Link (optional)</label><input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste Google Drive or other document link" /></div>} />
    </Modal>
  )
}

function DocLink({ doc, canSee }) {
  const [link, setLink] = useState(null)
  useEffect(() => { if (canSee && doc.has_link) supabase.from('personnel_doc_links').select('link').eq('doc_id', doc.id).maybeSingle().then(({ data }) => setLink(data?.link || null)) }, [doc, canSee])
  if (!doc.has_link) return null
  if (!canSee) return <span className="small linklock">🔒 Submitted — visible to this personnel's own account and the administrator only</span>
  return link ? <a className="doc-link" href={link} target="_blank" rel="noopener noreferrer">Open document link ↗</a> : null
}

function DocsModal({ person, canManage, canSeeLink, onClose }) {
  const { user } = useAuth()
  const { rows, reload } = useRows('personnel_documents')
  const [year, setYear] = useState(''), [q, setQ] = useState(''), [form, setForm] = useState(null)
  const docs = rows.filter((d) => d.personnel_id === person.id)
  const years = unique(docs.map((d) => d.year || 'Undated')).reverse()
  const list = docs.filter((d) => (!year || (d.year || 'Undated') === year) && (!q || `${d.name} ${d.notes}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.doc_date || '').localeCompare(a.doc_date || ''))
  const grouped = {}; list.forEach((d) => (grouped[d.year || 'Undated'] = grouped[d.year || 'Undated'] || []).push(d))
  async function del(d) {
    if (!confirm('Delete this submitted document record? This cannot be undone.')) return
    await deleteRow('personnel_documents', d, user, 'personnel'); await removeFiles((d.files || []).map((f) => f.path)); reload()
  }
  return (
    <Modal title={`ALL SUBMITTED DOCUMENTS — ${person.name}`} onClose={onClose}>
      <div className="toolbar">
        <select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All Years</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <input placeholder="Search documents..." value={q} onChange={(e) => setQ(e.target.value)} />
        {canManage && <button className="btn small" onClick={() => setForm({})}>+ Document</button>}
      </div>
      {Object.keys(grouped).sort().reverse().map((y) => (
        <div key={y}><h3 style={{ margin: '14px 0 6px' }}>🗂️ {y} <span className="badge">{grouped[y].length}</span></h3>
          <div className="tablewrap"><table><thead><tr><th>Document</th><th>Date Submitted</th><th>Notes</th><th>File(s) / Link</th><th>Actions</th></tr></thead><tbody>
            {grouped[y].map((d) => <tr key={d.id}><td>{d.name || 'Untitled'}</td><td>{d.doc_date ? fmtDate(d.doc_date) : '—'}</td><td>{d.notes || '—'}</td>
              <td><FileList files={d.files} /><DocLink doc={d} canSee={canSeeLink} /></td>
              <td>{canManage && <><button className="btn secondary small" onClick={() => setForm({ doc: d })}>Edit</button> <button className="btn danger small" onClick={() => del(d)}>Delete</button></>}</td></tr>)}
          </tbody></table></div></div>
      ))}
      {!list.length && <div className="empty">No documents match your filters.</div>}
      <div style={{ marginTop: 10 }}><button className="btn secondary" onClick={onClose}>Close</button></div>
      {form && <DocForm person={person} doc={form.doc} canSeeLink={canSeeLink} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </Modal>
  )
}

function Card({ p, docs, onEdit, onDelete, onDocs, onAddDoc }) {
  const { user, isAdmin, isGuest, can, profile } = useAuth()
  const own = p.user_id === user.id
  const scopeAll = profile.personnel_scope_all
  const canEdit = isAdmin || scopeAll || (own && can('personnel', 'edit'))
  const canManageDocs = isAdmin || (profile.role === 'Staff' && (scopeAll || own))
  const canSeeLink = isAdmin || own
  return (
    <div className="person-card">
      <div className="person-strip" style={{ background: p.color || '#2563eb' }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 7 }}>
        <SignedImg path={p.headshot} className="person-photo" alt="Official headshot" />
        <div>
          <div className="person-name"><span className="color-dot" style={{ background: p.color || '#2563eb' }} />{p.name}</div>
          <div className="person-meta">{p.position} {p.department ? `• ${p.department}` : ''}</div>
          <div className="person-meta">{p.employee_id ? `🆔 ${p.employee_id} ` : ''}{!isGuest && p.birthdate ? `• 🎂 ${fmtDate(p.birthdate)}` : ''}</div>
        </div>
      </div>
      <div className="person-meta">{p.phones?.length ? '☎ ' + p.phones.join(', ') : 'No contact number recorded'}</div>
      <div className="small">{p.emails?.length ? p.emails.join(' • ') : 'No email recorded'} • <span className={`badge ${p.status === 'Inactive' ? 'warn' : 'ok'}`}>{p.status}</span> • <span className="badge info">{empLabel(p)}</span></div>
      {!isGuest && p.home_address && <div className="person-meta">🏠 {p.home_address}</div>}
      {p.call_card_qr && <div style={{ marginTop: 10 }}><span className="small">Personal Call Card QR</span><br /><SignedImg path={p.call_card_qr} className="callcard-qr" alt="Personal Call Card QR" /></div>}
      <div style={{ marginTop: 12 }}><b>Documents Submitted</b> <span className="badge">{docs.length}</span></div>
      <ul className="doc-list">
        {docs.slice(0, 3).map((d) => (
          <li key={d.id}><b>{d.name || 'Untitled'}</b><br /><span className="small">{d.doc_date ? fmtDate(d.doc_date) + ' • ' : ''}{d.notes}</span><br />
            <DocLink doc={d} canSee={canSeeLink} /> <FileList files={d.files} />
          </li>
        ))}
        {!docs.length && <li className="small">No documents recorded.</li>}
      </ul>
      <div className="actionrow">
        {canManageDocs && <button className="btn small" onClick={onAddDoc}>+ Document</button>}
        {docs.length > 0 && <button className="btn secondary small" onClick={onDocs}>📁 View All ({docs.length})</button>}
        {canEdit && <button className="btn secondary small" onClick={onEdit}>Edit</button>}
        {isAdmin && <button className="btn danger small" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export default function Personnel() {
  const { user, isAdmin, profile } = useAuth()
  const { rows, reload } = useRows('personnel', { order: 'name', asc: true })
  const { rows: allDocs, reload: reloadDocs } = useRows('personnel_documents')
  const [q, setQ] = useState(''), [dept, setDept] = useState(''), [status, setStatus] = useState('')
  const [edit, setEdit] = useState(null), [docsFor, setDocsFor] = useState(null), [addDocFor, setAddDocFor] = useState(null)
  const list = rows.filter((p) => (!q || `${p.name} ${p.department} ${p.position}`.toLowerCase().includes(q.toLowerCase())) && (!dept || p.department === dept) && (!status || p.status === status))
  const mgr = (p) => isAdmin || (profile.role === 'Staff' && (profile.personnel_scope_all || p.user_id === user.id))
  const seeLink = (p) => isAdmin || p.user_id === user.id
  async function del(p) {
    if (!confirm('Delete this personnel record and its submitted-document records?')) return
    await deleteRow('personnel', p, user, 'personnel'); reload(); reloadDocs()
  }
  return (
    <>
      <div className="topbar"><div><h1>PSTO PERSONNEL</h1><div className="sub">Directory of PSTO office personnel. Inactive or disabled accounts are hidden from non-administrators.</div></div></div>
      <div className="panel">
        <div className="toolbar">
          <input placeholder="Search personnel..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All Departments</option>{unique(rows.map((x) => x.department)).map((x) => <option key={x}>{x}</option>)}</select>
          {isAdmin && <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All Status</option><option>Active</option><option>Inactive</option></select>}
          {isAdmin && <button className="btn" onClick={() => setEdit({})}>+ Add Personnel</button>}
        </div>
        <div className="personnel-grid">
          {list.map((p) => <Card key={p.id} p={p} docs={allDocs.filter((d) => d.personnel_id === p.id)} onEdit={() => setEdit({ row: p })} onDelete={() => del(p)} onDocs={() => setDocsFor(p)} onAddDoc={() => setAddDocFor(p)} />)}
          {!list.length && <div className="empty" style={{ gridColumn: '1/-1' }}>No personnel encoded yet.</div>}
        </div>
      </div>
      {edit && <PersonnelForm row={edit.row} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
      {docsFor && <DocsModal person={docsFor} canManage={mgr(docsFor)} canSeeLink={seeLink(docsFor)} onClose={() => { setDocsFor(null); reloadDocs() }} />}
      {addDocFor && <DocForm person={addDocFor} canSeeLink={seeLink(addDocFor)} onClose={() => setAddDocFor(null)} onSaved={() => { setAddDocFor(null); reloadDocs() }} />}
    </>
  )
}
