import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMsg, RoomView } from '../src/lib/protocol';
import type { Store } from '../src/lib/types';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_FILE = path.resolve(process.env.DATA_FILE ?? 'data/rooms.json');
const DIST = path.resolve('dist');

interface Member { token: string; name: string; phone: string; master: boolean }
interface Room { code: string; members: Member[]; store: Store; rev: number }
interface Conn { room?: Room; member?: Member }

const rooms = new Map<string, Room>();
const conns = new Map<WebSocket, Conn>();

// ---------- persistence ----------
try {
  const saved: Room[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  for (const r of saved) rooms.set(r.code, r);
} catch { /* first run */ }

let saveTimer: NodeJS.Timeout | undefined;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...rooms.values()]));
  }, 300);
}

// ---------- helpers ----------
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const cleanPhone = (p: unknown) => String(p ?? '').replace(/\D/g, '').replace(/^0+/, '');
const cleanName = (n: unknown) => String(n ?? '').trim().slice(0, 30);

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const c = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    if (!rooms.has(c)) return c;
  }
}

const isOnline = (room: Room, m: Member) =>
  [...conns.values()].some((c) => c.room === room && c.member === m);

function viewFor(room: Room, m: Member): RoomView {
  return {
    t: 'state',
    code: room.code,
    rev: room.rev,
    store: m.master ? room.store : { ...room.store, contacts: {} },
    members: room.members.map((x) => ({
      name: x.name, phone: m.master ? x.phone : '', master: x.master, online: isOnline(room, x),
    })),
    you: { name: m.name, master: m.master },
  };
}

const send = (ws: WebSocket, msg: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
const err = (ws: WebSocket, message: string, fatal = false) => send(ws, { t: 'error', message, fatal });

function broadcast(room: Room) {
  for (const [ws, c] of conns) if (c.room === room && c.member) send(ws, viewFor(room, c.member));
}
function commit(room: Room) {
  room.rev++;
  save();
  broadcast(room);
}

// ---------- message handling ----------
function attach(ws: WebSocket, room: Room, member: Member) {
  conns.set(ws, { room, member });
  broadcast(room); // also refreshes everyone's "online" dots
}

function handle(ws: WebSocket, msg: ClientMsg) {
  const conn = conns.get(ws)!;

  if (msg.t === 'create') {
    const name = cleanName(msg.name);
    if (!name || !msg.token) return err(ws, 'Enter your name.');
    const room: Room = {
      code: newCode(), rev: 1,
      members: [{ token: msg.token, name, phone: cleanPhone(msg.phone), master: true }],
      store: { sessions: [], activeId: null, contacts: {} },
    };
    if (room.members[0].phone) room.store.contacts[name] = room.members[0].phone;
    rooms.set(room.code, room);
    save();
    return attach(ws, room, room.members[0]);
  }

  if (msg.t === 'join') {
    const room = rooms.get(String(msg.room ?? '').toUpperCase());
    if (!room) return err(ws, 'Game not found. Check the link or code.', true);
    let member = room.members.find((m) => m.token === msg.token);
    if (!member) {
      const name = cleanName(msg.name);
      if (!name) return send(ws, { t: 'needJoin' });
      if (room.members.some((m) => same(m.name, name))) return err(ws, 'That name is already taken in this game.');
      member = { token: msg.token, name, phone: cleanPhone(msg.phone), master: false };
      room.members.push(member);
      if (member.phone) room.store.contacts[name] = member.phone;
      room.rev++;
      save();
    }
    return attach(ws, room, member);
  }

  const { room, member } = conn;
  if (!room || !member) return err(ws, 'Join a game first.');

  switch (msg.t) {
    case 'set': {
      if (!member.master) return err(ws, 'Only the master can do that.');
      if (msg.rev !== room.rev) {
        send(ws, viewFor(room, member));
        return err(ws, 'The game changed just now. Please try again.');
      }
      room.store = msg.store;
      return commit(room);
    }
    case 'remove': {
      if (!member.master) return err(ws, 'Only the master can remove people.');
      const target = room.members.find((m) => same(m.name, msg.name) && !m.master);
      if (!target) return;
      room.members = room.members.filter((m) => m !== target);
      for (const [sock, c] of conns)
        if (c.member === target) {
          err(sock, 'You were removed from this game by the master.', true);
          conns.delete(sock);
        }
      return commit(room);
    }
  }
}

// ---------- http + ws ----------
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('Run "npm run build" first.'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  conns.set(ws, {});
  ws.on('message', (data) => {
    try {
      handle(ws, JSON.parse(String(data)) as ClientMsg);
    } catch (e) {
      err(ws, 'Bad request: ' + (e as Error).message);
    }
  });
  ws.on('close', () => {
    const c = conns.get(ws);
    conns.delete(ws);
    if (c?.room) broadcast(c.room);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Teen Patti Tracker on http://localhost:${PORT}`));
