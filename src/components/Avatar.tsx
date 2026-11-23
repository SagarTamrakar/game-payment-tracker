/** Round initial badge with a stable colour per name. */
export default function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 55% 32%)` }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
