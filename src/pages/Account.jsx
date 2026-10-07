import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, emailFor } from '../lib/supabase'
import { PersonnelForm } from './Personnel'

export default function Account() {
  const { profile, me, reload } = useAuth()
  const [cur, setCur] = useState(''), [p1, setP1] = useState(''), [p2, setP2] = useState('')
  const [msg, setMsg] = useState({ t: '', err: false })
  const [edit, setEdit] = useState(false)
  async function change(e) {
    e.preventDefault()
    const bad = (t) => setMsg({ t, err: true })
    if (p1.length < 8) return bad('New password must be at least 8 characters.')
    if (p1 !== p2) return bad('New passwords do not match.')
    const { error: ve } = await supabase.auth.signInWithPassword({ email: emailFor(profile.username), password: cur })
    if (ve) return bad('Current password is incorrect.')
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return bad(error.message)
    setMsg({ t: 'Password updated successfully.', err: false }); setCur(''); setP1(''); setP2('')
  }
  return (
    <>
      <div className="topbar"><div><h1>MY ACCOUNT</h1><div className="sub">Manage your login password and your own PSTO Personnel profile.</div></div></div>
      <div className="panel"><h2>Change Password</h2>
        <form className="formgrid" onSubmit={change}>
          <div className="field"><label>Current Password</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div><div className="field" />
          <div className="field"><label>New Password</label><input type="password" value={p1} onChange={(e) => setP1(e.target.value)} required /></div>
          <div className="field"><label>Confirm New Password</label><input type="password" value={p2} onChange={(e) => setP2(e.target.value)} required /></div>
          <div className="field full"><button className="btn">Update Password</button></div>
          <div className={`field full small ${msg.err ? 'error' : ''}`}>{msg.t}</div>
        </form></div>
      <div className="panel"><h2>My PSTO Personnel Profile</h2>
        {me ? <><p>Keep your name, designation, employee ID, contact numbers, email, and assigned color up to date.</p><button className="btn" onClick={() => setEdit(true)}>Edit My Profile</button></>
          : <p className="small">No linked personnel profile found. Contact your system administrator.</p>}</div>
      {edit && <PersonnelForm row={me} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload() }} />}
    </>
  )
}
