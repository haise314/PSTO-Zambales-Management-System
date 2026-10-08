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
  // stop the page behind the drawer from scrolling on phones
  useEffect(() => { document.body.classList.toggle('noscroll', open); return () => document.body.classList.remove('noscroll') }, [open])

  // Mobile: tables become stacked cards. Copy each column heading onto its cells (data-label)
  // so CSS can show "Heading: value" per row. Runs on every page without touching the page files.
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let raf = 0
    const label = () => {
      main.querySelectorAll('.tablewrap table:not(.leavesum-table)').forEach((t) => {
        const heads = Array.from(t.querySelectorAll('thead th')).map((th) => (th.childNodes[0]?.textContent || '').trim())
        if (!heads.length) return
        t.classList.add('rt')
        t.parentElement.classList.add('rt-wrap')
        t.querySelectorAll('tbody tr').forEach((tr) =>
          Array.from(tr.children).forEach((td, i) => { if (td.dataset.label !== (heads[i] || '')) td.dataset.label = heads[i] || '' }))
      })
    }
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(label) }
    const mo = new MutationObserver(run)
    mo.observe(main, { childList: true, subtree: true })
    run()
    return () => { mo.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const items = NAV.filter((i) => (i.adminOnly ? isAdmin : i.always || can(i.key, 'view')))
  const path = (k) => (k === 'dashboard' ? '/' : '/' + k)
  const link = (k, label) => <button key={k} className={loc.pathname === path(k) ? 'active' : ''} onClick={() => nav(path(k))}>{label}</button>

  return (
    <>
      <header>
        <button className="btn secondary small mobile" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <img className="logo-img" src="/logo.jpg" alt="DOST Central Luzon logo" />
        <div className="head-text">
          <div className="head1">Department of Science and Technology - Central Luzon</div>
          <div className="head2">Provincial Science and Technology Office of Zambales</div>
          <div className="head3">DATABASE</div>
        </div>
        <div className="head-right">
          <button className="btn secondary small" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>{dark ? '☀️' : '🌙'}<span className="hide-sm">{dark ? ' Light' : ' Dark'}</span></button>
          <div className="headuser">{profile.name} • {profile.role}</div>
        </div>
      </header>
      <div className={`app ${open ? 'navopen' : ''}`}>
        <nav>
          <div className="navuser">{profile.name} • {profile.role}</div>
          <button className="mobile" onClick={() => setOpen(false)}>✕ CLOSE MENU</button>
          {items.map((i) => link(i.key, i.label))}
          {!isGuest && link('account', '⚙️ MY ACCOUNT')}
          <button onClick={logout}>🚪 LOG OUT</button>
        </nav>
        <div className="navback" onClick={() => setOpen(false)} />
        <main>{children}</main>
      </div>
      <LightboxHost />
    </>
  )
}