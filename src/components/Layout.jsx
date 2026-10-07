import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { NAV } from '../lib/constants'
import { LightboxHost } from './FileViews'

export default function Layout({ children }) {
  const { profile, can, isAdmin, isGuest, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(localStorage.getItem('pstoTheme') === 'dark')
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => { document.body.classList.toggle('dark', dark); localStorage.setItem('pstoTheme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => setOpen(false), [loc.pathname])
  const items = NAV.filter((i) => (i.adminOnly ? isAdmin : i.always || can(i.key, 'view')))
  const path = (k) => (k === 'dashboard' ? '/' : '/' + k)
  const link = (k, label) => <button key={k} className={loc.pathname === path(k) ? 'active' : ''} onClick={() => nav(path(k))}>{label}</button>

  return (
    <>
      <header>
        <button className="btn secondary small mobile" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <img className="logo-img" src="/logo.jpg" alt="DOST Central Luzon logo" />
        <div>
          <div className="head1">Department of Science and Technology - Central Luzon</div>
          <div className="head2">Provincial Science and Technology Office of Zambales</div>
          <div className="head3">DATABASE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <button className="btn secondary small" onClick={() => setDark(!dark)}>{dark ? '☀️ Light' : '🌙 Dark'}</button>
          <div className="headuser">{profile.name} • {profile.role}</div>
        </div>
      </header>
      <div className={`app ${open ? 'navopen' : ''}`}>
        <nav>
          <button className="mobile" onClick={() => setOpen(!open)}>☰ MENU</button>
          {items.map((i) => link(i.key, i.label))}
          {!isGuest && link('account', '⚙️ MY ACCOUNT')}
          <button onClick={logout}>🚪 LOG OUT</button>
        </nav>
        <main>{children}</main>
      </div>
      <LightboxHost />
    </>
  )
}
