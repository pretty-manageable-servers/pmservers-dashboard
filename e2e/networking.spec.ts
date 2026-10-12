import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('robert@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'discord-bots' })).toBeVisible();
  // Navigate in the app. A reload would reset the mock state.
  await page.getByRole('link', { name: 'Networking', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Networking' })).toBeVisible();
}

test('enable Cloudflare, check a target, save, see the address', async ({ page }) => {
  await signIn(page);

  // The mock account has Tailscale connected and no Cloudflare Tunnel.
  await expect(page.getByText('Connected', { exact: true }).first()).toBeVisible();
  const cloudflare = page.locator('section', { hasText: 'Public web access through Cloudflare.' });
  await cloudflare.getByLabel('Connector token').fill('eyJ-TEST-token');
  await cloudflare.getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Replace token' })).toBeVisible();

  // The relay port 8080 is a target. Its address is the origin, so it shows at once.
  await page.getByLabel('Cloudflare Tunnel: relay-bot port 8080').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('http://relay-bot:8080', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Cloudflare Tunnel: relay-bot port 8080')).toBeChecked();
});

test('show a validation error inline for a bad Tailscale key and a clashing external port', async ({
  page,
}) => {
  await signIn(page);

  const tailscale = page.locator('section', { hasText: 'Private access for your team' });
  await tailscale.getByLabel('New auth key (optional)').fill('abc');
  await tailscale.getByRole('button', { name: 'Replace token' }).click();
  await expect(tailscale.getByText('A Tailscale auth key starts with tskey-.')).toBeVisible();

  // The database is already a Tailscale target. Give it the external port of relay-bot.
  await page.getByLabel('Tailscale external port for main port 5432').fill('8080');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Two services use external port 8080. Set another external port.').first(),
  ).toBeVisible();
});
