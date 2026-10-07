import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ITEMS = [['PSTO Personnel', 'personnel', 'personnel'], ['Activities', 'calendar_events', 'calendar'], ['Attendance', 'attendance', 'attendance'], ['Leave Records', 'leave_records', 'leave'],
  ['Contacts', 'contacts', 'contacts'], ['Memos', 'memos', 'memos'], ['Trainings', 'trainings', 'trainings'], ['Emails', 'email_records', 'email'],
  ['Office Fund Entries', 'funds', 'funds'], ['Documentations', 'documentation', 'documentation']]

export default function Overview() {
  const nav = useNavigate()
  const [n, setN] = useState({})
  useEffect(() => {
    ITEMS.forEach(([, t]) => supabase.from(t).select('id', { count: 'exact', head: true }).then(({ count }) => setN((s) => ({ ...s, [t]: count ?? 0 }))))
  }, [])
  return (
    <>
      <div className="topbar"><div><h1>OVERVIEW</h1><div className="sub">Summary of records in the database</div></div></div>
      <div className="cardgrid">
        {ITEMS.map(([label, t, page]) => <div className="card" style={{ cursor: 'pointer' }} key={t} onClick={() => nav('/' + page)}><div className="num">{n[t] ?? '…'}</div><div className="label">{label}</div></div>)}
      </div>
    </>
  )
}
