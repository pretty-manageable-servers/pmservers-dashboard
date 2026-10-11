# PMS Cloud console

The dashboard for PMS Cloud (PMServers). It is a static frontend. Next.js 15 exports it to plain files.

- Features: **containers**, **databases**, **sandboxes** and **AI keys**. Containers need approval for each account. Storage shows "Coming soon".
- Auth: Supabase Auth (browser client only). No Supabase tables.
- Data: the private PMS Cloud API at `api.pmservers.org`. The contract is [`api/openapi.json`](api/openapi.json). The API generates it. Do not edit it. Update it with `scripts/sync-api-contract.sh <path to the API's openapi/public.json>`.
  Until the backend exists, a mock API (MSW) runs in the browser.
- Design: [`docs/mockup.html`](docs/mockup.html). Build plan: [`PLAN.md`](PLAN.md).

## Run with the mock

```sh
pnpm install
cp .env.example .env.local   # NEXT_PUBLIC_API_MOCK=1 and NEXT_PUBLIC_AUTH_MOCK=1
pnpm dev                     # http://localhost:3000
```

With `NEXT_PUBLIC_AUTH_MOCK=1` you sign in as a fake user. Any email and password work.
The mock state is in memory. A page reload resets it.

To use real login, set `NEXT_PUBLIC_AUTH_MOCK=0` and fill in the Supabase URL and anon key.
Add `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password` to the Supabase Auth redirect URLs.

## Scripts

| Command                       | What it does                                           |
| ----------------------------- | ------------------------------------------------------ |
| `pnpm dev`                    | Dev server                                             |
| `pnpm build`                  | Static export to `out/`                                |
| `pnpm lint`, `pnpm typecheck` | Checks                                                 |
| `pnpm test`                   | Unit tests (Vitest)                                    |
| `pnpm test:e2e`               | Smoke test (Playwright) against the mock               |
| `pnpm api:types`              | Make `src/lib/api/schema.d.ts` from `api/openapi.json` |

## Deploy

Cloudflare Pages builds `pnpm build` and serves `out/`. The OpenTofu config is in [`infra/`](infra/).
State is in the shared R2 bucket. Do not run `tofu apply` without approval.
All `NEXT_PUBLIC_*` values are public. Never commit secrets.
