# Oslo Pilates

Website panel for Oslo Pilates students and instructors. Visual language stays in soft pink tones; content lives in `src/data/` so a later backend can replace the file.

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

Attendance, postponement requests, notes, and login persist in `localStorage`.

WhatsApp number: set `WHATSAPP_E164` in `src/lib/studio.ts`.
