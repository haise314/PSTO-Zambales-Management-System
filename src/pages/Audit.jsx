import { useState } from 'react'
import { useRows } from '../lib/db'
import { downloadCSV, today } from '../lib/utils'

export default function Audit() {
  const { rows } = useRows('audit_log', { order: 'at' })
  const [q, setQ] = useState('')
  const list = rows.filter((x) => `${x.user_name} ${x.action} ${x.section} ${x.detail}`.toLowerCase().includes(q.toLowerCase()))
  const t = (x) => new Date(x.at).toLocaleString()
  return (
    <>
      <div className="topbar"><div><h1>AUDIT LOG</h1><div className="sub">Administrator-only history of important database actions</div></div></div>
      <div className="panel">
        <div className="toolbar">
          <input placeholder="Search audit log..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn secondary" onClick={() => downloadCSV(`PSTO-Audit-${today()}.csv`, [['Date/Time', 'User', 'Action', 'Section', 'Details'], ...list.map((x) => [t(x), x.user_name, x.action, x.section, x.detail])])}>⬇ CSV</button>
          <button className="btn secondary" onClick={() => window.print()}>🖨 Print</button>
        </div>
        <div className="tablewrap"><table>
          <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Section</th><th>Details</th></tr></thead>
          <tbody>{list.map((x) => <tr key={x.id}><td>{t(x)}</td><td>{x.user_name}</td><td>{x.action}</td><td>{x.section}</td><td>{x.detail}</td></tr>)}
            {!list.length && <tr><td colSpan={5} className="empty">No audit records yet.</td></tr>}</tbody>
        </table></div>
      </div>
    </>
  )
}
