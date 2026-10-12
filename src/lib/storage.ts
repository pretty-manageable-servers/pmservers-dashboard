import { ApiError } from './api/client';
import type {
  BucketStatus,
  Project,
  StorageKey,
  StorageKeyPermission,
  StorageStatus,
} from './api/types';

/** Client checks for object storage. The API checks again. Same rules as the API. */

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
// Names of our own hosts and pages. A bucket cannot take them.
const RESERVED_BUCKET_NAMES = new Set([
  'www',
  'api',
  'admin',
  's3',
  'pub',
  'pmservers',
  'console',
  'docs',
  'status',
  'mail',
  'auth',
  'sandbox',
  'jump',
]);

export const BUCKET_RULES = [
  '3 to 63 characters',
  'Lowercase letters, digits and dashes',
  'Start and end with a letter or digit',
  'Names are unique in all of PMServers',
];

export function validateBucketName(name: string): string | null {
  if (!BUCKET_NAME.test(name)) {
    return 'Use 3 to 63 characters: lowercase letters, digits and dashes. Start and end with a letter or digit.';
  }
  return RESERVED_BUCKET_NAMES.has(name) ? 'This name is reserved. Choose another name.' : null;
}

export function validateKeyName(name: string): string | null {
  const length = name.trim().length;
  return length >= 1 && length <= 64 ? null : 'Enter a name of 1 to 64 characters.';
}

/** Share an object with a presigned URL. The link works without a key until it expires (max 7 days). */
export const SHARE_COMMAND =
  'aws s3 presign s3://<bucket>/<key> --expires-in 3600 --endpoint-url https://s3.pmservers.org';

// Usage thresholds, as a percent of the account limit. The API applies them.
export const USAGE_MARKS = [90, 100, 125] as const;
/** The usage bar ends at this percent of the limit. */
export const USAGE_SCALE = 125;

export type UsageLevel = 'ok' | 'warn' | 'read_only' | 'suspended';

export const usagePercent = (used: number, limit: number) => (limit > 0 ? (used / limit) * 100 : 0);

/** 90 to 100 percent: a warning. 100 to 125: read-only. 125 and more: suspended. */
export function usageLevel(percent: number): UsageLevel {
  if (percent >= 125) return 'suspended';
  if (percent >= 100) return 'read_only';
  if (percent >= 90) return 'warn';
  return 'ok';
}

export const STORAGE_STATUS_LABEL: Record<StorageStatus, string> = {
  provisioning: 'Setting up',
  active: 'Active',
  read_only: 'Read-only',
  suspended: 'Suspended',
  disabling: 'Turning off',
  failed: 'Failed',
};

/** What the customer can do about a state. The API status_message is shown too. */
export const STORAGE_STATUS_HELP: Partial<Record<StorageStatus, string>> = {
  provisioning: 'We are setting up object storage. This takes about one minute.',
  read_only:
    'Your account uses all of the storage limit. Writes fail. Reads and deletes still work. Delete files to make space. Writes start again below 90 percent.',
  suspended:
    'Your account uses much more than the storage limit, so all access is blocked. Contact support.',
  disabling: 'We are turning off object storage and removing its data.',
  failed: 'Setup failed. We try again by ourselves. You do not need to do anything.',
};

export const BUCKET_STATUS_LABEL: Record<BucketStatus, string> = {
  provisioning: 'Setting up',
  active: 'Active',
  deleting: 'Deleting',
  failed: 'Failed',
};

export const isBucketBusy = (s: BucketStatus) => s === 'provisioning' || s === 'deleting';

/** Buckets can be made when the account is active or read-only (the API rule). */
export const canCreateBuckets = (s: StorageStatus | null) => s === 'active' || s === 'read_only';

/** Keys can be made only when the account is active (the API rule). */
export const canCreateKeys = (s: StorageStatus | null) => s === 'active';

export const PERMISSION_LABEL: Record<StorageKeyPermission, string> = {
  read_write: 'Read and write',
  read_only: 'Read only',
};

export const keyBucketsLabel = (buckets: StorageKey['buckets']) =>
  buckets === 'all' ? 'All buckets' : buckets.length ? buckets.join(', ') : 'No buckets';

export const usd = (amount: number) => `$${amount.toFixed(2)}`;

/**
 * The account of the storage. A member uses the owner's account, so the API gets the owner's ID.
 * The owner uses their own account, so no ID is sent.
 */
export function storageAccount(project: Project): string | undefined {
  return project.role === 'owner' ? undefined : project.owner_id;
}

/** The API says the feature is not available now (the global switch is off). Checks the code only. */
export const isNotAvailable = (e: unknown) => e instanceof ApiError && e.code === 'not_available';

export const ENV_SNIPPET_TITLE = 'Env vars';
export const CLI_SNIPPET_TITLE = 'AWS CLI';

/** Shell lines for the access key. The region and endpoint come from the API response. */
export function envSnippet(k: {
  key_id: string;
  secret_access_key: string;
  endpoint: string;
  region: string;
}): string {
  return [
    `export AWS_ACCESS_KEY_ID=${k.key_id}`,
    `export AWS_SECRET_ACCESS_KEY=${k.secret_access_key}`,
    `export AWS_ENDPOINT_URL=${k.endpoint}`,
    `export AWS_REGION=${k.region}`,
  ].join('\n');
}

export function awsCliSnippet(bucket: string | undefined): string {
  const b = bucket || 'my-bucket';
  return [
    '# Set the variables of the Env vars tab first.',
    '# AWS CLI v2 reads AWS_ENDPOINT_URL. Older versions need --endpoint-url https://s3.pmservers.org',
    '# Use path style (once): aws configure set default.s3.addressing_style path',
    'aws s3 ls',
    `aws s3 cp ./photo.jpg s3://${b}/photo.jpg`,
    `aws s3 cp s3://${b}/photo.jpg ./photo.jpg`,
  ].join('\n');
}

/** The SDK settings for path style. Only path style works: no virtual host style. */
export const PATH_STYLE_SETTINGS = [
  { sdk: 'AWS CLI', setting: 'aws configure set default.s3.addressing_style path' },
  { sdk: 'boto3', setting: 'Config(s3={"addressing_style": "path"})' },
  { sdk: 'JavaScript SDK v3', setting: 'forcePathStyle: true' },
];

/** The SDK settings for the checksum problem. Garage returns a wrong checksum for some multipart objects. */
export const CHECKSUM_SETTINGS = [
  { sdk: 'boto3', setting: 'Config(response_checksum_validation="when_required")' },
  { sdk: 'JavaScript SDK v3', setting: 'responseChecksumValidation: "WHEN_REQUIRED"' },
];
