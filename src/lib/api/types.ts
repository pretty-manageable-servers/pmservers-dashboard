import type { components } from './schema';

type S = components['schemas'];

export type Me = S['Me'];
export type Project = S['Project'];
export type Usage = S['Usage'];
export type ApiEvent = S['Event'];
export type StreamEvent = S['StreamEvent'];
export type ConsoleTicket = S['ConsoleTicket'];
export type Vm = S['Vm'];
export type VmCreate = S['VmCreate'];
export type SshKey = S['SshKey'];
export type SshKeyCreate = S['SshKeyCreate'];
export type AiKey = S['AiKey'];
export type AiKeyCreate = S['AiKeyCreate'];
export type AiKeyCreated = S['AiKeyCreated'];
export type Catalog = S['Catalog'];
export type CatalogModel = Catalog['ai_models'][number];
