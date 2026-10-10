import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, unwrap } from '../client';
import type {
  AiKeyCreate,
  ContainerCreate,
  ContainerUpdate,
  DatabaseCreate,
  DatabaseSecret,
  RegistryCredentialCreate,
  SshKeyCreate,
  VmCreate,
} from '../types';

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
  members: (p: string) => ['members', p] as const,
  access: ['access'] as const,
  registryCredentials: ['registry-credentials'] as const,
  containers: (p: string) => ['containers', p] as const,
  databases: (p: string) => ['databases', p] as const,
  containerLogs: (p: string, id: string, previous: boolean) =>
    ['container-logs', p, id, previous] as const,
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

export const useMembers = (project: string) =>
  useQuery({
    queryKey: keys.members(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/members', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
  });

export function useAddMember(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/members', {
          params: { path: { project_id: project } },
          body: { email },
        }),
      ),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: keys.members(project) });
      qc.invalidateQueries({ queryKey: keys.events(project) });
      toast.success(m.invited ? `Sent an invite to ${m.email}` : `Added ${m.email}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** The owner removes a member. A member removes themselves to leave the project. */
export function useRemoveMember(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/members/{user_id}', {
          params: { path: { project_id: project, user_id: userId } },
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.members(project) });
      qc.invalidateQueries({ queryKey: keys.events(project) });
    },
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
  return (
    project: string,
    ...which: ('vms' | 'ai' | 'containers' | 'databases' | 'events' | 'usage')[]
  ) => {
    const map = {
      vms: keys.vms,
      ai: keys.aiKeys,
      containers: keys.containers,
      databases: keys.databases,
      events: keys.events,
      usage: keys.usage,
    };
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

/** Container access of the signed-in user's account. Poll while it can change by itself. */
export const useAccess = () =>
  useQuery({
    queryKey: keys.access,
    queryFn: async () => unwrap(await api.GET('/v1/account/access')),
    refetchInterval: (query) => {
      const a = query.state.data;
      if (!a) return false;
      if (a.access === 'pending') return 10_000;
      if (a.access !== 'approved') return false;
      if (a.vcluster === 'creating' || a.vcluster === 'none') return 5000;
      if (a.vcluster === 'failed') return 30_000;
      return false;
    },
  });

export function useRequestAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) =>
      unwrap(await api.POST('/v1/account/access/request', { body: { reason } })),
    onSuccess: (a) => {
      qc.setQueryData(keys.access, a);
      toast.success('Sent your request. We review it soon.');
    },
    onError: (e) => toast.error(e.message),
  });
}

export const useRegistryCredentials = () =>
  useQuery({
    queryKey: keys.registryCredentials,
    queryFn: async () => unwrap(await api.GET('/v1/registry-credentials')).items,
  });

export function useCreateRegistryCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegistryCredentialCreate) =>
      unwrap(await api.POST('/v1/registry-credentials', { body })),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: keys.registryCredentials });
      toast.success(`Saved registry credential ${c.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteRegistryCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE('/v1/registry-credentials/{credential_id}', {
          params: { path: { credential_id: id } },
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.registryCredentials });
      toast.success('Deleted registry credential');
    },
    onError: (e) => toast.error(e.message),
  });
}

/** True if the error says that the owner's account has no container access. */
export const isNotAllowed = (e: unknown) => e instanceof ApiError && e.code === 'not_allowed';

export const useContainers = (project: string, enabled = true) =>
  useQuery({
    queryKey: keys.containers(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/containers', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project && enabled,
    // A 403 is a state, not a failure. Do not retry it.
    retry: (n, e) => !isNotAllowed(e) && n < 1,
    refetchInterval: (query) =>
      query.state.data?.some((c) => c.status === 'provisioning' || c.status === 'deleting')
        ? 5000
        : false,
  });

export function useCreateContainer(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (body: ContainerCreate) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/containers', {
          params: { path: { project_id: project } },
          body,
        }),
      ),
    onSuccess: (c) => {
      refresh(project, 'containers', 'events', 'usage');
      toast(`Creating ${c.name}`, { description: 'This page updates when it is ready.' });
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateContainer(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; body: ContainerUpdate }) =>
      unwrap(
        await api.PATCH('/v1/projects/{project_id}/containers/{container_id}', {
          params: { path: { project_id: project, container_id: v.id } },
          body: v.body,
        }),
      ),
    onSuccess: (c) => {
      refresh(project, 'containers', 'events', 'usage');
      toast(`Redeploying ${c.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteContainer(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/containers/{container_id}', {
          params: { path: { project_id: project, container_id: v.id } },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'containers', 'events', 'usage');
      toast(`Deleting ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useContainerAction(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string; action: 'start' | 'stop' | 'restart' }) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/containers/{container_id}/actions', {
          params: { path: { project_id: project, container_id: v.id } },
          body: { action: v.action },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'containers', 'events');
      const word = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' }[v.action];
      toast(`${word} ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export const LOG_LINES = 200;

export const useContainerLogs = (
  project: string,
  id: string,
  opts: { previous: boolean; enabled: boolean; live: boolean },
) =>
  useQuery({
    queryKey: keys.containerLogs(project, id, opts.previous),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/containers/{container_id}/logs', {
          params: {
            path: { project_id: project, container_id: id },
            query: { tail: LOG_LINES, previous: opts.previous },
          },
        }),
      ).lines,
    enabled: !!project && opts.enabled,
    refetchInterval: opts.live ? 5000 : false,
  });

export const useDatabases = (project: string) =>
  useQuery({
    queryKey: keys.databases(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/databases', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'provisioning' || d.status === 'deleting')
        ? 5000
        : false,
  });

/**
 * `onSecret` is a hook option, not a `mutate` option: `mutate` callbacks do not run after the
 * component unmounts, and the one-time password would be lost.
 */
export function useCreateDatabase(project: string, onSecret: (d: DatabaseSecret) => void) {
  const refresh = useInvalidating();
  return useMutation({
    // Do not keep the password in the mutation cache.
    gcTime: 0,
    mutationFn: async (body: DatabaseCreate) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/databases', {
          params: { path: { project_id: project } },
          body,
        }),
      ),
    onSuccess: (d) => {
      refresh(project, 'databases', 'events', 'usage');
      toast(`Creating ${d.name}`, { description: 'This page updates when it is ready.' });
      onSecret(d);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useSetDatabaseVector(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; vector: boolean }) =>
      unwrap(
        await api.PATCH('/v1/projects/{project_id}/databases/{database_id}', {
          params: { path: { project_id: project, database_id: v.id } },
          body: { vector: v.vector },
        }),
      ),
    onSuccess: (d) => {
      refresh(project, 'databases', 'events');
      toast(d.vector ? `Turning on vector for ${d.name}` : `Turned off vector for ${d.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useResetDatabasePassword(project: string, onSecret: (d: DatabaseSecret) => void) {
  const refresh = useInvalidating();
  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/databases/{database_id}/reset-password', {
          params: { path: { project_id: project, database_id: id } },
        }),
      ),
    onSuccess: (d) => {
      refresh(project, 'databases', 'events');
      onSecret(d);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteDatabase(project: string) {
  const refresh = useInvalidating();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/databases/{database_id}', {
          params: { path: { project_id: project, database_id: v.id } },
        }),
      ),
    onSuccess: (_d, v) => {
      refresh(project, 'databases', 'events', 'usage');
      toast(`Deleting ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}
