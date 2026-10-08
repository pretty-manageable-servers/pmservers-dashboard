'use client';

import { Plus } from 'lucide-react';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
  return (
    <div className="errbox" role="alert">
      <span>{message}</span>
      <button className="btn sm" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="cards" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 110 }} />
      ))}
    </div>
  );
}

export function EmptyState(props: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <span>{props.text}</span>
      {props.action && (
        <button className="btn primary" type="button" onClick={props.onAction}>
          <Plus aria-hidden="true" />
          {props.action}
        </button>
      )}
    </div>
  );
}
