import { useState } from 'react';

interface Props {
  code: string | null;
  needJoin: boolean;
  error: string;
  onCreate: (name: string, phone: string) => void;
  onJoin: (room: string, name?: string, phone?: string) => void;
}

/** Landing / join screen shown until the device is inside a game. */
export default function Gate({ code, needJoin, error, onCreate, onJoin }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [room, setRoom] = useState(code ?? '');

  const who = (
    <>
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Mobile number with country code (for WhatsApp, optional)
        <input inputMode="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
    </>
  );

  if (needJoin && room)
    return (
      <section className="card">
        <h2>Join game {room}</h2>
        {who}
        {error && <p className="err">{error}</p>}
        <button className="primary" disabled={!name.trim()} onClick={() => onJoin(room, name, phone)}>Join</button>
      </section>
    );

  return (
    <>
      <section className="card">
        <h2>Start a new game (you are the master)</h2>
        <p className="muted">The master sets the bet factor and seating, and can place bets for anyone. Share the game link so others can join.</p>
        {who}
        <button className="primary" disabled={!name.trim()} onClick={() => onCreate(name, phone)}>Create game</button>
      </section>
      <section className="card">
        <h2>Join with a code</h2>
        <label>Game code<input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} /></label>
        <button disabled={room.length < 4} onClick={() => onJoin(room)}>Continue</button>
      </section>
      {error && <p className="err card">{error}</p>}
    </>
  );
}
