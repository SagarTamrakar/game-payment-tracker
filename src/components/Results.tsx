import Avatar from './Avatar';
import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { aggregate, directDebts, round2, settleUp } from '../lib/settle';
import { same, waLink, type Ctx } from '../lib/ctx';

const money = (x: number) => (x > 0 ? '+' : '') + round2(x);

export default function Results({ ctx }: { ctx: Ctx }) {
  const store = ctx.view.store;
  const [picked, setPicked] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'simple' | 'direct'>('direct');
  const [msg, setMsg] = useState('');
  const card = useRef<HTMLDivElement>(null);

  const ids = picked ?? store.sessions.map((s) => s.id);
  const sessions = store.sessions.filter((s) => ids.includes(s.id));
  const agg = useMemo(() => aggregate(sessions), [store, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const transfers = mode === 'simple' ? settleUp(agg) : directDebts(agg);
  const ranking = [...agg.names].sort((a, b) => agg.totals[b].net - agg.totals[a].net);
  const title = sessions.length === 1 ? sessions[0].name : `${sessions.length} sessions`;

  const render = () => toPng(card.current!, { pixelRatio: 2, backgroundColor: '#ffffff' });
  const download = async () => {
    try {
      const a = document.createElement('a');
      a.href = await render();
      a.download = `results-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setMsg('Image saved.');
    } catch {
      setMsg('Could not create the image.');
    }
  };
  const share = async () => {
    try {
      const blob = await (await fetch(await render())).blob();
      const file = new File([blob], 'results.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Results' });
      else await download();
    } catch {
      setMsg('Sharing was cancelled or is unsupported; use Download.');
    }
  };

  if (!store.sessions.length) return <p className="card">No sessions yet.</p>;

  return (
    <>
      <section className="card">
        <h2>Include sessions</h2>
        {store.sessions.map((s) => (
          <label key={s.id} className="check">
            <input type="checkbox" checked={ids.includes(s.id)}
              onChange={(e) => setPicked(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
            {s.name} <span className="muted">({s.games.length} games)</span>
          </label>
        ))}
        <div className="seg">
          <button className={mode === 'direct' ? 'on' : ''} onClick={() => setMode('direct')}>Who owes whom</button>
          <button className={mode === 'simple' ? 'on' : ''} onClick={() => setMode('simple')}>Fewest payments</button>
        </div>
        <div className="btns">
          <button className="primary" onClick={download}>⬇ Download image</button>
          <button onClick={share}>Share image</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
        {ctx.isMaster && (
          <>
            <h3>Send to players on WhatsApp</h3>
            <p className="muted">Tap "Download image" first, then open a chat below and attach the saved picture (the text summary is pre-filled).</p>
            <div className="btns">
              {agg.names.map((n) => {
                const phone = store.contacts[n];
                if (!phone) return <span key={n} className="muted">{n}: no number</span>;
                const t = agg.totals[n];
                const mine = transfers.filter((x) => x.from === n || x.to === n).map((x) =>
                  x.from === n ? `You owe ${x.to} ${x.amount}` : `${x.from} owes you ${x.amount}`);
                const text = `♠ Results (${title})\n${n}: ${money(t.net)}\nOwed to you: ${t.owed} · You owe: ${t.owes}\n${mine.join('\n')}`;
                return <a key={n} className="wa" href={waLink(phone, text)} target="_blank" rel="noreferrer">💬 {n}</a>;
              })}
            </div>
          </>
        )}
      </section>

      <div className="export" ref={card}>
        <h2>♠ Results</h2>
        <div className="muted">{title} · {agg.games} games · {new Date().toLocaleDateString()}</div>
        <table>
          <thead><tr><th>Player</th><th>Is owed</th><th>Owes</th><th>Net</th></tr></thead>
          <tbody>
            {ranking.map((n) => (
              <tr key={n} className={same(n, ctx.me) ? 'me' : ''}>
                <td><Avatar name={n} />{n}</td>
                <td className="pos">{agg.totals[n].owed}</td>
                <td className="neg">{agg.totals[n].owes}</td>
                <td className={agg.totals[n].net >= 0 ? 'pos' : 'neg'}><b>{money(agg.totals[n].net)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{mode === 'simple' ? 'Settle up (fewest payments)' : 'Who owes whom'}</h3>
        {transfers.length === 0 ? <div className="muted">All square.</div> : (
          <ul>
            {transfers.map((t, i) => <li key={i}><b>{t.from}</b> owes <b>{t.to}</b> <span className="amt">{t.amount}</span></li>)}
          </ul>
        )}
        {sessions.length > 1 && (
          <>
            <h3>Per session</h3>
            {sessions.map((s) => {
              const a = aggregate([s]);
              return (
                <div key={s.id} className="muted">
                  <b>{s.name}</b>: {[...a.names].sort((x, y) => a.totals[y].net - a.totals[x].net).map((n) => `${n} ${money(a.totals[n].net)}`).join(' · ')}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
