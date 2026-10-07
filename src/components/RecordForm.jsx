import { useState } from 'react'
import { useRows } from '../lib/db'
import { uploadFile, removeFiles } from '../lib/files'
import { FilesField, emptyFiles, SignedImg } from './FileViews'

/*
 Field config: { key, label, type, options, required, full, showIf(values), default }
 types: text date time number email url textarea select personnelSelect personnelMulti files image stringList
*/
export default function RecordForm({ fields, initial = {}, onSubmit, onCancel, folder = 'misc', submitLabel = 'Save Record', extra }) {
  const { rows: people } = useRows('personnel', { order: 'name', asc: true })
  const [v, setV] = useState(() => {
    const o = { ...initial }
    fields.forEach((f) => {
      if (f.type === 'files') o[f.key] = emptyFiles(initial[f.key] || [])
      else if (f.type === 'image') o[f.key] = { path: initial[f.key] || null, file: null }
      else if (f.type === 'stringList') o[f.key] = initial[f.key]?.length ? initial[f.key] : ['']
      else if (f.type === 'personnelMulti') o[f.key] = initial[f.key] || []
      else if (o[f.key] == null) o[f.key] = f.default ?? (f.type === 'select' ? f.options[0] : '')
    })
    return o
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))
  const shown = (f) => !f.showIf || f.showIf(v)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    for (const f of fields) {
      if (f.required && shown(f) && !String(v[f.key] ?? '').trim()) return setErr(`${f.label.replace(' *', '')} is required.`)
    }
    setBusy(true)
    const out = {}
    const cleanup = []
    try {
      for (const f of fields) {
        const val = v[f.key]
        if (!shown(f)) { out[f.key] = f.type === 'stringList' ? [] : f.type === 'files' ? [] : null; continue }
        if (f.type === 'files') {
          const uploaded = []
          for (const file of val.add) uploaded.push(await uploadFile(file, folder))
          out[f.key] = [...val.existing.filter((x) => !val.removed.includes(x.path)), ...uploaded]
          cleanup.push(...val.removed)
        } else if (f.type === 'image') {
          if (val.file) { out[f.key] = (await uploadFile(val.file, f.folder || folder)).path; if (initial[f.key]) cleanup.push(initial[f.key]) }
          else { out[f.key] = val.path; if (!val.path && initial[f.key]) cleanup.push(initial[f.key]) }
        } else if (f.type === 'stringList') out[f.key] = val.map((s) => s.trim()).filter(Boolean)
        else if (f.type === 'personnelMulti') out[f.key] = val
        else if (f.type === 'personnelId') out[f.key] = val === '' || val == null ? null : Number(val)
        else if (['date', 'time'].includes(f.type)) out[f.key] = val || null
        else if (f.type === 'number') out[f.key] = val === '' ? null : Number(val)
        else out[f.key] = val
      }
      await onSubmit(out)
      await removeFiles(cleanup)
    } catch (ex) {
      setErr(ex.message || String(ex))
      setBusy(false)
    }
  }

  return (
    <form className="formgrid" onSubmit={submit}>
      {fields.filter(shown).map((f) => {
        const val = v[f.key]
        if (f.type === 'files') return <FilesField key={f.key} label={f.label} value={val} onChange={(x) => set(f.key, x)} />
        const wrap = (child, cls = '') => <div key={f.key} className={`field ${f.full || f.type === 'textarea' || f.type === 'personnelMulti' || f.type === 'stringList' ? 'full' : ''} ${cls}`}><label>{f.label}</label>{child}</div>
        if (f.type === 'textarea') return wrap(<textarea value={val} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />)
        if (f.type === 'select') return wrap(<select value={val} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>)
        if (f.type === 'personnelSelect')
          return wrap(<select value={val} onChange={(e) => set(f.key, e.target.value)}><option value="">None</option>{people.map((p) => <option key={p.id}>{p.name}</option>)}</select>)
        if (f.type === 'personnelId')
          return wrap(<select value={val ?? ''} onChange={(e) => set(f.key, e.target.value)}><option value="">None / External</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)
        if (f.type === 'personnelMulti')
          return wrap(
            <div className="persontags">
              {people.map((p) => (
                <label key={p.id}>
                  <input type="checkbox" checked={val.includes(p.id)} onChange={(e) => set(f.key, e.target.checked ? [...val, p.id] : val.filter((i) => i !== p.id))} />
                  <span className="color-dot" style={{ background: p.color || '#2563eb' }} />{p.name}
                </label>
              ))}
              {!people.length && <span className="small">No personnel encoded yet.</span>}
            </div>
          )
        if (f.type === 'stringList')
          return wrap(
            <>
              {val.map((s, i) => (
                <div className="phone-row" key={i}>
                  <input type={f.inputType || 'text'} value={s} placeholder={f.placeholder} onChange={(e) => set(f.key, val.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className="btn secondary small" onClick={() => set(f.key, val.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className="btn secondary small" onClick={() => set(f.key, [...val, ''])}>+ Add another</button>
            </>
          )
        if (f.type === 'image')
          return wrap(
            <>
              <input type="file" accept="image/*" onChange={(e) => set(f.key, { ...val, file: e.target.files[0] || null })} />
              {f.hint && <div className="small">{f.hint}</div>}
              {val.path && !val.file && (
                <div style={{ marginTop: 7 }}>
                  <SignedImg path={val.path} className="person-photo" alt={f.label} />{' '}
                  <button type="button" className="btn secondary small" onClick={() => set(f.key, { path: null, file: null })}>Remove</button>
                </div>
              )}
            </>
          )
        if (f.type === 'color') return wrap(<input className="colorinput" type="color" value={val || '#2563eb'} onChange={(e) => set(f.key, e.target.value)} />)
        return wrap(<input type={f.type || 'text'} value={val ?? ''} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined} onChange={(e) => set(f.key, e.target.value)} />)
      })}
      {extra}
      {err && <div className="field full error">{err}</div>}
      <div className="field full">
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>{' '}
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
