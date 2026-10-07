import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export async function fetchAll(table, order = 'id', asc = false) {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order, { ascending: asc }).range(from, from + 999)
    if (error) throw error
    all = all.concat(data)
    if (data.length < 1000) break
  }
  return all
}

export function useRows(table, { order = 'id', asc = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try { setRows(await fetchAll(table, order, asc)); setError('') }
    catch (e) { setError(e.message) }
    setLoading(false)
  }, [table, order, asc])
  useEffect(() => { reload() }, [reload])
  return { rows, reload, loading, error }
}

export function useSetting(key, def) {
  const [v, setV] = useState(def)
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', key).maybeSingle().then(({ data }) => data && setV(data.value))
  }, [key])
  const save = async (val) => { setV(val); await supabase.from('settings').upsert({ key, value: val }) }
  return [v, save]
}

export async function logAction(user, action, section, detail) {
  if (!user) return
  await supabase.from('audit_log').insert({ user_id: user.id, user_name: user.name, action, section, detail })
}

export async function saveRow(table, rec, editId) {
  if (editId) {
    const { data, error } = await supabase.from(table).update(rec).eq('id', editId).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(table).insert(rec).select().single()
  if (error) throw error
  return data
}

// every delete is archived to the trash table so administrators can restore it
export async function deleteRow(table, row, user, type = table) {
  await supabase.from('trash').insert({ type: table, deleted_by: user?.name, record: row })
  const { error } = await supabase.from(table).delete().eq('id', row.id)
  if (error) throw error
  await logAction(user, 'Delete', type, `Deleted record #${row.id}`)
}
