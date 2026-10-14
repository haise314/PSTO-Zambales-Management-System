// supabase/functions/admin-users/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const emailFor = (username: string) => `${username.trim().toLowerCase()}@psto.local`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Identify the caller from their JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Not signed in.' }, 401)

    // 2. Admin client (bypasses RLS) - only used after the caller is verified as Administrator
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: me } = await admin.from('profiles').select('role, active').eq('id', userData.user.id).maybeSingle()
    if (!me || !me.active || me.role !== 'Administrator') return json({ error: 'Administrator access required.' }, 403)

    // 3. Handle the action
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { name, username, password, role, active, must_change_password, personnel_scope_all, permissions } = body
      if (!name?.trim() || !username?.trim()) return json({ error: 'Name and username are required.' }, 400)
      if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)

      const { data: created, error } = await admin.auth.admin.createUser({
        email: emailFor(username),
        password,
        email_confirm: true,
        user_metadata: { name: name.trim(), username: username.trim() },
      })
      if (error || !created.user) return json({ error: error?.message || 'Could not create user.' }, 400)

      // upsert in case a database trigger already created the profile row
      const { error: pErr } = await admin.from('profiles').upsert({
        id: created.user.id,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        role: role || 'Staff',
        active: active ?? true,
        must_change_password: must_change_password ?? true,
        personnel_scope_all: personnel_scope_all ?? false,
        permissions: permissions ?? {},
      })
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id) // roll back so no orphan login remains
        return json({ error: `Profile error: ${pErr.message}` }, 400)
      }
      return json({ ok: true, id: created.user.id })
    }

    if (action === 'update') {
      const { id, name, username, password, role, active, must_change_password, personnel_scope_all, permissions } = body
      if (!id) return json({ error: 'Missing user id.' }, 400)

      const authUpdate: Record<string, unknown> = {}
      if (username?.trim()) authUpdate.email = emailFor(username)
      if (password) {
        if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
        authUpdate.password = password
      }
      if (Object.keys(authUpdate).length) {
        const { error } = await admin.auth.admin.updateUserById(id, authUpdate)
        if (error) return json({ error: error.message }, 400)
      }

      const { error: pErr } = await admin.from('profiles').update({
        name: name?.trim(),
        username: username?.trim().toLowerCase(),
        role,
        active,
        must_change_password: password ? true : must_change_password,
        personnel_scope_all,
        permissions,
      }).eq('id', id)
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true })
    }

    if (action === 'reset_password') {
      const { id, password } = body
      if (!id || !password || password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: error.message }, 400)
      const { error: pErr } = await admin.from('profiles').update({ must_change_password: true }).eq('id', id)
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return json({ error: 'Missing user id.' }, 400)
      if (id === userData.user.id) return json({ error: 'You cannot delete your own account.' }, 400)

      // remove the linked personnel profile and its submitted documents
      const { data: people } = await admin.from('personnel').select('id').eq('user_id', id)
      const pids = (people ?? []).map((p: { id: number }) => p.id)
      if (pids.length) {
        await admin.from('personnel_documents').delete().in('personnel_id', pids)
        await admin.from('personnel').delete().in('id', pids)
      }
      await admin.from('profiles').delete().eq('id', id)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})