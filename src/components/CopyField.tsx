'use client';

import { toast } from 'sonner';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Select the text to copy it');
  }
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  return (
    <div className="copy">
      {label && (
        <span className="muted" style={{ fontSize: 12.5 }}>
          {label}
        </span>
      )}
      <code>{value}</code>
      <button className="btn sm" type="button" onClick={() => copyText(value)}>
        Copy
      </button>
    </div>
  );
}
