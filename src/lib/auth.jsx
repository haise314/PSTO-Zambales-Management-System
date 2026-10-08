import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, emailFor } from './supabase'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [me, setMe] = useState(null) // the signed-in user's own personnel record
  const [ready, setReady] = useState(false)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setMe(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (!data || !data.active) { await supabase.auth.signOut(); setProfile(null); setMe(null); return }
    setProfile(data)
    const { data: p } = await supabase.from('personnel').select('*').eq('user_id', uid).maybeSingle()
    setMe(p)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => { await loadProfile(data.session?.user.id); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setTimeout(() => loadProfile(s?.user.id), 0) })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value = useMemo(() => {
    const isAdmin = profile?.role === 'Administrator'
    return {
      ready, profile, me,
      user: profile && { id: profile.id, name: profile.name, role: profile.role },
      isAdmin, isGuest: profile?.role === 'Guest',
      can: (tab, action) => isAdmin || !!profile?.permissions?.[tab]?.[action],
      async login(username, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: emailFor(username), password })
        if (error) console.error('Login error:', error)
        return error ? `${error.message} (${error.status || 'no status'})` : ''
      },
      logout: () => supabase.auth.signOut(),
      reload: () => loadProfile(profile?.id),
    }
  }, [ready, profile, me, loadProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
