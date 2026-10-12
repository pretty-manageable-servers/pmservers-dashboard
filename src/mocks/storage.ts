import { delay, http, HttpResponse } from 'msw';
import type {
  Bucket,
  BucketCreate,
  Storage,
  StorageKey,
  StorageKeyCreate,
  StorageKeyWithSecret,
  StorageStatus,
} from '@/lib/api/types';
import { validateBucketName, validateKeyName } from '@/lib/storage';

/**
 * Mock object storage: one account, the same status rules and limits as the API.
 * Mock mode only: `?mockStorage=none|provisioning|active|read_only|suspended|failed|disabling|unavailable`
 * in the page URL sets the state, so each state of the Storage page can be seen.
 */

const LATENCY = 200;
const GIB = 1024 ** 3;
const LIMIT_BYTES = 10 * GIB;
const PRICE_PER_GIB_MONTH = 0.014;
const MAX_BUCKETS = 10;
const MAX_KEYS = 20;
const ENDPOINT = 'https://s3.pmservers.org';
const REGION = 'pms';

const LATER: StorageStatus[] = [
  'provisioning',
  'active',
  'read_only',
  'suspended',
  'disabling',
  'failed',
];

const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const newKeyId = () => `GK${hex(24)}`;

const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

interface MockStorage {
  status: StorageStatus | null;
  status_message: string | null;
  buckets: Bucket[];
  keys: StorageKey[];
}

function seed(): MockStorage {
  const now = new Date().toISOString();
  const bucket = (name: string, used: number, objects: number): Bucket => ({
    name,
    status: 'active',
    status_message: null,
    used_bytes: used,
    object_count: objects,
    created_at: now,
    updated_at: now,
  });
  return {
    status: 'active',
    status_message: null,
    buckets: [bucket('photos', 3.2 * GIB, 1840), bucket('site-assets', 0.8 * GIB, 96)],
    keys: [
      {
        key_id: newKeyId(),
        name: 'ci-deploy',
        permission: 'read_write',
        buckets: 'all',
        created_at: now,
        updated_at: now,
      },
      {
        key_id: newKeyId(),
        name: 'backup-reader',
        permission: 'read_only',
        buckets: ['photos'],
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

let st = seed();
let applied: string | null = null;
let unavailable = false;

export function resetStorageMock() {
  st = seed();
  applied = null;
  unavailable = false;
}

/** Set the total used bytes over all buckets (the first bucket takes the rest). */
function setTotal(bytes: number) {
  const [first, ...rest] = st.buckets;
  if (!first) return;
  const others = rest.reduce((a, b) => a + b.used_bytes, 0);
  first.used_bytes = Math.max(0, bytes - others);
}

function readMockStorage() {
  const param =
    typeof location === 'undefined'
      ? null
      : new URLSearchParams(location.search).get('mockStorage');
  if (!param || param === applied) return;
  applied = param;
  unavailable = param === 'unavailable';
  st = seed();
  if (param === 'none' || param === 'unavailable') {
    st = { status: null, status_message: null, buckets: [], keys: [] };
  } else if ((LATER as string[]).includes(param)) {
    st.status = param as StorageStatus;
    if (param === 'read_only') setTotal(LIMIT_BYTES * 1.04);
    if (param === 'suspended') setTotal(LIMIT_BYTES * 1.28);
    if (param === 'failed') st.status_message = 'The storage did not start. We are looking at it.';
  }
}

const used = () => st.buckets.reduce((a, b) => a + b.used_bytes, 0);

function view(): Storage {
  const over = Math.max(0, used() - LIMIT_BYTES) / GIB;
  return {
    status: st.status,
    status_message: st.status_message,
    endpoint: ENDPOINT,
    region: REGION,
    used_bytes: Math.round(used()),
    limit_bytes: LIMIT_BYTES,
    buckets_count: st.buckets.length,
    buckets_limit: MAX_BUCKETS,
    keys_count: st.keys.length,
    keys_limit: MAX_KEYS,
    would_cost_usd: Math.round(over * PRICE_PER_GIB_MONTH * 10000) / 10000,
  };
}

const notEnabled = () => err(409, 'conflict', 'Turn on object storage first.');

/** Storage handlers. `isApproved` tells whether the mock account has access. */
export const storageHandlers = (isApproved: () => boolean) => {
  const base = '*/v1/storage';
  return [
    http.get(base, async () => {
      await delay(LATENCY);
      readMockStorage();
      return HttpResponse.json(view());
    }),

    http.post(`${base}/enable`, async () => {
      await delay(LATENCY);
      readMockStorage();
      if (!isApproved())
        return err(
          403,
          'not_allowed',
          'Object storage is for approved accounts. Ask the PMServers team.',
        );
      if (unavailable) return err(403, 'not_available', 'Object storage is not available now.');
      if (st.status === null) {
        st.status = 'provisioning';
        st.status_message = null;
        setTimeout(() => {
          if (st.status === 'provisioning') st.status = 'active';
        }, 2500);
      }
      return HttpResponse.json(view(), { status: 202 });
    }),

    http.post(`${base}/disable`, async () => {
      await delay(LATENCY);
      readMockStorage();
      if (st.status === null) return err(409, 'conflict', 'Object storage is not turned on.');
      if (st.buckets.length > 0) return err(409, 'conflict', 'Delete all buckets first.');
      st.status = 'disabling';
      setTimeout(() => {
        st = { status: null, status_message: null, buckets: [], keys: [] };
      }, 2000);
      return HttpResponse.json(view(), { status: 202 });
    }),

    // Buckets
    http.get(`${base}/buckets`, async () => {
      await delay(LATENCY);
      readMockStorage();
      return HttpResponse.json({ items: st.buckets });
    }),

    http.post(`${base}/buckets`, async ({ request }) => {
      await delay(LATENCY);
      readMockStorage();
      const body = (await request.json()) as BucketCreate;
      if (st.status === null) return notEnabled();
      if (st.status !== 'active' && st.status !== 'read_only')
        return err(
          409,
          'conflict',
          `Object storage must be active or read-only for this. Now it is ${st.status}.`,
        );
      const nameErr = validateBucketName(body.name);
      if (nameErr) return err(422, 'validation_error', nameErr);
      if (st.buckets.length >= MAX_BUCKETS)
        return err(409, 'quota_exceeded', `You can have ${MAX_BUCKETS} buckets. Delete one first.`);
      if (st.buckets.some((b) => b.name === body.name))
        return err(409, 'conflict', 'The bucket name is taken. Choose another name.');
      const now = new Date().toISOString();
      const b: Bucket = {
        name: body.name,
        status: 'provisioning',
        status_message: null,
        used_bytes: 0,
        object_count: 0,
        created_at: now,
        updated_at: now,
      };
      st.buckets.push(b);
      setTimeout(() => {
        if (b.status === 'provisioning') b.status = 'active';
      }, 2000);
      return HttpResponse.json(b, { status: 202 });
    }),

    http.get(`${base}/buckets/:name`, async ({ params }) => {
      await delay(LATENCY);
      const b = st.buckets.find((x) => x.name === params.name);
      return b ? HttpResponse.json(b) : err(404, 'not_found', 'Bucket not found.');
    }),

    http.delete(`${base}/buckets/:name`, async ({ params }) => {
      await delay(LATENCY);
      const b = st.buckets.find((x) => x.name === params.name);
      if (!b) return err(404, 'not_found', 'Bucket not found.');
      b.status = 'deleting';
      b.status_message = null;
      setTimeout(() => {
        // Garage refuses to delete a bucket that is not empty.
        if (b.object_count > 0) {
          b.status = 'active';
          b.status_message =
            'Garage refuses to delete a bucket that is not empty. Delete its files first.';
          return;
        }
        st.buckets = st.buckets.filter((x) => x !== b);
      }, 1500);
      return new HttpResponse(null, { status: 202 });
    }),

    // Access keys
    http.get(`${base}/keys`, async () => {
      await delay(LATENCY);
      readMockStorage();
      return HttpResponse.json({ items: st.keys });
    }),

    http.post(`${base}/keys`, async ({ request }) => {
      await delay(LATENCY);
      readMockStorage();
      const body = (await request.json()) as StorageKeyCreate;
      if (st.status !== 'active')
        return err(
          409,
          'conflict',
          `Object storage must be active for this. Now it is ${st.status ?? 'off'}.`,
        );
      const nameErr = validateKeyName(body.name);
      if (nameErr) return err(422, 'validation_error', nameErr);
      if (st.keys.length >= MAX_KEYS)
        return err(409, 'quota_exceeded', `You can have ${MAX_KEYS} keys. Delete one first.`);
      if (body.buckets !== 'all') {
        if (body.buckets.length === 0)
          return err(422, 'validation_error', 'Choose at least one bucket, or all.');
        const known = new Set(st.buckets.filter((b) => b.status !== 'deleting').map((b) => b.name));
        if (!body.buckets.every((n) => known.has(n)))
          return err(
            422,
            'validation_error',
            'One or more buckets are not buckets of this account.',
          );
      }
      const now = new Date().toISOString();
      const k: StorageKey = {
        key_id: newKeyId(),
        name: body.name.trim(),
        permission: body.permission,
        buckets: body.buckets,
        created_at: now,
        updated_at: now,
      };
      st.keys.push(k);
      const withSecret: StorageKeyWithSecret = {
        ...k,
        secret_access_key: hex(64),
        endpoint: ENDPOINT,
        region: REGION,
      };
      return HttpResponse.json(withSecret, { status: 201 });
    }),

    http.get(`${base}/keys/:kid`, async ({ params }) => {
      await delay(LATENCY);
      const k = st.keys.find((x) => x.key_id === params.kid);
      return k ? HttpResponse.json(k) : err(404, 'not_found', 'Key not found.');
    }),

    http.delete(`${base}/keys/:kid`, async ({ params }) => {
      await delay(LATENCY);
      if (!st.keys.some((x) => x.key_id === params.kid))
        return err(404, 'not_found', 'Key not found.');
      st.keys = st.keys.filter((x) => x.key_id !== params.kid);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${base}/keys/:kid/reset`, async ({ params }) => {
      await delay(LATENCY);
      const old = st.keys.find((x) => x.key_id === params.kid);
      if (!old) return err(404, 'not_found', 'Key not found.');
      // A reset makes a new key ID with the same name, permission and buckets. The old key goes.
      const k: StorageKey = { ...old, key_id: newKeyId(), updated_at: new Date().toISOString() };
      st.keys = st.keys.map((x) => (x === old ? k : x));
      return HttpResponse.json({
        ...k,
        secret_access_key: hex(64),
        endpoint: ENDPOINT,
        region: REGION,
      });
    }),
  ];
};
