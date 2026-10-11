import type { components } from './schema';

type S = components['schemas'];

export type Me = S['Me'];
export type Project = S['Project'];
export type Member = S['Member'];
export type MemberAdded = S['MemberAdded'];
export type Usage = S['Usage'];
export type ApiEvent = S['Event'];
// The event stream route has no response model, so the contract has no StreamEvent.
export type StreamEvent = ApiEvent & { project_id: string };
export type ConsoleTicket = S['ConsoleTicket'];
export type Vm = S['Vm'];
export type VmCreate = S['VmCreate'];
export type SshKey = S['SshKey'];
export type SshKeyCreate = S['SshKeyCreate'];
export type AiKey = S['AiKey'];
export type AiKeyCreate = S['KeyCreate'];
export type AiKeyCreated = S['AiKeyCreated'];
export type Catalog = S['Catalog'];
export type CatalogModel = Catalog['ai_models'][number];
export type Access = S['AccountAccess'];
export type Runtime = S['Runtime'];
export type RegistryCredential = S['RegistryCredential'];
export type RegistryCredentialCreate = S['CredentialCreate'];
export type Container = S['Container'];
export type ContainerCreate = S['ContainerCreate'];
export type ContainerUpdate = S['ContainerUpdate'];
export type ContainerLogs = S['ContainerLogs'];
export type ContainerSize = Catalog['container_sizes'][number];
export type Database = S['Database'];
export type DatabaseSecret = S['DatabaseWithSecret'];
export type DatabaseCreate = S['DatabaseCreate'];
export type DatabaseUpdate = S['DatabaseUpdate'];
export type DatabaseStatus = S['DatabaseStatus'];
export type DatabaseSize = Catalog['database_sizes'][number];
export type ApiToken = S['ApiToken'];
export type ApiTokenCreate = S['ApiTokenCreate'];
export type ApiTokenCreated = S['ApiTokenCreated'];
// Not in the API contract yet. See the hand-added sandbox paths in schema.d.ts.
export type Sandbox = S['Sandbox'];
