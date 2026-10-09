import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '../client';
import type { AiKeyCreate, SshKeyCreate, VmCreate } from '../types';

export const keys = {
  me: ['me'] as const,
  sshKeys: ['ssh-keys'] as const,
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

export const useSshKeys = () =>
  useQuery({
    queryKey: keys.sshKeys,
    queryFn: async () => unwrap(await api.GET('/v1/ssh-keys')).items,
  });

export function useCreateSshKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SshKeyCreate) => unwrap(await api.POST('/v1/ssh-keys', { body })),
    onSuccess: (k) => {
      qc.invalidateQueries({ queryKey: keys.sshKeys });
      toast.success(`Saved SSH key ${k.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteSshKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE('/v1/ssh-keys/{key_id}', { params: { path: { key_id: id } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sshKeys });
      toast.success('Deleted SSH key. VMs that have it keep it.');
    },
    onError: (e) => toast.error(e.message),
  });
}

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
    // Wait for the list, so the page never opens a project that the cached list does not have.
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: keys.projects });
      toast.success(`Created project ${p.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useRenameProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.PATCH('/v1/projects/{project_id}', {
          params: { path: { project_id: v.id } },
          body: { name: v.name },
        }),
      ),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: keys.projects });
      toast.success(`Renamed project to ${p.name}`);
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
    // The private IP comes about 1 minute after `running`, with no status event. Poll until it is there.
    refetchInterval: (query) =>
      query.state.data?.some((vm) => vm.status === 'running' && !vm.private_ip) ? 5000 : false,
  });
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
      toast(`Creating ${vm.name}`, { description: 'This page updates when it is ready.' });
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
