'use client';

import { useEvents } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { timeAgoLong } from '@/lib/utils';

const CLASS = { info: '', success: 'ok', warning: 'warn', error: 'bad' } as const;

export function ActivityFeed() {
  const { project } = useProject();
  const events = useEvents(project.id);
  return (
    <aside className="feed" aria-label="Activity">
      <h3>Activity</h3>
      {events.isLoading ? (
        <div className="skeleton" style={{ height: 120, margin: 12 }} />
      ) : events.data?.length ? (
        <ol>
          {events.data.map((e) => (
            <li key={e.id} className={CLASS[e.level]}>
              <span>
                <b>{e.resource_name}</b> {e.message}
              </span>
              <time dateTime={e.time}>{timeAgoLong(e.time)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ padding: '0 16px 12px', margin: 0 }}>
          Nothing yet.
        </p>
      )}
    </aside>
  );
}
