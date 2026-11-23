import { useState } from 'react';
import { inviteLink, isLocalHost, savedRoom, useRoom } from './lib/room';
import InviteCard from './components/InviteCard';
import { useEffect } from 'react';
import type { Ctx } from './lib/ctx';
import Gate from './components/Gate';
import SetupView from './components/SetupView';
import GamesView from './components/GamesView';
import Results from './components/Results';

type Tab = 'setup' | 'games' | 'results';

export default function App() {
  const room = useRoom();
  const { view } = room;
  const [tab, setTab] = useState<Tab>('games');
  const [code] = useState(savedRoom);
  const [showInvite, setShowInvite] = useState(false);
  const [lanBase, setLanBase] = useState<string | null>(null);

  // Rejoin the saved/linked game on load.
  useEffect(() => {
    if (code) room.join(code);
    if (isLocalHost())
      fetch('/lan').then((r) => r.json()).then((d) => setLanBase(d.urls?.[0] ?? null)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view)
    return (
      <div className="app">
        <header className="topbar"><div className="brand"><span className="logo">♠</span><div><h1>Game Ledger</h1><div className="sub">Track who owes whom</div></div></div></header>
        <main>
          <Gate code={code} needJoin={room.needJoin} error={room.fatal || room.toast} onCreate={room.create} onJoin={room.join} />
        </main>
      </div>
    );

  const ctx: Ctx = { isMaster: view.you.master, me: view.you.name, view, update: room.update, send: room.send };
  const { store } = view;
  const session = store.sessions.find((s) => s.id === store.activeId) ?? null;
  const link = inviteLink(view.code, isLocalHost() && lanBase ? lanBase : location.origin);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">♠</span>
          <div>
            <h1>Game Ledger</h1>
            <div className="sub">{session ? session.name : 'No session yet'}</div>
          </div>
        </div>
        <div className="actions">
          <span className="pill" title={room.online ? 'Connected' : 'Reconnecting…'}>
            <span className={room.online ? 'dot on' : 'dot'} /> {view.code}
          </span>
          <button className="ghost" onClick={() => setShowInvite(!showInvite)}>Invite</button>
          <button className="ghost" onClick={() => confirm('Leave this game on this device?') && room.leave()}>Leave</button>
        </div>
      </header>
      <div className="who muted">Signed in as <b>{ctx.me}</b> · {ctx.isMaster ? 'master (can edit)' : 'viewer (read-only)'}</div>
      <nav className="tabs">
        {(['setup', 'games', 'results'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>
            {t === 'setup' ? 'Sessions' : t === 'games' ? 'Games' : 'Results'}
          </button>
        ))}
      </nav>
      {room.toast && <div className="toast">{room.toast}</div>}
      <main>
        {showInvite && <InviteCard link={link} local={isLocalHost() && !lanBase} onClose={() => setShowInvite(false)} />}
        {tab === 'setup' && <SetupView ctx={ctx} link={link} onOpen={() => setTab('games')} />}
        {tab === 'games' &&
          (session ? (
            <GamesView ctx={ctx} session={session} />
          ) : (
            <p className="card">{ctx.isMaster ? 'Create a session in the Sessions tab first.' : 'The master has not started a session yet.'}</p>
          ))}
        {tab === 'results' && <Results ctx={ctx} />}
      </main>
    </div>
  );
}
