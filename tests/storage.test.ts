import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import type { Project } from '@/lib/api/types';
import {
  awsCliSnippet,
  canCreateBuckets,
  canCreateKeys,
  envSnippet,
  isNotAvailable,
  keyBucketsLabel,
  publicUrl,
  storageAccount,
  usageLevel,
  usagePercent,
  validateBucketName,
  validateKeyName,
} from '@/lib/storage';

describe('validateBucketName', () => {
  it.each(['abc', 'my-bucket', 'a1b', 'x'.repeat(63)])('accepts %s', (n) =>
    expect(validateBucketName(n)).toBeNull(),
  );
  it.each(['ab', 'x'.repeat(64), 'My-bucket', '-abc', 'abc-', 'a.b', 'a_b', ''])(
    'rejects %j',
    (n) => expect(validateBucketName(n)).not.toBeNull(),
  );
  it.each(['www', 'api', 'admin', 'pub', 'pmservers', 'mail'])('reserves %s', (n) =>
    expect(validateBucketName(n)).toBe('This name is reserved. Choose another name.'),
  );
});

describe('validateKeyName', () => {
  it('accepts 1 to 64 characters', () => {
    expect(validateKeyName('a')).toBeNull();
    expect(validateKeyName('x'.repeat(64))).toBeNull();
  });
  it('rejects an empty or long name', () => {
    expect(validateKeyName('   ')).not.toBeNull();
    expect(validateKeyName('x'.repeat(65))).not.toBeNull();
  });
});

describe('usage levels', () => {
  it('uses the marks at 90, 100 and 125 percent', () => {
    expect(usageLevel(89.9)).toBe('ok');
    expect(usageLevel(90)).toBe('warn');
    expect(usageLevel(99.9)).toBe('warn');
    expect(usageLevel(100)).toBe('read_only');
    expect(usageLevel(124.9)).toBe('read_only');
    expect(usageLevel(125)).toBe('suspended');
  });
  it('gives 0 percent for a zero limit', () => {
    expect(usagePercent(5, 0)).toBe(0);
    expect(usagePercent(5, 10)).toBe(50);
  });
});

describe('status rules', () => {
  it('makes buckets when active or read-only', () => {
    expect(canCreateBuckets('active')).toBe(true);
    expect(canCreateBuckets('read_only')).toBe(true);
    expect(canCreateBuckets('suspended')).toBe(false);
    expect(canCreateBuckets(null)).toBe(false);
  });
  it('makes keys only when active', () => {
    expect(canCreateKeys('active')).toBe(true);
    expect(canCreateKeys('read_only')).toBe(false);
  });
});

describe('storageAccount', () => {
  const base = { id: 'prj_1', name: 'p', region: 'ca-tor-1', created_at: '' };
  it('uses the caller account for the owner', () => {
    const p: Project = { ...base, role: 'owner', owner_id: 'u-1' };
    expect(storageAccount(p)).toBeUndefined();
  });
  it('uses the owner account for a member', () => {
    const p: Project = { ...base, role: 'member', owner_id: 'u-1' };
    expect(storageAccount(p)).toBe('u-1');
  });
});

describe('isNotAvailable', () => {
  it('is true for the 403 of a switched-off feature', () => {
    expect(
      isNotAvailable(new ApiError('not_allowed', 'Object storage is not available now.', 403)),
    ).toBe(true);
  });
  it('is false for the approval 403 and other errors', () => {
    expect(
      isNotAvailable(new ApiError('not_allowed', 'Object storage is for approved accounts.', 403)),
    ).toBe(false);
    expect(isNotAvailable(new Error('not available'))).toBe(false);
  });
});

describe('snippets and links', () => {
  it('builds the env lines from the key response', () => {
    const text = envSnippet({
      key_id: 'GK0123',
      secret_access_key: 'secret',
      endpoint: 'https://s3.pmservers.org',
      region: 'pms',
    });
    expect(text.split('\n')).toEqual([
      'export AWS_ACCESS_KEY_ID=GK0123',
      'export AWS_SECRET_ACCESS_KEY=secret',
      'export AWS_ENDPOINT_URL=https://s3.pmservers.org',
      'export AWS_REGION=pms',
    ]);
  });
  it('uses the bucket in the AWS CLI example', () => {
    expect(awsCliSnippet('photos')).toContain('aws s3 cp ./photo.jpg s3://photos/photo.jpg');
    expect(awsCliSnippet(undefined)).toContain('s3://my-bucket/photo.jpg');
  });
  it('builds the public URL', () => {
    expect(publicUrl('site-assets')).toBe('https://site-assets.pub.pmservers.org/');
  });
  it('labels the bucket scope of a key', () => {
    expect(keyBucketsLabel('all')).toBe('All buckets');
    expect(keyBucketsLabel(['a', 'b'])).toBe('a, b');
    expect(keyBucketsLabel([])).toBe('No buckets');
  });
});
