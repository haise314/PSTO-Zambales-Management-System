import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env')

export const supabase = createClient(url || 'http://localhost', key || 'missing')
// Users sign in with a username; Supabase Auth stores it as a pseudo-email.
export const emailFor = (username) => `${username.trim().toLowerCase()}@psto.local`
