import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, path: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();
  // The mock state is set from the URL on each load, so the page is opened by URL.
  await page.goto(path);
}

test('turn on storage, make a bucket, and show a key secret once', async ({ page }) => {
  await signIn(page, '/storage?mockStorage=none');
  await page.getByRole('button', { name: 'Enable object storage' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Setting up' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Active' })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Create bucket' }).first().click();
  const bucketDialog = page.getByRole('dialog', { name: 'Create bucket' });
  await bucketDialog.getByLabel('Name').fill('photos-e2e');
  await bucketDialog.getByRole('button', { name: 'Create bucket' }).click();
  await expect(page.getByText('photos-e2e')).toBeVisible();

  await page.getByRole('button', { name: 'Create key' }).click();
  const keyDialog = page.getByRole('dialog', { name: 'Create access key' });
  await keyDialog.getByLabel('Name').fill('ci');
  await keyDialog.getByRole('button', { name: 'Create key' }).click();

  const secret = page.getByRole('dialog', { name: 'Key created' });
  await expect(secret).toBeVisible();
  await expect(secret.getByText('Secret access key', { exact: true })).toBeVisible();
  // The secret dialog closes only with Done. Escape does not close it.
  await page.keyboard.press('Escape');
  await expect(secret).toBeVisible();
  await secret.getByRole('button', { name: 'Done' }).click();
  await expect(secret).toBeHidden();
});

test('a switched-off feature shows Coming soon', async ({ page }) => {
  await signIn(page, '/storage?mockStorage=unavailable');
  await page.getByRole('button', { name: 'Enable object storage' }).click();
  await expect(page.getByText('This service is coming soon.')).toBeVisible();
});

test('an account that is not approved sees the request form', async ({ page }) => {
  await signIn(page, '/storage?mockAccess=none');
  await expect(page.getByText('Request access to object storage', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable object storage' })).toHaveCount(0);
});

test('read-only state explains what fails', async ({ page }) => {
  await signIn(page, '/storage?mockStorage=read_only');
  await expect(page.getByRole('status').filter({ hasText: 'Read-only' })).toBeVisible();
  await expect(page.getByText('Writes fail.')).toBeVisible();
});
