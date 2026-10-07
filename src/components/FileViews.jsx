import { useEffect, useState } from 'react'
import { signedUrl, useSignedUrl, showLightbox } from '../lib/files'

export function LightboxHost() {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    const h = (e) => setSrc(e.detail)
    window.addEventListener('lightbox', h)
    return () => window.removeEventListener('lightbox', h)
  }, [])
  if (!src) return null
  return (
    <div className="lightbox show" onClick={(e) => e.target === e.currentTarget && setSrc(null)}>
      <button className="lb-close" onClick={() => setSrc(null)}>✕</button>
      <img src={src} alt="Preview" />
    </div>
  )
}

export function SignedImg({ path, className, alt }) {
  const url = useSignedUrl(path)
  if (!path) return null
  return url ? <img className={className} src={url} alt={alt} title="Click to enlarge" onClick={() => showLightbox(url)} /> : null
}

async function download(f) {
  const u = await signedUrl(f.path, f.name)
  if (!u) return alert('Could not create a download link.')
  const a = document.createElement('a'); a.href = u; document.body.appendChild(a); a.click(); a.remove()
}

function FileItem({ f }) {
  const isImg = String(f.type || '').startsWith('image/')
  const url = useSignedUrl(isImg ? f.path : null)
  return (
    <span className="file-action">
      {isImg && url ? <img className="file-thumb" src={url} alt={f.name} title="Click to enlarge" onClick={() => showLightbox(url)} /> : <b>{f.name}</b>}
      <button className="btn secondary small" onClick={() => download(f)}>Download</button>
    </span>
  )
}

export function FileList({ files }) {
  if (!files?.length) return <span className="small">—</span>
  return <div className="filelist">{files.map((f) => <FileItem key={f.path} f={f} />)}</div>
}

// controlled picker used inside forms: value = { existing: [files], removed: [paths], add: [File] }
export const emptyFiles = (existing = []) => ({ existing, removed: [], add: [] })

export function FilesField({ label, value, onChange }) {
  const toggle = (path, keep) =>
    onChange({ ...value, removed: keep ? value.removed.filter((p) => p !== path) : [...value.removed, path] })
  return (
    <div className="field full">
      <label>{label}</label>
      <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        onChange={(e) => onChange({ ...value, add: Array.from(e.target.files) })} />
      <div className="small">Select several files at once (hold Ctrl/Cmd). Files are stored securely in Supabase Storage.</div>
      {value.existing.length > 0 && (
        <>
          <div className="filelist-edit">
            {value.existing.map((f) => (
              <label className="filechip" key={f.path}>
                <input type="checkbox" checked={!value.removed.includes(f.path)} onChange={(e) => toggle(f.path, e.target.checked)} />
                📎 {f.name}
              </label>
            ))}
          </div>
          <div className="small">Untick a file to remove it when you save.</div>
        </>
      )}
    </div>
  )
}
