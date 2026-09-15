# Oslo Pilates

Website panel for Oslo Pilates students and instructors. Visual language stays in soft pink tones. In production, Supabase is the canonical data store; Netlify Blobs and the local JSON files remain fallback storage for development or recovery.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Login

Scan the student or instructor QR on the home page, or open the login form. Demo **Giriş yap** does not check the password.

- Student: `merve@oslo` / `pilates`
- Admin: `admin@oslo` / `studio`

For Supabase-backed production, configure `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. The browser `localStorage` copy is only a short-lived UI cache and is never the source of truth.

WhatsApp number: set `WHATSAPP_E164` in `src/lib/studio.ts`.
