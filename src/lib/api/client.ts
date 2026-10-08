import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { env } from '@/lib/env';

let getToken: () => Promise<string | null> = async () => null;
let onUnauthorized: () => void = () => {};

export function configureApi(opts: {
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

const auth: Middleware = {
  async onRequest({ request }) {
    const token = await getToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) onUnauthorized();
    return response;
  },
};

export const api = createClient<paths>({
  baseUrl:
    env.apiUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'),
});
api.use(auth);

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Unwrap an openapi-fetch result. Throw an ApiError with the message from the error body. */
export function unwrap<T>(res: { data?: T; error?: unknown; response: Response }): T {
  if (res.error !== undefined || res.data === undefined) {
    const body = res.error as { error?: { code?: string; message?: string } } | undefined;
    if (res.response.ok) return undefined as T;
    throw new ApiError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? 'Something went wrong. Try again.',
      res.response.status,
    );
  }
  return res.data;
}
