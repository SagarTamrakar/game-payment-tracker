import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, RoomView, ServerMsg } from './protocol';
import type { Store } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

const TOKEN_KEY = 'tp-token';
const ROOM_KEY = 'tp-room';

export function getToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export const savedRoom = () => new URLSearchParams(location.search).get('room')?.toUpperCase() || localStorage.getItem(ROOM_KEY);
export const inviteLink = (code: string, base: string = location.origin) => `${base}/?room=${code}`;
export const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function useRoom() {
  const [view, setView] = useState<RoomView | null>(null);
  const [needJoin, setNeedJoin] = useState(false);
  const [fatal, setFatal] = useState('');
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const hello = useRef<ClientMsg | null>(null);
  const alive = useRef(true);
  const viewRef = useRef<RoomView | null>(null);

  const raw = useCallback((m: ClientMsg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  const connect = useCallback(() => {
    const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.current = sock;
    sock.onopen = () => {
      setOnline(true);
      if (hello.current) sock.send(JSON.stringify(hello.current));
    };
    sock.onmessage = (e) => {
      const m = JSON.parse(e.data) as ServerMsg;
      if (m.t === 'state') {
        viewRef.current = m;
        setView(m);
        setNeedJoin(false);
        localStorage.setItem(ROOM_KEY, m.code);
        hello.current = { t: 'join', room: m.code, token: getToken() };
      } else if (m.t === 'needJoin') setNeedJoin(true);
      else if (m.fatal) {
        localStorage.removeItem(ROOM_KEY);
        hello.current = null;
        viewRef.current = null;
        setView(null);
        setFatal(m.message);
      } else {
        setToast(m.message);
        setTimeout(() => setToast(''), 4000);
      }
    };
    sock.onclose = () => {
      setOnline(false);
      if (alive.current) setTimeout(connect, 1500);
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    connect();
    return () => {
      alive.current = false;
      ws.current?.close();
    };
  }, [connect]);

  const start = useCallback((m: ClientMsg) => {
    hello.current = m;
    setFatal('');
    raw(m);
  }, [raw]);

  const create = (name: string, phone: string) => start({ t: 'create', token: getToken(), name, phone });
  const join = (room: string, name?: string, phone?: string) =>
    start({ t: 'join', room: room.toUpperCase(), token: getToken(), name, phone });

  /** Master only: edit a copy of the shared store and push it. */
  const update = useCallback((fn: (d: Store) => void) => {
    const v = viewRef.current;
    if (!v) return;
    const draft = structuredClone(v.store);
    fn(draft);
    raw({ t: 'set', rev: v.rev, store: draft });
  }, [raw]);

  const leave = () => {
    localStorage.removeItem(ROOM_KEY);
    hello.current = null;
    viewRef.current = null;
    setView(null);
    history.replaceState(null, '', location.pathname);
  };

  return { view, needJoin, fatal, toast, online, create, join, update, send: raw, leave };
}
