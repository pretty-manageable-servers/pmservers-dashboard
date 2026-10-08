import { api, unwrap } from './client';
import { env } from '@/lib/env';

/** Get a ticket and open the console WebSocket for a running VM. */
export async function openConsole(project: string, vm: string): Promise<WebSocket> {
  const t = unwrap(
    await api.POST('/v1/projects/{project_id}/vms/{vm_id}/console/ticket', {
      params: { path: { project_id: project, vm_id: vm } },
    }),
  );
  const url = new URL(t.url, env.apiUrl || window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  return ws;
}
