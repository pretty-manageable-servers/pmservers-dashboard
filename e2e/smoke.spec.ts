import { expect, test } from '@playwright/test';

test('invite a member, then remove them', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();

  await page.getByRole('link', { name: /Settings/ }).click();
  await expect(page.getByText('robert@example.com (you)')).toBeVisible();
  await page.getByLabel('Invite by email').fill('not-an-email');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  await page.getByLabel('Invite by email').fill('Ann@Example.com');
  await page.getByRole('button', { name: 'Invite' }).click();
  await expect(page.getByText('ann@example.com', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove member' }).click();
  await expect(page.getByText('ann@example.com', { exact: true })).toHaveCount(0);
});

test('request container access, create a container, stop it, delete it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();

  // The mock reads the access state from the page URL.
  await page.goto('/containers?project=prj_discord-bots&mockAccess=none');
  await page.getByRole('button', { name: 'Request access' }).click();
  await expect(page.getByText('Tell us what you want to run.')).toBeVisible();
  await page.getByLabel('What do you want to run?').fill('A Discord bot for my server.');
  await page.getByRole('button', { name: 'Request access' }).click();
  await expect(page.getByText('Your request is waiting for review.')).toBeVisible();
  // The mock admin approves. The page goes to the list with no reload.
  await expect(page.getByRole('button', { name: /relay-bot/ })).toBeVisible({ timeout: 30_000 });

  // The account has 2 containers, the limit. Delete one first.
  await page.getByRole('button', { name: /cron-worker/ }).click();
  await expect(page.getByText("KeyError: 'API_TOKEN'")).toHaveCount(0);
  await page.getByLabel('Previous run').check();
  await expect(page.getByText("KeyError: 'API_TOKEN'")).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete container' }).click();
  await expect(page.getByRole('button', { name: /cron-worker/ })).toHaveCount(0, {
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Create container' }).first().click();
  await page.getByLabel('Name').fill('smoke-ct');
  await page.getByLabel('Image').fill('ghcr.io/robert/smoke:1.0');
  await expect(page.getByLabel('Registry credential')).toContainText('ghcr-bots');
  await page.getByRole('button', { name: 'Add variable' }).click();
  await page.getByLabel('Variable 1 name').fill('TOKEN');
  await page.getByLabel('Variable 1 value').fill('secret');
  await page.getByRole('dialog').getByRole('button', { name: 'Create container' }).click();

  const card = page.getByRole('button', { name: /smoke-ct/ });
  await expect(card).toContainText('Running', { timeout: 20_000 });
  await card.click();
  await expect(page.getByText('Heartbeat')).not.toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('TOKEN', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete container' }).click();
  await expect(page.getByRole('button', { name: /smoke-ct/ })).toHaveCount(0, {
    timeout: 20_000,
  });
});

test('create a database, see the password once, reset it, delete it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();

  await page.getByRole('link', { name: /Databases/ }).click();
  // The mock account allows one database. Delete the seeded one first.
  await page.getByRole('button', { name: /main/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete database' }).click();
  await expect(page.getByText('No databases yet')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Create database' }).first().click();
  await page.getByLabel('Name').fill('shop');
  await page.getByLabel(/Enable vector/).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Create database' }).click();

  const secret = page.getByRole('dialog', { name: 'Database created' });
  await expect(secret).toContainText('postgresql://app:');
  await expect(secret).toContainText('only once');
  await secret.getByRole('button', { name: 'Done' }).click();

  const card = page.getByRole('button', { name: /shop/ });
  await expect(card).toContainText('Running', { timeout: 20_000 });
  await card.click();
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByRole('dialog', { name: 'Password reset' })).toContainText('postgresql://');
});

test('create an API token, see it once, then revoke it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();

  await page.getByRole('link', { name: /Settings/ }).click();
  await page.getByRole('link', { name: 'API tokens' }).click();
  await page.getByRole('button', { name: 'Create token' }).first().click();
  await page.getByLabel('Name').fill('ci-deploy');
  await page.getByLabel('Expires').selectOption('30');
  await page.getByRole('dialog').getByRole('button', { name: 'Create token' }).click();

  const created = page.getByRole('dialog', { name: 'Your new token' });
  await expect(created).toContainText('You will not see it again.');
  const token = await created.locator('code').innerText();
  expect(token).toMatch(/^pms_/);
  await created.getByRole('button', { name: 'Done' }).click();

  // The list shows the prefix only. The full token is never shown again.
  const row = page.getByRole('row', { name: /ci-deploy/ });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText(token);
  await page.getByRole('button', { name: 'Revoke ci-deploy' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke token' }).click();
  await expect(page.getByRole('row', { name: /ci-deploy/ })).toHaveCount(0);
});

test('the Sandboxes page explains how to start one, then a running sandbox can be killed', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();

  // The URL flag gives the empty state. A reload resets the mock state, so the seeded sandbox comes back.
  await page.goto('/sandboxes?project=prj_discord-bots&mockSandboxes=empty');
  await expect(page.getByRole('heading', { name: /Sandboxes/ })).toContainText('Beta');
  await expect(page.getByText('No sandboxes running')).toBeVisible();
  await expect(page.getByText('E2B_SANDBOX_URL=https://sandbox.pmservers.org')).toBeVisible();

  await page.goto('/sandboxes?project=prj_discord-bots');
  const row = page.getByRole('row', { name: /q7d3k9m2/ });
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: /Kill q7d3k9m2/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kill sandbox' }).click();
  await expect(page.getByText('No sandboxes running')).toBeVisible({ timeout: 20_000 });
});
