import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../client';
import { pollInterval, type Status } from '@/lib/status';
import type { AiKeyCreate, VmCreate } from '../types';

export const keys = {
  me: ['me'] as const,
  catalog: ['catalog'] as const,
  projects: ['projects'] as const,
  usage: (p: string) => ['usage', p] as const,
  events: (p: string) => ['events', p] as const,
  vms: (p: string) => ['vms', p] as const,
  vmMetrics: (p: string, id: string) => ['vm-metrics', p, id] as const,
  aiKeys: (p: string) => ['ai-keys', p] as const,
};

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: async () => unwrap(await api.GET('/v1/me')) });

export const useCatalog = () =>
  useQuery({
    queryKey: keys.catalog,
    queryFn: async () => unwrap(await api.GET('/v1/catalog')),
    staleTime: 5 * 60_000,
  });

export const useProjects = () =>
  useQuery({
    queryKey: keys.projects,
    queryFn: async () => unwrap(await api.GET('/v1/projects')).items,
  });

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => unwrap(await api.POST('/v1/projects', { body: { name } })),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: keys.projects });
      toast.success(`Created project ${p.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}', { params: { path: { project_id: id } } }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
    onError: (e) => toast.error(e.message),
  });
}

export const useUsage = (project: string) =>
  useQuery({
    queryKey: keys.usage(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/usage', {
          params: { path: { project_id: project } },
        }),
      ),
    enabled: !!project,
    refetchInterval: 30_000,
  });

export const useEvents = (project: string) =>
  useQuery({
    queryKey: keys.events(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/events', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
    refetchInterval: 15_000,
  });

/** Show a toast when a resource gets to running or failed after it was busy. */
export function useStatusToasts(items: { id: string; name: string; status: Status }[] | undefined) {
  const prev = useRef(new Map<string, Status>());
  useEffect(() => {
    if (!items) return;
    for (const i of items) {
      const was = prev.current.get(i.id);
      if (was && was !== i.status) {
        if (i.status === 'running' && (was === 'pending' || was === 'provisioning')) {
          toast.success(`${i.name} is running`);
        } else if (i.status === 'failed') {
          toast.error(`${i.name} failed`);
        }
      }
      prev.current.set(i.id, i.status);
    }
  }, [items]);
}

export function useVms(project: string) {
  const q = useQuery({
    queryKey: keys.vms(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/vms', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
    refetchInterval: (query) => pollInterval(query.state.data),
  });
  useStatusToasts(q.data);
  return q;
}

export const useVmMetrics = (project: string, id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: keys.vmMetrics(project, id ?? ''),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/vms/{vm_id}/metrics', {
          params: { path: { project_id: project, vm_id: id! } },
        }),
      ).cpu,
    enabled: !!id && enabled,
  });

function useInvalidating() {
  const qc = useQueryClient();
  return (project: string, ...which: ('vms' | 'ai' | 'events' | 'usage')[]) => {
    const map = { vms: keys.vms, ai: keys.aiKeys, events: keys.events, usage: keys.usage };
    for (const w of which) qc.invalidateQueries({ queryKey: map[w](project) });
  };
}

export function useCreateVm(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (body: VmCreate) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/vms', {
          params: { path: { project_id: project } },
          body,
        }),
      ),
    onSuccess: (vm) => {
      refresh(project, 'vms', 'events', 'usage');
      toast(`Creating ${vm.name}`, { description: 'Status updates every few seconds.' });
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useVmAction(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string; action: 'start' | 'stop' | 'restart' }) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/vms/{vm_id}/actions', {
          params: { path: { project_id: project, vm_id: v.id } },
          body: { action: v.action },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'vms', 'events');
      const word = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' }[v.action];
      toast(`${word} ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteVm(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/vms/{vm_id}', {
          params: { path: { project_id: project, vm_id: v.id } },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'vms', 'events', 'usage');
      toast(`Deleting ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export const useAiKeys = (project: string) =>
  useQuery({
    queryKey: keys.aiKeys(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/ai-keys', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
    refetchInterval: (query) => pollInterval(query.state.data),
  });

export function useCreateAiKey(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (body: AiKeyCreate) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/ai-keys', {
          params: { path: { project_id: project } },
          body,
        }),
      ),
    onSuccess: () => refresh(project, 'ai', 'events'),
    onError: (e) => toast.error(e.message),
  });
}

export function useRotateAiKey(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/ai-keys/{key_id}/rotate', {
          params: { path: { project_id: project, key_id: id } },
        }),
      ),
    onSuccess: () => refresh(project, 'ai', 'events'),
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteAiKey(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/ai-keys/{key_id}', {
          params: { path: { project_id: project, key_id: v.id } },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'ai', 'events', 'usage');
      toast(`Revoked ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}
