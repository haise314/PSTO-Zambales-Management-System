import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const BUCKET = 'attachments'
const cache = new Map()

export async function uploadFile(file, folder) {
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${folder}/${crypto.randomUUID()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return { name: file.name, type: file.type || 'application/octet-stream', path }
}
export async function removeFiles(paths) {
  const p = paths.filter(Boolean)
  if (p.length) await supabase.storage.from(BUCKET).remove(p)
}
// download = filename forces a download instead of inline display
export async function signedUrl(path, download) {
  const key = path + '|' + (download || '')
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) return null
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}
export function useSignedUrl(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let ok = true
    setUrl(null)
    if (path) signedUrl(path).then((u) => ok && setUrl(u))
    return () => { ok = false }
  }, [path])
  return url
}
export const showLightbox = (url) => window.dispatchEvent(new CustomEvent('lightbox', { detail: url }))
