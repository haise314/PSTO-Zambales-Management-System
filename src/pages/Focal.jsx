import { useState } from 'react'
import Modal from '../components/Modal'
import { useAuth } from '../lib/auth'
import { useRows, saveRow, deleteRow, logAction } from '../lib/db'

const SECTIONS = [['programs', 'Programs'], ['linkages', 'Linkages'], ['tasks', 'Significant Tasks']]

function FocalForm({ section, row, onClose, onSaved }) {
  const { user } = useAuth()
  const { rows: people } = useRows('personnel', { order: 'name', asc: true })
  const [v, setV] = useState({ title: row?.title || '', focal: row?.focal || '', alternate: row?.alternate || '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  async function save(e) {
    e.preventDefault()
    if (!v.title.trim()) return setErr('Title is required.')
    try {
      const rec = { title: v.title.trim(), focal: v.focal || null, alternate: v.alternate || null }
      if (!row) rec.section = section
      const s = await saveRow('focal_items', rec, row?.id)
      await logAction(user, row ? 'Edit' : 'Add', 'focal', `${row ? 'Edited' : 'Added'} ${section} #${s.id}`)
      onSaved()
    } catch (ex) { setErr(ex.message) }
  }
  async function del() {
    if (!confirm('Delete this focal assignment?')) return
    await deleteRow('focal_items', row, user, 'focal'); onSaved()
  }
  const opts = <>{<option value="">None</option>}{people.map((p) => <option key={p.id}>{p.name}</option>)}</>
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} ${section.toUpperCase()} FOCAL ASSIGNMENT`} onClose={onClose}>
      <form className="formgrid" onSubmit={save}>
        <div className="field"><label>Title *</label><input value={v.title} onChange={set('title')} /></div>
        <div className="field"><label>Focal Person</label><select value={v.focal} onChange={set('focal')}>{opts}</select></div>
        <div className="field"><label>Alternate Focal</label><select value={v.alternate} onChange={set('alternate')}>{opts}</select></div>
        {err && <div className="field full error">{err}</div>}
        <div className="field full"><button className="btn">Save Assignment</button> {row && <button type="button" className="btn danger" onClick={del}>Delete</button>} <button type="button" className="btn secondary" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  )
}

export default function Focal() {
  const { isAdmin, profile, can } = useAuth()
  const { rows, reload } = useRows('focal_items')
  const [form, setForm] = useState(null)
  const [sorts, setSorts] = useState({})
  const manage = isAdmin || (profile.role === 'Staff' && can('focal', 'add'))
  const sortBy = (sec, col) => setSorts((s) => ({ ...s, [sec]: { col, dir: s[sec]?.col === col && s[sec].dir === 'asc' ? 'desc' : 'asc' } }))
  const list = (sec) => {
    const l = rows.filter((r) => r.section === sec)
    const s = sorts[sec]
    return s ? [...l].sort((a, b) => (s.dir === 'asc' ? 1 : -1) * String(a[s.col] || '').localeCompare(String(b[s.col] || ''))) : l
  }
  return (
    <>
      <div className="topbar"><div><h1>FOCAL PERSON</h1><div className="sub">Assign primary and alternate personnel for programs, linkages, and significant tasks.</div></div></div>
      <div className="focal-grid">
        {SECTIONS.map(([key, label]) => (
          <div className="panel" style={{ marginTop: 0 }} key={key}>
            <div className="toolbar" style={{ justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>{label}</h2>{manage && <button className="btn" onClick={() => setForm({ section: key })}>+ Add</button>}</div>
            <div className="tablewrap"><table className="focal-table">
              <thead><tr>{[['title', 'Title'], ['focal', 'Focal Person'], ['alternate', 'Alternate Focal']].map(([c, l]) => <th key={c} className="sortable" onClick={() => sortBy(key, c)}>{l}<span className="sort-indicator">↕</span></th>)}</tr></thead>
              <tbody>
                {list(key).map((x) => <tr key={x.id} style={manage ? { cursor: 'pointer' } : undefined} onClick={() => manage && setForm({ section: key, row: x })}><td>{x.title}</td><td>{x.focal || '—'}</td><td>{x.alternate || '—'}</td></tr>)}
                {!list(key).length && <tr><td colSpan={3} className="empty">No {label.toLowerCase()} assignments yet.</td></tr>}
              </tbody>
            </table></div>
          </div>
        ))}
      </div>
      {form && <FocalForm section={form.section} row={form.row} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </>
  )
}
