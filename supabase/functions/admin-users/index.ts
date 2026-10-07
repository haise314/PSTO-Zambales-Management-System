// Edge Function: administrator-only account management (needs the service-role key, which must never reach the browser).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const emailFor = (u: string) => `${u.trim().toLowerCase()}@psto.local`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401)
  const { data: me } = await admin.from('profiles').select('role,active').eq('id', user.id).single()
  if (me?.role !== 'Administrator' || !me.active) return json({ error: 'Administrators only' }, 403)

  try {
    const b = await req.json()
    if (b.action === 'create') {
      if (!b.username || !b.password || !b.name) return json({ error: 'Name, username and password are required' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email: emailFor(b.username), password: b.password, email_confirm: true,
      })
      if (error) return json({ error: error.message }, 400)
      const { error: pe } = await admin.from('profiles').insert({
        id: data.user.id, username: b.username.trim().toLowerCase(), name: b.name, role: b.role,
        active: b.active, must_change_password: b.must_change_password,
        personnel_scope_all: b.personnel_scope_all, permissions: b.permissions,
      })
      if (pe) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: pe.message }, 400) }
      if (b.role !== 'Guest') {
        await admin.from('personnel').insert({ user_id: data.user.id, first_name: b.name, status: 'Active', phones: [], emails: [] })
      }
      return json({ ok: true })
    }
    if (b.action === 'update') {
      const patch: Record<string, unknown> = {
        name: b.name, role: b.role, active: b.active, must_change_password: b.must_change_password,
        personnel_scope_all: b.personnel_scope_all, permissions: b.permissions,
      }
      if (b.username) patch.username = b.username.trim().toLowerCase()
      const { error } = await admin.from('profiles').update(patch).eq('id', b.id)
      if (error) return json({ error: error.message }, 400)
      const auth: Record<string, unknown> = { ban_duration: b.active ? 'none' : '876000h' }
      if (b.password) auth.password = b.password
      if (b.username) auth.email = emailFor(b.username)
      const { error: ae } = await admin.auth.admin.updateUserById(b.id, auth)
      if (ae) return json({ error: ae.message }, 400)
      return json({ ok: true })
    }
    if (b.action === 'reset_password') {
      const { error } = await admin.auth.admin.updateUserById(b.id, { password: b.password })
      if (error) return json({ error: error.message }, 400)
      await admin.from('profiles').update({ must_change_password: true }).eq('id', b.id)
      return json({ ok: true })
    }
    if (b.action === 'delete') {
      if (b.id === user.id) return json({ error: 'You cannot delete your own account' }, 400)
      await admin.from('personnel').delete().eq('user_id', b.id)
      const { error } = await admin.auth.admin.deleteUser(b.id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
