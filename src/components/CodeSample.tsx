'use client';

import { useState } from 'react';

export function CodeSample({ samples }: { samples: Record<string, string> }) {
  const tabs = Object.keys(samples);
  const [tab, setTab] = useState(tabs[0] ?? '');
  return (
    <div className="code">
      <div className="tabs2" role="group" aria-label="Language">
        {tabs.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <pre>{samples[tab]}</pre>
    </div>
  );
}
