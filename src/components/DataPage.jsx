import { useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useRows, saveRow, deleteRow, logAction } from '../lib/db'
import { downloadCSV, today } from '../lib/utils'
import Modal from './Modal'
import RecordForm from './RecordForm'
import ImportModal from './ImportModal'

/*
 Generic CRUD table page (attendance, leave, contacts, memos, trainings, email, documentation, funds).
 columns: [{ key, label, render(row), value(row), sortable }]
*/
export default function DataPage({
  title, desc, table, tab, columns, fields, order = 'id', asc = false, toolbar, top, bottom, filterRows,
  rowClass, prepare, canAdd, canEditRow, canDeleteRow, importable = true, initialDefaults, onChanged,
}) {
  const { user, can, isAdmin } = useAuth()
  const { rows, reload, loading, error } = useRows(table, { order, asc })
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(null)
  const [form, setForm] = useState(null) // { row? }
  const [imp, setImp] = useState(false)
  const owns = (r) => isAdmin || r.added_by === user.id
  const addOk = canAdd ?? can(tab, 'add')
  const editOk = canEditRow || ((r) => can(tab, 'edit') && owns(r))
  const delOk = canDeleteRow || ((r) => can(tab, 'delete') && owns(r))
  const val = (c, r) => (c.value ? c.value(r) : r[c.key])

  const list = useMemo(() => {
    let l = filterRows ? filterRows(rows) : rows
    if (q) l = l.filter((r) => columns.map((c) => val(c, r)).join(' ').toLowerCase().includes(q.toLowerCase()))
    if (sort) {
      const c = columns[sort.col]
      l = [...l].sort((a, b) => {
        const A = String(val(c, a) ?? ''), B = String(val(c, b) ?? '')
        const na = Number(A), nb = Number(B)
        const r = A !== '' && B !== '' && !isNaN(na) && !isNaN(nb) ? na - nb : A.localeCompare(B, undefined, { numeric: true, sensitivity: 'base' })
        return sort.dir === 'asc' ? r : -r
      })
    }
    return l
  }, [rows, q, sort, filterRows, columns]) // eslint-disable-line

  async function save(out) {
    const rec = prepare ? prepare(out, form.row) : out
    if (!form.row) rec.added_by_name = user.name
    const saved = await saveRow(table, rec, form.row?.id)
    await logAction(user, form.row ? 'Edit' : 'Add', tab, `${form.row ? 'Edited' : 'Added'} record #${saved.id}`)
    setForm(null)
    await reload()
    onChanged?.()
  }
  async function del(r) {
    if (!confirm('Delete this record? Administrators can restore it from Backup / Restore → Recently Deleted.')) return
    try { await deleteRow(table, r, user, tab); await reload(); onChanged?.() } catch (e) { alert(e.message) }
  }
  const exportCSV = () => {
    downloadCSV(`PSTO-${tab}-${today()}.csv`, [columns.map((c) => c.label), ...list.map((r) => columns.map((c) => String(val(c, r) ?? '')))])
    logAction(user, 'Export', tab, 'Exported table as CSV')
  }
  const sortBy = (i) => setSort((s) => ({ col: i, dir: s?.col === i && s.dir === 'asc' ? 'desc' : 'asc' }))

  return (
    <>
      <div className="topbar"><div><h1>{title}</h1><div className="sub">{desc}</div></div></div>
      {typeof top === 'function' ? top(rows) : top}
      <div className="panel">
        <div className="toolbar">
          {toolbar}
          <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
          {addOk && <button className="btn" onClick={() => setForm({})}>+ Add Record</button>}
          {addOk && importable && <button className="btn secondary" onClick={() => setImp(true)}>⬆ Import CSV</button>}
          <button className="btn secondary" onClick={exportCSV}>⬇ CSV</button>
          <button className="btn secondary" onClick={() => window.print()}>🖨 Print</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="tablewrap">
          <table>
            <thead><tr>
              {columns.map((c, i) => c.sortable === false
                ? <th key={i}>{c.label}</th>
                : <th key={i} className="sortable" onClick={() => sortBy(i)}>{c.label}<span className="sort-indicator">{sort?.col === i ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></th>)}
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={rowClass?.(r) || ''}>
                  {columns.map((c, i) => <td key={i}>{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}
                  <td>
                    {editOk(r) && <button className="btn secondary small" onClick={() => setForm({ row: r })}>Edit</button>}{' '}
                    {delOk(r) && <button className="btn danger small" onClick={() => del(r)}>Delete</button>}
                    {!editOk(r) && !delOk(r) && <span className="small">View only</span>}
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={columns.length + 1} className="empty">{loading ? 'Loading…' : 'No records yet.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="small" style={{ marginTop: 8 }}>Click any column heading to sort. You can edit or delete only records you encoded; administrators can manage all records.</div>
      </div>
      {bottom?.(rows)}
      {form && (
        <Modal title={`${form.row ? 'Edit' : 'Add'} ${title} record`} onClose={() => setForm(null)}>
          <RecordForm fields={fields} initial={form.row || initialDefaults || {}} folder={table} onSubmit={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {imp && <ImportModal table={table} fields={fields} section={tab} onClose={() => setImp(false)} onDone={(n) => { setImp(false); reload(); alert(`Imported ${n} record(s).`) }} />}
    </>
  )
}
