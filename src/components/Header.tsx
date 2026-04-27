export default function Header() {
  return (
    <header
      className="absolute top-0 left-0 right-0 z-20 px-6 py-3 flex items-baseline gap-4 pointer-events-none"
      style={{
        background:
          'linear-gradient(to bottom, rgba(244,236,216,0.95), rgba(244,236,216,0))',
      }}
    >
      <h1
        className="display"
        style={{ fontSize: 24, lineHeight: 1, letterSpacing: '0.01em' }}
      >
        Terra Bellum
      </h1>
      <span
        style={{
          fontSize: 14,
          fontStyle: 'italic',
          color: 'var(--ink-faded)',
        }}
      >
        A Cartographer&rsquo;s Wargame
      </span>
    </header>
  );
}
