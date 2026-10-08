import { expect, test } from '@playwright/test';

test('sign in, create a VM, see it run, delete it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();
  await page.getByRole('link', { name: /Virtual machines/ }).click();

  await page.getByRole('button', { name: 'Create VM' }).first().click();
  await page.getByLabel('Name').fill('smoke-test');
  await page
    .getByLabel('SSH public key')
    .fill('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK3x me@laptop');
  await page.getByRole('dialog').getByRole('button', { name: 'Create VM' }).click();

  const card = page.getByRole('button', { name: /smoke-test/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Pending');
  await expect(card).toContainText('Running', { timeout: 20_000 });

  await card.click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete VM' }).click();
  await expect(page.getByRole('button', { name: /smoke-test/ })).toHaveCount(0, {
    timeout: 20_000,
  });
});
