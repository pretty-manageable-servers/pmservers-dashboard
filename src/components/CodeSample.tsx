'use client';

import { useState } from 'react';
import { copyText } from './CopyField';

/** Tabs of code samples. `copyable` adds a Copy button for the shown sample. */
export function CodeSample({
  samples,
  copyable,
}: {
  samples: Record<string, string>;
  copyable?: boolean;
}) {
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
        {copyable && (
          <button
            className="btn sm"
            type="button"
            style={{ marginLeft: 'auto' }}
            onClick={() => copyText(samples[tab] ?? '')}
          >
            Copy
          </button>
        )}
      </div>
      <pre>{samples[tab]}</pre>
    </div>
  );
}
