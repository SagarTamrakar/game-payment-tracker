/** One finished game: the final amount each player won (+) or lost (-). Always sums to zero. */
export interface Game {
  id: string;
  at: number;
  label: string;
  nets: Record<string, number>;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  /** Players currently in this session (master adds/removes). Past games keep removed players' names. */
  players: string[];
  games: Game[];
}

export interface Store {
  sessions: Session[];
  activeId: string | null;
  /** Mobile numbers by player name (digits with country code). */
  contacts: Record<string, string>;
}
