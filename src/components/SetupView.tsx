import { useState } from 'react';
import Avatar from './Avatar';
import type { Ctx } from '../lib/ctx';
import { same } from '../lib/ctx';
import { uid } from '../lib/room';
import type { Session } from '../lib/types';

export const digits = (p: string) => p.replace(/\D/g, '').replace(/^0+/, '');

export default function SetupView({ ctx, link, onOpen }: { ctx: Ctx; link: string; onOpen: () => void }) {
  const { view, isMaster, update, me } = ctx;
  const store = view.store;
  const [name, setName] = useState(`Session ${store.sessions.length + 1}`);
  const [chosen, setChosen] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const people = Array.from(new Set([...view.members.map((m) => m.name), ...Object.keys(store.contacts)]));
  const has = (n: string) => chosen.some((o) => same(o, n));

  const addManual = () => {
    const n = newName.trim();
    if (!n) return;
    if (has(n)) return setErr('Already added.');
    setChosen([...chosen, n]);
    if (newPhone) setPhones({ ...phones, [n]: digits(newPhone) });
    setNewName('');
    setNewPhone('');
    setErr('');
  };

  const create = () => {
    if (chosen.length < 2) return setErr('Add at least two players.');
    const s: Session = { id: uid(), name: name.trim() || 'Session', createdAt: Date.now(), players: chosen, games: [] };
    update((d) => {
      d.sessions.push(s);
      d.activeId = s.id;
      Object.assign(d.contacts, phones);
    });
    setChosen([]);
    setName(`Session ${store.sessions.length + 2}`);
    onOpen();
  };

  return (
    <>
      <section className="card">
        <h2>Who's here</h2>
        <p className="muted">Share this link so everyone can view the results on their own phone:<br /><b>{link}</b></p>
        {people.map((n) => {
          const m = view.members.find((x) => x.name === n);
          return (
            <div key={n} className="row">
              <div>
                <Avatar name={n} /><span className={m?.online ? 'dot on' : 'dot'} /> <b>{n}</b>{m?.master && ' (master)'}{same(n, me) && ' (you)'}
                {isMaster && <div className="muted">{store.contacts[n] ? '+' + store.contacts[n] : 'no mobile number'}</div>}
              </div>
              {isMaster && (
                <div className="btns">
                  <button className="mini" onClick={() => {
                    const v = prompt(`Mobile number for ${n} (with country code)`, store.contacts[n] ?? '');
                    if (v !== null) update((d) => { d.contacts[n] = digits(v); });
                  }}>📱 number</button>
                  {m && !m.master && <button className="mini danger" onClick={() => confirm(`Remove ${n} from this game link?`) && ctx.send({ t: 'remove', name: n })}>Remove</button>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {isMaster ? (
        <section className="card">
          <h2>New session</h2>
          <label>Session name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <h3>Players</h3>
          <div className="btns">
            {chosen.map((n) => <button key={n} className="on" onClick={() => setChosen(chosen.filter((x) => x !== n))}>{n} ✕</button>)}
            {chosen.length === 0 && <span className="muted">Tap names below to add them.</span>}
          </div>
          <div className="btns">
            {people.filter((n) => !has(n)).map((n) => <button key={n} onClick={() => setChosen([...chosen, n])}>+ {n}</button>)}
          </div>
          <div className="grid">
            <label>Add someone without a device<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" /></label>
            <label>Mobile (optional)<input inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91…" /></label>
          </div>
          <button onClick={addManual} disabled={!newName.trim()}>Add player</button>
          {err && <p className="err">{err}</p>}
          <div className="btns"><button className="primary" onClick={create}>Create session</button></div>
        </section>
      ) : (
        <p className="card muted">Only the master can create sessions and manage players.</p>
      )}

      <section className="card">
        <h2>Sessions</h2>
        {store.sessions.length === 0 && <p className="muted">No sessions yet.</p>}
        {[...store.sessions].reverse().map((s) => (
          <div key={s.id} className={'row' + (s.id === store.activeId ? ' sel' : '')}>
            <div>
              <b>{s.name}</b>
              <div className="muted">{s.players.join(', ')} · {s.games.length} games</div>
            </div>
            <div className="btns">
              {isMaster && <button onClick={() => { update((d) => { d.activeId = s.id; }); onOpen(); }}>Open</button>}
              {isMaster && (
                <button className="danger" onClick={() => {
                  if (confirm(`Delete "${s.name}" and all its games?`))
                    update((d) => {
                      d.sessions = d.sessions.filter((x) => x.id !== s.id);
                      if (d.activeId === s.id) d.activeId = d.sessions[d.sessions.length - 1]?.id ?? null;
                    });
                }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
