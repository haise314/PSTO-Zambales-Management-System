import { useState } from 'react'
import Modal from '../components/Modal'
import RecordForm from '../components/RecordForm'
import { FileList } from '../components/FileViews'
import { useAuth } from '../lib/auth'
import { useRows, saveRow, deleteRow, logAction } from '../lib/db'
import { CAL_CATS, CAT_COLORS } from '../lib/constants'
import { iso, today, addDays, startOfWeek, fmtShort, dateRangeText } from '../lib/utils'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const eventColor = (x) => CAT_COLORS[x.category] || '#64748b'

export default function Calendar() {
  const { user, can, isAdmin, me, profile } = useAuth()
  const { rows: events, reload } = useRows('calendar_events', { order: 'start_date', asc: true })
  const { rows: people } = useRows('personnel', { order: 'name', asc: true })
  const [mode, setMode] = useState('month')
  const [d, setD] = useState(() => new Date())
  const [fp, setFp] = useState(''), [fc, setFc] = useState('')
  const [form, setForm] = useState(null)

  const evs = events.filter((x) => (!fp || (x.person_ids || []).map(String).includes(fp)) && (!fc || x.category === fc))
  const on = (ds) => evs.filter((x) => ds >= x.start_date && ds <= (x.end_date || x.start_date))
  const manage = (x) => isAdmin || x.added_by === user.id || (profile.role === 'Staff' && me && (x.person_ids || []).includes(me.id))
  const who = (x) => { const n = people.filter((p) => (x.person_ids || []).includes(p.id)).map((p) => p.name); return n.length ? n.join(', ') : 'Office-wide' }
  const open = (x) => (x ? (manage(x) ? setForm({ row: x }) : alert('You can only edit activities assigned to you.')) : setForm({}))

  const move = (n) => {
    if (mode === 'month') setD(new Date(d.getFullYear(), d.getMonth() + n, 1))
    else if (mode === 'year') setD(new Date(d.getFullYear() + n, 0, 1))
    else if (mode === 'day') setD(addDays(d, n))
    else setD(addDays(d, n * 7))
  }
  const title = mode === 'month' ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : mode === 'year' ? String(d.getFullYear())
    : mode === 'day' ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : `${fmtShort(startOfWeek(d))} – ${fmtShort(addDays(startOfWeek(d), 6))}`

  const Dots = ({ x }) => {
    const t = people.filter((p) => (x.person_ids || []).includes(p.id)).slice(0, 4)
    return t.length ? <span className="tagdots">{t.map((p) => <span key={p.id} style={{ background: p.color || '#94a3b8' }} />)}</span> : null
  }

  function Month() {
    const y = d.getFullYear(), m = d.getMonth(), off = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), prev = new Date(y, m, 0).getDate()
    return (
      <div className="month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((x) => <div key={x} className="week-head">{x}</div>)}
        {Array.from({ length: 42 }, (_, i) => {
          const dn = i - off + 1
          const muted = dn < 1 || dn > n
          const dt = dn < 1 ? new Date(y, m - 1, prev + dn) : dn > n ? new Date(y, m + 1, dn - n) : new Date(y, m, dn)
          const ds = iso(dt), ev = on(ds)
          return (
            <div key={i} className={`day ${muted ? 'muted-day' : ''} ${ds === today() ? 'today' : ''}`} onDoubleClick={() => can('calendar', 'add') && setForm({ defaults: { start_date: ds, end_date: ds } })}>
              <div className="daynum">{dt.getDate()}</div>
              {ev.slice(0, 5).map((x) => <div key={x.id} className="event-chip" style={{ background: eventColor(x) }} title={`${x.title} — ${who(x)}`} onClick={() => open(x)}><Dots x={x} />{x.time ? x.time.slice(0, 5) + ' ' : ''}{x.title}</div>)}
              {ev.length > 5 && <div className="small">+{ev.length - 5} more</div>}
            </div>
          )
        })}
      </div>
    )
  }
  function Week() {
    const s = startOfWeek(d)
    return (
      <div className="week-grid">
        <div className="wkhead">Time</div>
        {Array.from({ length: 7 }, (_, i) => { const x = addDays(s, i); return <div key={i} className="wkhead">{x.toLocaleString('en-US', { weekday: 'short' })}<br />{x.getMonth() + 1}/{x.getDate()}</div> })}
        {Array.from({ length: 12 }, (_, k) => k + 7).map((h) => [
          <div key={'t' + h} className="time-label">{String(h).padStart(2, '0')}:00</div>,
          ...Array.from({ length: 7 }, (_, i) => {
            const ds = iso(addDays(s, i))
            return <div key={h + '-' + i}>{on(ds).filter((x) => !x.time || parseInt(x.time) === h).map((x) => <div key={x.id} className="week-event" style={{ background: eventColor(x) }} onClick={() => open(x)}>{x.title}<br /><span style={{ opacity: .85 }}>{who(x)}</span></div>)}</div>
          }),
        ])}
      </div>
    )
  }
  function Day() {
    const ev = on(iso(d)).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    if (!ev.length) return <div className="day-list"><div className="empty">No activities for this day.</div></div>
    return <div className="day-list">{ev.map((x) => <div key={x.id} className="day-event" style={{ borderLeftColor: eventColor(x) }} onClick={() => open(x)}><b>{x.time ? x.time.slice(0, 5) : 'All day'}</b> — {x.title} <span className="badge">{x.category}</span><br /><span className="small">{who(x)}{x.venue ? ` • ${x.venue}` : ''}</span></div>)}</div>
  }
  function Year() {
    const y = d.getFullYear()
    return (
      <div className="year-grid">
        {Array.from({ length: 12 }, (_, m) => {
          const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate()
          return (
            <div key={m} className="mini-month"><div className="mini-title">{MONTHS[m]}</div>
              <div className="mini-days">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i}><b>{x}</b></span>)}
                {Array.from({ length: first }, (_, i) => <span key={'e' + i} />)}
                {Array.from({ length: n }, (_, i) => {
                  const ev = on(iso(new Date(y, m, i + 1)))
                  return <span key={i} className={ev.length ? 'mini-event-day' : ''} style={ev.length ? { background: eventColor(ev[0]) } : undefined} title={ev.map((x) => x.title).join(', ')}>{i + 1}</span>
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  async function save(out) {
    if (!out.end_date) out.end_date = out.start_date
    const rec = { ...out }
    if (!form.row) rec.added_by_name = user.name
    const saved = await saveRow('calendar_events', rec, form.row?.id)
    await logAction(user, form.row ? 'Edit' : 'Add', 'calendar', `${form.row ? 'Edited' : 'Added'} activity #${saved.id}`)
    setForm(null); reload()
  }
  async function del(x) {
    if (!confirm('Delete this activity?')) return
    try { await deleteRow('calendar_events', x, user, 'calendar'); reload() } catch (e) { alert(e.message) }
  }
  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i)

  return (
    <>
      <div className="topbar"><div><h1>CALENDAR</h1><div className="sub">Visual office calendar. Tag one or more personnel on any activity. Approved leave appears automatically.</div></div></div>
      <div className="panel">
        <div className="cal-controls">
          <button className="btn secondary" onClick={() => move(-1)}>‹</button>
          <button className="btn secondary" onClick={() => { setD(new Date()); setMode('month') }}>Today</button>
          <button className="btn secondary" onClick={() => move(1)}>›</button>
          <div className="cal-title">{title}</div>
          <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select>
          <select value={d.getMonth()} onChange={(e) => setD(new Date(d.getFullYear(), +e.target.value, 1))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          <select value={d.getFullYear()} onChange={(e) => setD(new Date(+e.target.value, d.getMonth(), 1))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          {can('calendar', 'add') && <button className="btn" onClick={() => setForm({})}>+ Add Activity</button>}
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <select value={fp} onChange={(e) => setFp(e.target.value)}><option value="">All Personnel</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select value={fc} onChange={(e) => setFc(e.target.value)}><option value="">All Categories</option>{CAL_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="calendar-wrap">{mode === 'month' ? <Month /> : mode === 'week' ? <Week /> : mode === 'day' ? <Day /> : <Year />}</div>
        <div className="legend">{CAL_CATS.map((c) => <span className="legend-item" key={c}><span className="legend-dot" style={{ background: CAT_COLORS[c] }} />{c}</span>)}</div>
      </div>
      <div className="panel">
        <h2>Activity Records</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Dates</th><th>Activity</th><th>Tagged Personnel</th><th>Category</th><th>Files</th><th>Actions</th></tr></thead>
          <tbody>
            {events.map((x) => (
              <tr key={x.id}>
                <td>{dateRangeText(x.start_date, x.end_date)}</td>
                <td><b>{x.title}</b><br /><span className="small">{x.time?.slice(0, 5)} {x.venue ? `• ${x.venue}` : ''}</span></td>
                <td>{who(x)}</td>
                <td><span className="color-dot" style={{ background: eventColor(x) }} />{x.category === 'Others' && x.other_category ? `Others — ${x.other_category}` : x.category}</td>
                <td><FileList files={x.files} /></td>
                <td>{manage(x) && !x.linked_leave_id && <><button className="btn secondary small" onClick={() => setForm({ row: x })}>Edit</button> <button className="btn danger small" onClick={() => del(x)}>Delete</button></>}{x.linked_leave_id && <span className="small">From Leave</span>}</td>
              </tr>
            ))}
            {!events.length && <tr><td colSpan={6} className="empty">No calendar activities encoded.</td></tr>}
          </tbody>
        </table></div>
      </div>
      {form && (
        <Modal title={`${form.row ? 'Edit' : 'Add'} CALENDAR ACTIVITY`} onClose={() => setForm(null)}>
          <RecordForm folder="calendar" onSubmit={save} onCancel={() => setForm(null)} initial={form.row || form.defaults || {}}
            fields={[
              { key: 'title', label: 'Activity Title', required: true }, { key: 'category', label: 'Category', type: 'select', options: CAL_CATS },
              { key: 'other_category', label: 'If "Others", specify', showIf: (v) => v.category === 'Others' },
              { key: 'start_date', label: 'Start Date', type: 'date', required: true }, { key: 'end_date', label: 'End Date', type: 'date' },
              { key: 'time', label: 'Time', type: 'time' }, { key: 'venue', label: 'Venue' },
              { key: 'person_ids', label: 'Assigned Personnel (select all that apply — leave blank for office-wide)', type: 'personnelMulti' },
              { key: 'remarks', label: 'Remarks / Notes', type: 'textarea' }, { key: 'files', label: 'Attach File(s) to this Note (optional)', type: 'files' }]} />
        </Modal>
      )}
    </>
  )
}
