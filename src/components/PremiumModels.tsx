const MODELS = ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5'];

/** The Claude spark: rays around a center. */
function ClaudeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="2.5"
          x2="12"
          y2={i % 2 ? 8 : 6.5}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Static card for models that are not available yet. It cannot be used. */
export function PremiumModels() {
  return (
    <section className="premium" aria-label="Claude models, coming soon">
      <div className="premium-head">
        <ClaudeLogo />
        <b>Claude models — Premium tier</b>
        <span className="soon">Coming soon</span>
      </div>
      <ul>
        {MODELS.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  );
}
