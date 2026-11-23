import { useState } from 'react';
import { inviteLink, savedRoom, useRoom } from './lib/room';
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
  const [copied, setCopied] = useState(false);

  // Rejoin the saved/linked game on load.
  useEffect(() => {
    if (code) room.join(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view)
    return (
      <div className="app">
        <header><h1>♠ Teen Patti Tracker</h1></header>
        <main>
          <Gate code={code} needJoin={room.needJoin} error={room.fatal || room.toast} onCreate={room.create} onJoin={room.join} />
        </main>
      </div>
    );

  const ctx: Ctx = { isMaster: view.you.master, me: view.you.name, view, update: room.update, send: room.send };
  const { store } = view;
  const session = store.sessions.find((s) => s.id === store.activeId) ?? null;
  const link = inviteLink(view.code);

  const invite = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Join my Teen Patti game', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* cancelled */ }
  };

  return (
    <div className="app">
      <header>
        <h1>♠ Teen Patti Tracker</h1>
        <div className="muted">
          <span className={room.online ? 'dot on' : 'dot'} /> {ctx.me} · {ctx.isMaster ? 'master' : 'player'} · game <b>{view.code}</b>{' '}
          <button className="mini" onClick={invite}>{copied ? 'Link copied!' : '🔗 Invite link'}</button>
          <button className="mini" onClick={() => confirm('Leave this game on this device?') && room.leave()}>Leave</button>
        </div>
        <nav>
          {(['setup', 'games', 'results'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>
              {t === 'setup' ? 'Sessions' : t === 'games' ? 'Games' : 'Results'}
            </button>
          ))}
        </nav>
        {session && <div className="muted">Session: <b>{session.name}</b></div>}
        {room.toast && <div className="toast">{room.toast}</div>}
      </header>
      <main>
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
