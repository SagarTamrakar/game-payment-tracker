import { describe, expect, it } from 'vitest';
import { aggregate, directDebts, settleUp } from './settle';
import type { Session } from './types';

const s: Session = {
  id: 's', name: 'S', createdAt: 0, players: ['A', 'B', 'C'],
  games: [
    { id: '1', at: 0, label: '', nets: { A: 30, B: -10, C: -20 } },
    { id: '2', at: 0, label: '', nets: { A: -5, B: 15, C: -10 } },
  ],
};

describe('settle', () => {
  const agg = aggregate([s]);
  it('totals per player', () => {
    expect(agg.totals.A.net).toBe(25);
    expect(agg.totals.B.net).toBe(5);
    expect(agg.totals.C.net).toBe(-30);
    expect(agg.games).toBe(2);
  });
  it('nets each pair across games', () => {
    // game1: B->A 10, C->A 20 ; game2: A->B 5, C->B 10
    expect(agg.pair.B.A).toBe(5);
    expect(agg.pair.C.A).toBe(20);
    expect(agg.pair.C.B).toBe(10);
    expect(agg.totals.A.owed).toBe(25);
    expect(agg.totals.C.owes).toBe(30);
    expect(directDebts(agg).length).toBe(3);
  });
  it('settle-up payments balance everyone', () => {
    expect(settleUp(agg).reduce((a, x) => a + x.amount, 0)).toBe(30);
  });
  it('keeps players who were removed later', () => {
    expect(aggregate([{ ...s, players: ['A', 'B'] }]).names).toContain('C');
  });
});
