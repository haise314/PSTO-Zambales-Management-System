# PSTO Zambales DATABASE — React + Supabase

DOST Central Luzon · Provincial Science and Technology Office of Zambales.
The former single `Database.html` is now a Vite + React app with a Supabase backend
(Postgres, Auth, Storage, Row Level Security, one Edge Function).

```
src/            React app (pages/, components/, lib/)
supabase/
  schema.sql                       tables, triggers, RLS policies, storage bucket
  functions/admin-users/index.ts   admin-only account management (uses service-role key)
public/logo.jpg                    DOST logo (extracted from the old file)
```

## 1. Create the Supabase project
1. Create a project at supabase.com.
2. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up" and **off** "Confirm email".
   Accounts are created only by an administrator inside the app.
3. **SQL Editor**: paste and run `supabase/schema.sql`.

## 2. Deploy the admin edge function
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy admin-users
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## 3. Create the first administrator
1. **Authentication → Users → Add user**: email `admin@psto.local`, choose a strong password, tick "Auto Confirm User".
2. In the SQL Editor run the two commented statements at the bottom of `schema.sql`
   (they create the `profiles` row and the matching PSTO Personnel record).
3. Log in with username `admin`. Add everyone else from **User Management**.

Usernames map to `username@psto.local` in Supabase Auth; staff never need a real email.

## 4. Run locally
```bash
cp .env.example .env      # fill in Project URL + anon key (Settings → API)
npm install
npm run dev
```

## 5. Deploy
Any static host works. `vercel.json` and `netlify.toml` already contain the SPA rewrite.
- **Vercel / Netlify**: import the repo, build command `npm run build`, output `dist`,
  add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
- Afterwards, in Supabase **Authentication → URL Configuration**, set the Site URL to your deployed address.

## What changed from the single-file version
- **Real security.** Passwords are no longer stored in the browser. Permissions (view/add/edit/delete per section,
  owner-only edits, admin-only Office Fund, Guest decoy QR codes, private document links) are enforced by
  Postgres Row Level Security, not just hidden in the UI.
- **Shared data.** Records live in Postgres instead of each browser's localStorage, so everyone sees the same data.
- **Files** go to a private Storage bucket (`attachments`) and are served through short-lived signed URLs.
- **Leave → Calendar sync** and **personnel renames** now run as database triggers.
- **Deletes** are archived in `trash` (admin: Backup / Restore → Recently Deleted).
- Password minimum is now 8 characters. A hamburger button was added to the header so the menu is reachable on phones.
- In the old file, the calendar and focal-person checks looked for a role called `User`, which doesn't exist, so only
  administrators could manage them. Now Staff can edit calendar activities they own or are tagged on, and Staff with
  "Focal Person → Add" permission can manage focal assignments. Change `calendar_tagged_*` / `focal_write` in `schema.sql` to restore the old behavior.

## Known limitations
- Old browser data does not migrate automatically (the previous release also reset data on load). Re-enter it or use each
  section's **Import CSV**. The JSON backup format is different from the old one.
- Guests are hidden from contact numbers, birthdates and home addresses in the UI only; those columns are still readable
  by any account that has view access to the section. Split them into a restricted table if that matters.
- The JSON backup holds records, not file attachments; use Supabase backups for Storage.
