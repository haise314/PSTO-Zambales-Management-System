import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import Calendar from './pages/Calendar'
import Personnel from './pages/Personnel'
import Focal from './pages/Focal'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Backup from './pages/Backup'
import Account from './pages/Account'
import { Attendance, Leave, Contacts, Memos, Trainings, EmailTracker, Documentation, Funds } from './pages/Modules'

function Restricted({ msg }) {
  return <div className="panel"><h2>Access restricted</h2><p>{msg || 'You do not have permission to view this section. Contact your system administrator.'}</p></div>
}
function Guard({ tab, admin, children }) {
  const { can, isAdmin } = useAuth()
  if (admin) return isAdmin ? children : <Restricted msg="Only administrators can access this section." />
  return can(tab, 'view') ? children : <Restricted />
}

function Login() {
  const { login } = useAuth()
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('')
    setErr(await login(u, p)); setBusy(false)
  }
  return (
    <div className="login"><form className="loginbox" onSubmit={go}>
      <img className="loginlogo" src="/logo.jpg" alt="DOST Central Luzon logo" />
      <h1 style={{ textAlign: 'center' }}>DATABASE LOGIN</h1>
      <div className="sub" style={{ textAlign: 'center' }}>PSTO Zambales Office Management System</div>
      <div className="field"><label>Username</label><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus /></div>
      <div className="field"><label>Password</label><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></div>
      <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'LOG IN'}</button>
      <div className="error">{err}</div>
    </form></div>
  )
}

function ForcePassword() {
  const { reload, logout } = useAuth()
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [err, setErr] = useState('')
  async function go(e) {
    e.preventDefault()
    if (p1.length < 8) return setErr('Password must be at least 8 characters.')
    if (p1 !== p2) return setErr('Passwords do not match.')
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return setErr(error.message)
    await supabase.rpc('clear_must_change_password')
    await reload()
  }
  return (
    <div className="login"><form className="loginbox" onSubmit={go}>
      <img className="loginlogo" src="/logo.jpg" alt="DOST Central Luzon logo" />
      <h1 style={{ textAlign: 'center' }}>Set a New Password</h1>
      <div className="sub" style={{ textAlign: 'center' }}>Your administrator requires you to set a new password before continuing.</div>
      <div className="field"><label>New Password</label><input type="password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
      <div className="field"><label>Confirm New Password</label><input type="password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      <button className="btn" style={{ width: '100%' }}>SAVE &amp; CONTINUE</button>{' '}
      <button className="btn secondary" type="button" style={{ width: '100%', marginTop: 8 }} onClick={logout}>Log out</button>
      <div className="error">{err}</div>
    </form></div>
  )
}

export default function App() {
  const { ready, profile } = useAuth()
  if (!ready) return <div className="login"><div className="loginbox">Loading…</div></div>
  if (!profile) return <Login />
  if (profile.must_change_password) return <ForcePassword />
  const g = (tab, el) => <Guard tab={tab}>{el}</Guard>
  const a = (el) => <Guard admin>{el}</Guard>
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/calendar" element={g('calendar', <Calendar />)} />
        <Route path="/attendance" element={g('attendance', <Attendance />)} />
        <Route path="/leave" element={g('leave', <Leave />)} />
        <Route path="/trainings" element={g('trainings', <Trainings />)} />
        <Route path="/email" element={g('email', <EmailTracker />)} />
        <Route path="/memos" element={g('memos', <Memos />)} />
        <Route path="/documentation" element={g('documentation', <Documentation />)} />
        <Route path="/contacts" element={g('contacts', <Contacts />)} />
        <Route path="/focal" element={g('focal', <Focal />)} />
        <Route path="/personnel" element={g('personnel', <Personnel />)} />
        <Route path="/funds" element={g('funds', <Funds />)} />
        <Route path="/audit" element={a(<Audit />)} />
        <Route path="/users" element={a(<Users />)} />
        <Route path="/backup" element={a(<Backup />)} />
        <Route path="/account" element={profile.role === 'Guest' ? <Restricted msg="Guest accounts do not manage their own password. Contact your system administrator." /> : <Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
