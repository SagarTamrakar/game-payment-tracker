import type { ClientMsg, RoomView } from './protocol';
import type { Store } from './types';

export interface Ctx {
  isMaster: boolean;
  me: string;
  view: RoomView;
  /** Master only: edit the shared store. */
  update: (fn: (d: Store) => void) => void;
  send: (m: ClientMsg) => void;
}

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
