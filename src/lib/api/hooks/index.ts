import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, unwrap } from '../client';
import { CONNECTOR_NAME } from '@/lib/connectors';
import type {
  AiKeyCreate,
  ApiTokenCreate,
  ApiTokenCreated,
  Connector,
  ConnectorKind,
  ConnectorPut,
  ContainerCreate,
  ContainerUpdate,
  DatabaseCreate,
  DatabaseSecret,
  RegistryCredentialCreate,
  SshKeyCreate,
  BucketCreate,
  StorageKeyCreate,
  StorageKeyWithSecret,
} from '../types';
import { isNotAvailable } from '../../storage';

export const keys = {
  me: ['me'] as const,
  sshKeys: ['ssh-keys'] as const,
  catalog: ['catalog'] as const,
  projects: ['projects'] as const,
  usage: (p: string) => ['usage', p] as const,
  events: (p: string) => ['events', p] as const,
  aiKeys: (p: string) => ['ai-keys', p] as const,
  members: (p: string) => ['members', p] as const,
  access: ['access'] as const,
  registryCredentials: ['registry-credentials'] as const,
  containers: (p: string) => ['containers', p] as const,
  databases: (p: string) => ['databases', p] as const,
  tokens: (p: string) => ['tokens', p] as const,
  connectors: (p: string) => ['connectors', p] as const,
  availableTargets: (p: string) => ['available-targets', p] as const,
  sandboxes: (p: string) => ['sandboxes', p] as const,
  containerLogs: (p: string, id: string, previous: boolean) =>
    ['container-logs', p, id, previous] as const,
  // The account of the storage. `undefined` is the caller's own account.
  storage: (account?: string) => ['storage', account ?? 'self'] as const,
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
      toast.success('Deleted SSH key.');
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

function useInvalidating() {
  const qc = useQueryClient();
  return (
    project: string,
    ...which: ('ai' | 'containers' | 'databases' | 'events' | 'usage')[]
  ) => {
    const map = {
      ai: keys.aiKeys,
      containers: keys.containers,
      databases: keys.databases,
      events: keys.events,
      usage: keys.usage,
    };
    for (const w of which) qc.invalidateQueries({ queryKey: map[w](project) });
  };
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

/**
 * The caller's registry credentials. With `project`, the API also returns the project owner's,
 * so a member can pick the owner's credential. Invalidating `keys.registryCredentials` also
 * refreshes the project variant, because it is a prefix of that key.
 */
export const useRegistryCredentials = (project?: string) =>
  useQuery({
    queryKey: project ? [...keys.registryCredentials, project] : keys.registryCredentials,
    queryFn: async () =>
      unwrap(
        await api.GET(
          '/v1/registry-credentials',
          project ? { params: { query: { project_id: project } } } : {},
        ),
      ).items,
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
      query.state.data?.some(
        (c) =>
          c.status === 'provisioning' ||
          c.status === 'deleting',
      )
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

export const useApiTokens = (project: string) =>
  useQuery({
    queryKey: keys.tokens(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/tokens', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project,
  });

/**
 * `onCreated` is a hook option, not a `mutate` option, for the same reason as `useCreateDatabase`:
 * the token is shown once, and it must not wait in the mutation cache.
 */
export function useCreateApiToken(project: string, onCreated: (t: ApiTokenCreated) => void) {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (body: ApiTokenCreate) =>
      unwrap(
        await api.POST('/v1/projects/{project_id}/tokens', {
          params: { path: { project_id: project } },
          body,
        }),
      ),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: keys.tokens(project) });
      onCreated(t);
    },
  });
}

export function useRevokeApiToken(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/tokens/{token_id}', {
          params: { path: { project_id: project, token_id: v.id } },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.tokens(project) });
      toast(`Revoked ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** Sandboxes of the project. A list of running sandboxes, so it refreshes every 10 s. */
export const useSandboxes = (project: string, enabled = true) =>
  useQuery({
    queryKey: keys.sandboxes(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/sandboxes', {
          params: { path: { project_id: project } },
        }),
      ).items,
    enabled: !!project && enabled,
    // A 403 is a state, not a failure. Do not retry it.
    retry: (n, e) => !isNotAllowed(e) && n < 1,
    refetchInterval: 10_000,
  });

export function useKillSandbox(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string }) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/sandboxes/{sandbox_id}', {
          params: { path: { project_id: project, sandbox_id: v.id } },
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sandboxes(project) });
      toast('Killed the sandbox');
    },
    onError: (e) => toast.error(e.message),
  });
}

/** The storage calls take the account of a member's project. The owner's own account needs no ID. */
const storageQuery = (account?: string) => ({ params: { query: { account_id: account } } });

/** Poll while a state can change by itself. Otherwise check the usage every 30 s. */
export const useStorage = (account?: string, enabled = true) =>
  useQuery({
    queryKey: keys.storage(account),
    queryFn: async () => unwrap(await api.GET('/v1/storage', storageQuery(account))),
    enabled,
    // A 403 is a state, not a failure. Do not retry it.
    retry: (n, e) => !isNotAllowed(e) && n < 1,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'provisioning' || s === 'disabling' ? 5000 : 30_000;
    },
  });

export function useEnableStorage(account?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/v1/storage/enable', storageQuery(account))),
    onSuccess: (s) => {
      qc.setQueryData(keys.storage(account), s);
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      toast('Turning on object storage');
    },
    onError: (e) => {
      if (!isNotAvailable(e)) toast.error(e.message);
    },
  });
}

export function useDisableStorage(account?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/v1/storage/disable', storageQuery(account))),
    onSuccess: (s) => {
      qc.setQueryData(keys.storage(account), s);
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      toast('Turning off object storage');
    },
    onError: (e) => toast.error(e.message),
  });
}

export const useStorageBuckets = (account?: string, enabled = true) =>
  useQuery({
    queryKey: [...keys.storage(account), 'buckets'],
    queryFn: async () => unwrap(await api.GET('/v1/storage/buckets', storageQuery(account))).items,
    enabled,
    retry: (n, e) => !isNotAllowed(e) && n < 1,
    refetchInterval: (query) =>
      query.state.data?.some((b) => b.status === 'provisioning' || b.status === 'deleting')
        ? 5000
        : false,
  });

export function useCreateBucket(account?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BucketCreate) =>
      unwrap(await api.POST('/v1/storage/buckets', { ...storageQuery(account), body })),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      toast(`Creating ${b.name}`, { description: 'This list updates when it is ready.' });
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteBucket(account?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(
        await api.DELETE('/v1/storage/buckets/{name}', {
          params: { path: { name }, query: { account_id: account } },
        }),
      ),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      toast(`Deleting ${name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

export const useStorageKeys = (account?: string, enabled = true) =>
  useQuery({
    queryKey: [...keys.storage(account), 'keys'],
    queryFn: async () => unwrap(await api.GET('/v1/storage/keys', storageQuery(account))).items,
    enabled,
    retry: (n, e) => !isNotAllowed(e) && n < 1,
  });

/**
 * `onSecret` is a hook option, not a `mutate` option, so the secret is not lost if the dialog
 * closes first. The mutation does not keep the secret in the mutation cache (`gcTime: 0`).
 */
export function useCreateStorageKey(
  account: string | undefined,
  onSecret: (k: StorageKeyWithSecret) => void,
) {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (body: StorageKeyCreate) =>
      unwrap(await api.POST('/v1/storage/keys', { ...storageQuery(account), body })),
    onSuccess: (k) => {
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      onSecret(k);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** A reset makes a new key ID and secret. The API deletes the old key. */
export function useResetStorageKey(
  account: string | undefined,
  onSecret: (k: StorageKeyWithSecret) => void,
) {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST('/v1/storage/keys/{key_id}/reset', {
          params: { path: { key_id: id }, query: { account_id: account } },
        }),
      ),
    onSuccess: (k) => {
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      onSecret(k);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteStorageKey(account?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(
        await api.DELETE('/v1/storage/keys/{key_id}', {
          params: { path: { key_id: v.id }, query: { account_id: account } },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.storage(account) });
      toast(`Deleted ${v.name}`);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** The network connectors of the project. A connector that is setting up or deleting refreshes often. */
export const useConnectors = (project: string, enabled = true) =>
  useQuery({
    queryKey: keys.connectors(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/connectors', {
          params: { path: { project_id: project } },
        }),
      ).connectors,
    enabled: !!project && enabled,
    // A 403 is a state, not a failure. Do not retry it.
    retry: (n, e) => !isNotAllowed(e) && n < 1,
    refetchInterval: (query) =>
      query.state.data?.some((c) => c.status === 'provisioning' || c.status === 'deleting')
        ? 5000
        : 30_000,
  });

/** The containers (with their ports) and databases that a connector can reach. */
export const useAvailableTargets = (project: string, enabled = true) =>
  useQuery({
    queryKey: keys.availableTargets(project),
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/projects/{project_id}/connectors/available-targets', {
          params: { path: { project_id: project } },
        }),
      ).targets,
    enabled: !!project && enabled,
    retry: (n, e) => !isNotAllowed(e) && n < 1,
  });

/**
 * Make a connector, change its token or its targets. The error is not toasted: the page and the
 * card show it inline. A successful answer replaces the connector in the list at once.
 */
export function useUpdateConnector(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: ConnectorKind; body: ConnectorPut }) =>
      unwrap(
        await api.PUT('/v1/projects/{project_id}/connectors/{kind}', {
          params: { path: { project_id: project, kind: v.kind } },
          body: v.body,
        }),
      ),
    onSuccess: (c: Connector) => {
      qc.setQueryData<Connector[]>(keys.connectors(project), (list) =>
        list
          ? list.some((x) => x.kind === c.kind)
            ? list.map((x) => (x.kind === c.kind ? c : x))
            : [...list, c]
          : list,
      );
      qc.invalidateQueries({ queryKey: keys.connectors(project) });
      qc.invalidateQueries({ queryKey: keys.events(project) });
      toast.success(`Saved ${CONNECTOR_NAME[c.kind]}`);
    },
  });
}

export function useDeleteConnector(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: ConnectorKind) =>
      unwrap(
        await api.DELETE('/v1/projects/{project_id}/connectors/{kind}', {
          params: { path: { project_id: project, kind } },
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.connectors(project) });
      qc.invalidateQueries({ queryKey: keys.events(project) });
      toast('Disabling the connector');
    },
    onError: (e) => toast.error(e.message),
  });
}
