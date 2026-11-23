import type { Store } from './types';

export type ClientMsg =
  | { t: 'create'; token: string; name: string; phone: string }
  | { t: 'join'; room: string; token: string; name?: string; phone?: string }
  /** Master only: replace the shared store (guarded by revision). */
  | { t: 'set'; rev: number; store: Store }
  | { t: 'remove'; name: string };

export interface MemberView {
  name: string;
  /** Only filled in for the master. */
  phone: string;
  master: boolean;
  online: boolean;
}

export interface RoomView {
  t: 'state';
  code: string;
  rev: number;
  store: Store;
  members: MemberView[];
  you: { name: string; master: boolean };
}

export type ServerMsg =
  | RoomView
  | { t: 'needJoin' }
  | { t: 'error'; message: string; fatal?: boolean };
