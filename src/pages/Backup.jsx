import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchAll, useRows, useSetting, logAction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { today } from '../lib/utils'

// parents before children so foreign keys resolve on restore
const TABLES = ['personnel', 'personnel_documents', 'personnel_doc_links', 'leave_records', 'calendar_events', 'attendance', 'contacts', 'memos', 'trainings',
  'email_records', 'documentation', 'doc_types', 'funds', 'fund_types', 'focal_items', 'qr_codes', 'audit_log', 'settings']
const KEYS = { doc_types: 'name', fund_types: 'name', settings: 'key', personnel_doc_links: 'doc_id' }

export default function Backup() {
  const { user } = useAuth()
  const [last, saveLast] = useSetting('lastBackupAt', null)
  const { rows: trash, reload } = useRows('trash', { order: 'deleted_at' })
  const [file, setFile] = useState(null), [busy, setBusy] = useState('')

  async function exportBackup() {
    setBusy('Exporting…')
    try {
      const out = { version: 1, exportedAt: new Date().toISOString() }
      for (const t of TABLES) out[t] = await fetchAll(t)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }))
      a.download = `PSTO-Zambales-DATABASE-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href)
      await saveLast(new Date().toISOString()); await logAction(user, 'Backup', 'Database', 'Exported full database backup')
    } catch (e) { alert(e.message) }
    setBusy('')
  }
  async function restore() {
    if (!file) return alert('Please choose a backup file.')
    if (!confirm('Restore this backup? Records with the same ID are overwritten; other existing records are kept. File attachments live in Storage and are not part of the JSON backup.')) return
    setBusy('Restoring…')
    try {
      const x = JSON.parse(await file.text())
      if (!x.personnel || !x.calendar_events) throw new Error('This is not a valid backup file for this version.')
      for (const t of TABLES) {
        if (t === 'audit_log' || !x[t]?.length) continue
        for (let i = 0; i < x[t].length; i += 200) {
          const { error } = await supabase.from(t).upsert(x[t].slice(i, i + 200), { onConflict: KEYS[t] || 'id' })
          if (error) throw new Error(`${t}: ${error.message}`)
        }
      }
      await supabase.rpc('reset_sequences')
      await logAction(user, 'Restore', 'Database', 'Restored database from backup file')
      alert('Database restored.')
    } catch (e) { alert(e.message.startsWith('Unexpected') ? 'Invalid backup file.' : e.message) }
    setBusy('')
  }
  async function restoreTrash(t) {
    if (!confirm('Restore this deleted record?')) return
    const { error } = await supabase.from(t.type).insert(t.record)
    if (error) return alert(error.message.includes('duplicate') ? 'A record with the same ID already exists.' : error.message)
    await supabase.from('trash').delete().eq('id', t.id)
    await logAction(user, 'Restore', t.type, `Restored deleted record #${t.record.id}`); reload()
  }
  async function clearTrash() {
    if (!confirm('Permanently clear all recently deleted records?')) return
    await supabase.from('trash').delete().gte('id', 0); await logAction(user, 'Purge', 'Trash', 'Permanently cleared recently deleted records'); reload()
  }
  return (
    <>
      <div className="topbar"><div><h1>BACKUP / RESTORE</h1><div className="sub">Protect your office database</div></div></div>
      <div className="panel"><h2>Database Backup</h2>
        <p>Download a JSON copy of all records. Uploaded files stay in Supabase Storage (they are referenced by path, not embedded). Supabase also keeps its own automatic backups on paid plans.</p>
        <div className="small">Last backup: {last ? new Date(last).toLocaleString() : 'Never'}</div>
        <button className="btn green" disabled={!!busy} onClick={exportBackup}>{busy || '⬇ Export Full Backup'}</button></div>
      <div className="panel"><h2>Restore Database</h2><p>Restoring upserts every record in the file (same ID = overwritten).</p>
        <input type="file" accept=".json" onChange={(e) => setFile(e.target.files[0])} /> <button className="btn" disabled={!!busy} onClick={restore}>Restore Backup</button></div>
      <div className="panel danger-zone"><h2>Recently Deleted</h2><p>Deleted records are retained here until permanently cleared.</p>
        {trash.slice(0, 20).map((x) => <div className="result-item" key={x.id}><b>{x.type}</b> — {x.deleted_by} — {new Date(x.deleted_at).toLocaleString()} <button className="btn secondary small" onClick={() => restoreTrash(x)}>Restore</button></div>)}
        {!trash.length && <div className="empty">No deleted records.</div>}
        <button className="btn danger small" onClick={clearTrash}>Permanently Clear Deleted Records</button></div>
    </>
  )
}
