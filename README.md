# Game Payment Tracker

Live, multi-device ledger for who owes whom across card-game sessions (built for Teen Patti, works for any game).
The master records each game's final win/loss amounts; everyone else views results on their own phone.

- `npm install && npm start` — builds the app and runs the server on http://localhost:8787 (`PORT` to change).
- Press **Create game** (you become the master) and share the invite link; others enter a name and join read-only.
- From phones use your LAN IP or a tunnel (ngrok / cloudflared). State is saved to `data/rooms.json`.
- Results can be exported as a PNG and sent to players via WhatsApp links (master only).
- Dev: `npm run dev:server` + `npm run dev`. Tests: `npm test`. Live sync check: `node scripts/smoke.mjs`.
