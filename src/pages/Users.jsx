import { useState } from 'react'
import Modal from '../components/Modal'
import { useAuth } from '../lib/auth'
import { useRows, logAction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { TABS, defaultPerms } from '../lib/constants'

async function call(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error || msg } catch { /* keep generic message */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

function PermMatrix({ perms, setPerms }) {
  const tog = (tab, act) => setPerms({ ...perms, [tab]: { ...perms[tab], [act]: !perms[tab]?.[act] } })
  return (
    <table className="permtable"><thead><tr><th>Section</th><th>View</th><th>Add</th><th>Edit</th><th>Delete</th></tr></thead>
      <tbody>{TABS.map((t) => {
        const p = perms[t.key] || {}
        if (t.key === 'funds') return <tr key={t.key}><td>{t.label}</td><td><input type="checkbox" checked={!!p.view} onChange={() => tog('funds', 'view')} /></td><td colSpan={3} className="small" style={{ color: '#94a3b8' }}>Admin only (not user-configurable)</td></tr>
        return <tr key={t.key}><td>{t.label}</td>{['view', 'add', 'edit', 'delete'].map((a) => <td key={a}><input type="checkbox" checked={!!p[a]} onChange={() => tog(t.key, a)} /></td>)}</tr>
      })}</tbody></table>
  )
}

function UserForm({ row, onClose, onSaved }) {
  const { user } = useAuth()
  const [v, setV] = useState({
    name: row?.name || '', username: row?.username || '', password: '', role: row?.role || 'Staff',
    active: row ? row.active : true, must_change_password: row ? row.must_change_password : true, personnel_scope_all: row?.personnel_scope_all || false,
  })
  const [perms, setPerms] = useState(row?.permissions && Object.keys(row.permissions).length ? row.permissions : defaultPerms(row?.role || 'Staff'))
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const isAdminRole = v.role === 'Administrator'

  async function save(e) {
    e.preventDefault(); setErr('')
    if (!v.name.trim() || !v.username.trim()) return setErr('Name and username are required.')
    if (!row && v.password.length < 8) return setErr('Temporary password must be at least 8 characters.')
    if (v.password && v.password.length < 8) return setErr('Password must be at least 8 characters.')
    setBusy(true)
    try {
      const body = { ...v, permissions: isAdminRole ? defaultPerms('Administrator') : perms }
      if (row) await call({ action: 'update', id: row.id, ...body, password: v.password || undefined })
      else await call({ action: 'create', ...body })
      await logAction(user, row ? 'Edit' : 'Add', 'users', `${row ? 'Edited' : 'Created'} user ${v.username}`)
      onSaved()
    } catch (ex) { setErr(ex.message); setBusy(false) }
  }
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} USER ACCOUNT`} onClose={onClose}>
      <form className="formgrid" onSubmit={save}>
        <div className="field"><label>Full Name</label><input value={v.name} onChange={set('name')} /></div>
        <div className="field"><label>Username</label><input value={v.username} onChange={set('username')} /></div>
        <div className="field"><label>{row ? 'New Password (leave blank to keep current)' : 'Temporary Password'}</label><input value={v.password} onChange={set('password')} placeholder={row ? 'Leave blank to keep unchanged' : 'At least 8 characters'} /></div>
        <div className="field"><label>Role</label>
          <select value={v.role} onChange={(e) => { set('role')(e); setPerms(defaultPerms(e.target.value)) }}><option>Administrator</option><option>Staff</option><option value="Guest">Guest</option></select></div>
        <div className="field"><label>Account Status</label><select value={v.active ? 'Active' : 'Disabled'} onChange={(e) => setV({ ...v, active: e.target.value === 'Active' })}><option>Active</option><option>Disabled</option></select></div>
        <div className="field"><label>Require password change on next login</label><select value={v.must_change_password ? 'Yes' : 'No'} onChange={(e) => setV({ ...v, must_change_password: e.target.value === 'Yes' })}><option>Yes</option><option>No</option></select></div>
        <div className="field"><label>Personnel Edit Scope</label><select value={v.personnel_scope_all ? 'Yes' : 'No'} onChange={(e) => setV({ ...v, personnel_scope_all: e.target.value === 'Yes' })}><option value="No">Edit own profile only</option><option value="Yes">Edit all personnel profiles</option></select></div>
        {isAdminRole
          ? <div className="field full"><div className="note">Administrators automatically have full view/add/edit/delete access to every section, plus User Management and Backup/Restore.</div></div>
          : <div className="field full"><label>Section Permissions</label>
              <div className="small" style={{ marginBottom: 6 }}>Tick exactly what this account may do in each section. Guests are typically View only. Office Fund is always admin-only for changes. <button type="button" className="btn secondary small" onClick={() => setPerms(defaultPerms(v.role))}>Reset to role defaults</button></div>
              <PermMatrix perms={perms} setPerms={setPerms} /></div>}
        {err && <div className="field full error">{err}</div>}
        <div className="field full"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save User'}</button> <button type="button" className="btn secondary" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user } = useAuth()
  const { rows, reload } = useRows('profiles', { order: 'name', asc: true })
  const [form, setForm] = useState(null)
  async function reset(x) {
    const np = prompt(`Enter a new temporary password for ${x.name} (min. 8 characters):`)
    if (!np) return
    if (np.length < 8) return alert('Password must be at least 8 characters.')
    try { await call({ action: 'reset_password', id: x.id, password: np }); await logAction(user, 'Edit', 'users', `Reset password for ${x.username}`); alert('Password reset. The user must set a new password on next login.'); reload() } catch (e) { alert(e.message) }
  }
  async function del(x) {
    if (!confirm('Delete this user account? The linked PSTO Personnel profile and its submitted-document records will also be deleted.')) return
    try { await call({ action: 'delete', id: x.id }); await logAction(user, 'Delete', 'users', `Deleted user ${x.username}`); reload() } catch (e) { alert(e.message) }
  }
  return (
    <>
      <div className="topbar"><div><h1>USER MANAGEMENT</h1><div className="sub">Administrator controls who can access the system and exactly what each person can see and do.</div></div></div>
      <div className="panel">
        <div className="toolbar"><button className="btn" onClick={() => setForm({})}>+ Add User</button></div>
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Password</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((x) => (
            <tr key={x.id}><td>{x.name}</td><td>{x.username}</td><td>{x.role}</td>
              <td>{x.active ? <span className="badge ok">Active</span> : <span className="badge warn">Disabled</span>}</td>
              <td>{x.must_change_password ? <span className="badge warn">Must change on next login</span> : <span className="badge muted-badge">Set by user</span>}</td>
              <td><button className="btn secondary small" onClick={() => setForm({ row: x })}>Edit</button> <button className="btn orange small" onClick={() => reset(x)}>Reset Password</button> {x.id !== user.id && <button className="btn danger small" onClick={() => del(x)}>Delete</button>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      {form && <UserForm row={form.row} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </>
  )
}
