// End-to-end check: master + viewer connect; only master can change data; state syncs.
import WebSocket from 'ws';
const URL = process.env.URL ?? 'ws://localhost:8799/ws';
const client = () => new Promise((res) => {
  const ws = new WebSocket(URL); const c = { ws, view: null, errors: [] };
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') c.view = m; else c.errors.push(m); });
  ws.on('open', () => res(c));
});
const send = (c, m) => c.ws.send(JSON.stringify(m));
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exit(1); } console.log('ok  ', msg); };

const M = await client(); send(M, { t: 'create', token: 'tm', name: 'Asha', phone: '+91 98765 43210' }); await wait();
ok(M.view?.code, 'room created ' + M.view?.code);
const P = await client(); send(P, { t: 'join', room: M.view.code, token: 'tb' }); await wait();
ok(P.errors.at(-1)?.t === 'needJoin', 'unknown device is asked for a name');
send(P, { t: 'join', room: M.view.code, token: 'tb', name: 'Ben', phone: '99999' }); await wait();
ok(P.view?.you.name === 'Ben' && !P.view.you.master, 'viewer joined');
ok(M.view.members[1]?.phone === '99999' && P.view.members[0].phone === '', 'phones visible to master only');

send(P, { t: 'set', rev: P.view.rev, store: { sessions: [], activeId: 'x', contacts: {} } }); await wait();
ok(P.errors.at(-1)?.message.includes('master'), 'viewer cannot change data');
send(P, { t: 'remove', name: 'Asha' }); await wait();
ok(P.errors.at(-1)?.message.includes('master'), 'viewer cannot remove people');

const s = { id: 's1', name: 'G1', createdAt: 0, players: ['Asha', 'Ben', 'Cara'],
  games: [{ id: 'g1', at: 0, label: '', nets: { Asha: 30, Ben: -10, Cara: -20 } }] };
send(M, { t: 'set', rev: M.view.rev, store: { sessions: [s], activeId: 's1', contacts: M.view.store.contacts } }); await wait();
ok(P.view.store.sessions[0].games.length === 1, 'game synced to viewer');
send(M, { t: 'set', rev: 1, store: { sessions: [], activeId: null, contacts: {} } }); await wait();
ok(M.errors.at(-1)?.message.includes('changed'), 'stale update rejected');
send(M, { t: 'remove', name: 'Ben' }); await wait();
ok(M.view.members.length === 1, 'master removed viewer');
console.log('ALL OK'); process.exit(0);
