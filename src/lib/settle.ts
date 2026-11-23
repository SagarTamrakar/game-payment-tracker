import type { Game, Session } from './types';

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface PlayerTotals {
  /** Overall won (+) / lost (-). */
  net: number;
  /** Total others owe this player (after netting each pair). */
  owed: number;
  /** Total this player owes others (after netting each pair). */
  owes: number;
  games: number;
  wins: number;
}

export interface Aggregate {
  names: string[];
  totals: Record<string, PlayerTotals>;
  /** pair[a][b] = net amount a owes b (negative means b owes a). */
  pair: Record<string, Record<string, number>>;
  games: number;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

/** Who pays whom for one game (exact when one player won; fewest payments otherwise). */
export function simplify(net: Record<string, number>): Transfer[] {
  const cr = Object.entries(net).filter(([, v]) => v > 0.004).map(([n, v]) => ({ n, v }));
  const db = Object.entries(net).filter(([, v]) => v < -0.004).map(([n, v]) => ({ n, v: -v }));
  const out: Transfer[] = [];
  while (cr.length && db.length) {
    cr.sort((a, b) => b.v - a.v);
    db.sort((a, b) => b.v - a.v);
    const amt = Math.min(cr[0].v, db[0].v);
    out.push({ from: db[0].n, to: cr[0].n, amount: round2(amt) });
    cr[0].v -= amt;
    db[0].v -= amt;
    if (cr[0].v < 0.005) cr.shift();
    if (db[0].v < 0.005) db.shift();
  }
  return out;
}

export const gameTotal = (g: Game) => round2(Object.values(g.nets).reduce((a, b) => a + b, 0));

export function aggregate(sessions: Session[]): Aggregate {
  const names: string[] = [];
  const totals: Record<string, PlayerTotals> = {};
  const gross: Record<string, Record<string, number>> = {};
  let games = 0;
  const ensure = (n: string) => {
    if (n in totals) return;
    names.push(n);
    totals[n] = { net: 0, owed: 0, owes: 0, games: 0, wins: 0 };
    gross[n] = {};
  };
  for (const s of sessions) {
    s.players.forEach(ensure);
    for (const g of s.games) {
      games++;
      Object.keys(g.nets).forEach(ensure);
      const best = Math.max(...Object.values(g.nets));
      for (const [n, v] of Object.entries(g.nets)) {
        totals[n].net += v;
        totals[n].games++;
        if (v > 0 && v === best) totals[n].wins++;
      }
      for (const t of simplify(g.nets)) gross[t.from][t.to] = (gross[t.from][t.to] ?? 0) + t.amount;
    }
  }
  const pair: Aggregate['pair'] = {};
  for (const a of names) {
    pair[a] = {};
    for (const b of names) if (a !== b) pair[a][b] = round2((gross[a][b] ?? 0) - (gross[b][a] ?? 0));
  }
  for (const a of names) {
    totals[a].net = round2(totals[a].net);
    for (const b of names) {
      const v = pair[a][b] ?? 0;
      if (v > 0) totals[a].owes += v;
      if (v < 0) totals[a].owed += -v;
    }
    totals[a].owes = round2(totals[a].owes);
    totals[a].owed = round2(totals[a].owed);
  }
  return { names, totals, pair, games };
}

/** Direct "who owes whom" after netting each pair across all games. */
export function directDebts(agg: Aggregate): Transfer[] {
  const out: Transfer[] = [];
  for (const a of agg.names)
    for (const b of agg.names) if (agg.pair[a][b] > 0.004) out.push({ from: a, to: b, amount: agg.pair[a][b] });
  return out;
}

/** Fewest payments that settle everything. */
export function settleUp(agg: Aggregate): Transfer[] {
  return simplify(Object.fromEntries(agg.names.map((n) => [n, agg.totals[n].net])));
}
