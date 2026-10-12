# PMServers dashboard: build plan

This file is the build plan for the PMS Cloud console (the PMServers dashboard). The VM service was removed on 2026-10-11.
Read all of it before you start. Build in the order of the milestones.

## 1. Context

PMServers is a joke cloud provider. We operate it as a serious cloud provider. The public brand is "PMS Cloud".
The shared memory for all PMServers work is the agent wiki at `~/jokes/pmservers/agent-wiki`.
Read `index.md` there before you start. After each task, run the `pmservers-handoff` skill.

The first services are:

| Service | What the user gets |
|---|---|
| Containers | Run an image with a public HTTPS URL. Idle containers scale to zero. |
| Object storage | S3-compatible buckets |
| AI | One OpenAI-compatible endpoint with LLM, embedding and decision models. One API key for each use, with a model list and a budget. |

## 2. Scope

- **Build:** only the frontend. This repo is **open source**.
- **Do not build:** the backend. It is a separate, **private** repo that we build later. It will run at `api.pmservers.org` and deploy to Kubernetes.
- **Supabase:** only auth and user storage (`auth.users`). Do not make database tables now.
- **Hosting:** Cloudflare Pages, as static files. Do not use server code.

```
Browser ──► Frontend (static, Cloudflare Pages)
              │
              ├── login ─────────────────────► Supabase Auth
              │
              └── HTTPS + Supabase JWT ──────► api.pmservers.org (private backend, later)
```

The frontend gets a session from Supabase. It sends the access token to the API as `Authorization: Bearer <jwt>`.
The backend checks the token and reads the user ID from the `sub` claim.

Because the backend does not exist yet, the frontend must work fully against a **mock API** (see section 6).

## 3. Design reference

`docs/mockup.html` is the approved design. Open it in a browser and copy it closely:
layout, colors, type, spacing, cards, side sheet, create dialog, ⌘K palette, toasts, login page.
The mockup is one HTML file with vanilla JS. Do not copy its code structure. Rebuild it with the stack below.

Main parts of the design:

- **Theme:** dark first, with a light theme. Fonts: Geist and Geist Mono. Colors: see the `:root` tokens in the mockup. Put them in the Tailwind theme as CSS variables.
- **Top bar:** sticky, with blur. Logo `/` account `/` project switcher. Search button (⌘K), docs, theme toggle, user menu. Tabs below it: Overview, Containers, Storage, AI, Settings.
- **Overview:** project name and meta line, a "New" menu, 4 usage cards (vCPU, memory, storage, AI spend) with sparklines and bars, filterable resource cards, and an activity timeline.
- **Service pages:** a grid of resource cards and a dashed "create" card.
- **Resource card:** icon, name, type and age, status dot, one info line, and a sparkline (when running) or an error box (when failed).
- **Side sheet:** opens when you click a card. It shows actions, details and the parts for each type (SSH command, logs, spend, code sample).
- **Create dialog:** centered, with option tiles for sizes and images.
- **Command palette (⌘K / Ctrl+K):** actions, navigation and resources, with keyboard control.
- **Toasts:** bottom right.
- **Login:** split screen (art panel and form). GitHub OAuth and email/password.

## 4. Stack

| Part | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript (strict) | Same as the landing page |
| Package manager | pnpm | |
| Build | `output: 'export'` in `next.config.mjs` | Static files in `out/` |
| Styles | Tailwind CSS v4 and shadcn/ui | Change the shadcn tokens to the mockup tokens |
| Fonts | `geist` npm package | Do not load fonts from Google at runtime |
| Icons | `lucide-react` | |
| Auth | `@supabase/supabase-js` (browser client only) | Do not use `@supabase/ssr`. There is no server. |
| Data | `@tanstack/react-query` | Polling, cache, mutations |
| API types | `openapi-typescript` and `openapi-fetch` | Types come from `api/openapi.yaml` |
| Mock API | MSW (Mock Service Worker) | Turn it on with an env var |
| Command palette | `cmdk` (shadcn `Command`) | |
| Toasts | `sonner` (shadcn) | |
| Charts | Hand-written SVG sparkline component | Do not add a chart library for sparklines |
| Lint and format | ESLint (Next config) and Prettier | |
| Tests | Vitest for logic. Playwright for one smoke test against the mock API. | |

### Static export rules

- Do not use: middleware, route handlers, server actions, `cookies()`, `headers()`, or ISR.
- Set `images: { unoptimized: true }`, or do not use `next/image`.
- **No dynamic route segments** such as `/projects/[id]`. A static export needs all IDs at build time.
  Keep the project ID and the open resource in the query string. Example: `/containers?project=discord-bots&r=ctr_123`.
- All auth checks are on the client side. Protected pages show a loading state, then go to `/login` if there is no session.

## 5. Environment variables

All are public (`NEXT_PUBLIC_`). They are set in Cloudflare Pages at build time. Put examples in `.env.example`.

| Name | Example | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon (publishable) key. It is safe in the browser. |
| `NEXT_PUBLIC_API_URL` | `https://api.pmservers.org` | Backend base URL |
| `NEXT_PUBLIC_API_MOCK` | `1` | `1` starts the MSW mock API in the browser |
| `NEXT_PUBLIC_AUTH_MOCK` | `1` | `1` skips Supabase and uses a fake user. For local work and previews only. |

Do not commit `.env.local`. Do not commit secrets. The repo is public.

## 6. API contract

Write the contract as OpenAPI 3.1 in `api/openapi.yaml`. It is the contract between this open repo and the private backend.
Generate `src/lib/api/schema.d.ts` from it with `pnpm api:types`. Do not edit the generated file by hand.

### Conventions

- Base path: `/v1`. JSON only.
- Auth: `Authorization: Bearer <supabase access token>` on all calls. A missing or bad token gives `401`.
- IDs: string with a type prefix, for example `prj_...`, `ct_...`, `bkt_...`, `key_...`.
- Times: ISO 8601 UTC strings.
- Errors: `{ "error": { "code": "quota_exceeded", "message": "This project has no vCPU left. Delete a container or ask for more." } }`.
- Lists: `{ "items": [...] }`. Do not add pagination now.
- Create calls return `202 Accepted` with the resource in `pending` state. The backend then changes the status.
- Delete calls return `202` and set the status to `deleting`. Then the resource disappears from lists.

### Status values

`pending`, `provisioning`, `running`, `stopped`, `sleeping` (container scaled to zero), `failed`, `deleting`.
A failed resource has `status_message` with a sentence that the user can act on.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | User ID, email, plan |
| GET, POST | `/v1/projects` | List and create projects |
| GET, PATCH, DELETE | `/v1/projects/{project_id}` | |
| GET | `/v1/projects/{project_id}/usage` | Used and limit for vCPU, memory GiB, storage GB, AI spend USD. Also a 28-day series for each. |
| GET | `/v1/projects/{project_id}/events` | Activity feed, newest first |
| GET, POST | `/v1/projects/{project_id}/containers` | |
| GET, PATCH, DELETE | `/v1/projects/{project_id}/containers/{container_id}` | PATCH changes image, env, port or size |
| POST | `/v1/projects/{project_id}/containers/{container_id}/actions` | Body `{ "action": "redeploy" }` |
| GET | `/v1/projects/{project_id}/containers/{container_id}/logs` | Last 200 lines. Query `?since=` |
| GET, POST | `/v1/projects/{project_id}/buckets` | |
| GET, DELETE | `/v1/projects/{project_id}/buckets/{bucket_id}` | |
| GET, POST | `/v1/projects/{project_id}/buckets/{bucket_id}/access-keys` | POST returns the secret **once** |
| DELETE | `/v1/projects/{project_id}/buckets/{bucket_id}/access-keys/{key_id}` | |
| GET, POST | `/v1/projects/{project_id}/ai-keys` | POST returns the full key **once** |
| GET, PATCH, DELETE | `/v1/projects/{project_id}/ai-keys/{key_id}` | PATCH changes models or budget |
| POST | `/v1/projects/{project_id}/ai-keys/{key_id}/rotate` | Returns the new key once |
| GET | `/v1/catalog` | container sizes, AI models (id, type `llm` / `embedding` / `decision`, description, context or dims). The frontend reads options from here. Do not hard-code them. |

### Main schemas (fields)

- **Project:** `id`, `name`, `region` (for example `ca-tor-1`), `created_at`.
  Create body: `name`, `size`, `image`, `disk_gb`, `ssh_public_key`.
- **Container:** `id`, `name`, `status`, `status_message`, `image`, `port`, `size`, `env` (map), `scale_to_zero` (bool), `url`, `replicas_ready`, `replicas_desired`, `created_at`.
  Create body: `name`, `image`, `port`, `size`, `env`, `scale_to_zero`.
- **Bucket:** `id`, `name`, `status`, `size_limit_gb`, `used_bytes`, `object_count`, `endpoint`, `created_at`.
- **AI key:** `id`, `name`, `status`, `prefix`, `models` (string list), `budget_usd`, `spend_usd` (this month), `rate_limit_rpm`, `created_at`. The create response also has `secret`.
- **Event:** `id`, `time`, `level` (`info` / `success` / `warning` / `error`), `resource_id`, `resource_name`, `message`.

### Mock API (MSW)

- Put the handlers in `src/mocks/`. Make them from the same generated types.
- Use the sample data from `docs/mockup.html`: projects `discord-bots` and `personal-site`, and the same containers, buckets, keys and events.
- Simulate the lifecycle. A new resource is `pending`, then `provisioning` after about 1.5 s, then `running` after about 5 s. Stop, start, restart, redeploy and delete also go through these states.
- Keep the mock state in memory. A page reload resets it.
- Add a delay of about 200 ms to each response, so that loading states are visible.

## 7. Data and polling

- Use TanStack Query for all API calls. Make one hook for each endpoint, in `src/lib/api/hooks/`.
- **Polling:** while any resource in a list is in `pending`, `provisioning` or `deleting`, refetch that list every 3 s. Stop when all are stable. Use `refetchInterval` as a function of the data.
- After a create, delete or action, invalidate the list and show a toast. Show another toast when the resource gets to `running` or `failed`.
- On `401`, sign out and go to `/login`.
- Show API errors with the `message` from the error body. Do not show raw JSON.
- Show a secret (AI key, bucket access key) only once, in a dialog with a copy button and the text "You see this only once."

## 8. Routes

| Route | Content |
|---|---|
| `/login` | Login: GitHub button, email and password, links to sign up and reset |
| `/signup` | Sign up with email and password, or GitHub |
| `/reset-password` | Send a reset email. Also the page where the user sets a new password. |
| `/auth/callback` | Supabase OAuth and email-link return page. It gets the session, then goes to `/`. |
| `/` | Go to the last project's overview (remember it in `localStorage`), or to `/projects/new` if there are no projects |
| `/projects/new` | Create the first project, or another project |
| `/overview?project=` | Overview |
| `/containers?project=` | Containers |
| `/storage?project=` | Object storage |
| `/ai?project=` | AI: endpoint, code samples (curl and Python), keys, models |
| `/settings?project=` | Account details from Supabase, and delete project (the user must type the project name) |

The query parameter `r=<resource_id>` opens the side sheet for that resource. This makes links to a resource work.

## 9. Repo layout

```
api/openapi.yaml            API contract
docs/mockup.html            Approved design
infra/                      OpenTofu for Cloudflare Pages and DNS
public/mockServiceWorker.js MSW worker (generated by `msw init`)
src/app/                    Routes (section 8)
src/components/ui/          shadcn components
src/components/             TopBar, ProjectSwitcher, Tabs, UsageCard, Sparkline, ResourceCard,
                            StatusDot, ResourceSheet, CreateDialog (one form per type),
                            CommandPalette, ActivityFeed, CopyField, CodeSample, SecretDialog
src/lib/supabase.ts         Browser client
src/lib/auth.tsx            Session provider, useSession, RequireAuth
src/lib/api/                Client (openapi-fetch with the auth header), generated schema, hooks
src/mocks/                  MSW handlers and sample data
.env.example
LICENSE
README.md                   What this is, how to run with the mock, how to deploy
```

## 10. Milestones

Do them in this order. Each milestone ends with a commit. Check the acceptance items before you go on.

### M1. Skeleton

- Next.js with static export, TypeScript strict, Tailwind v4, shadcn/ui, Geist, ESLint, Prettier.
- Theme tokens from the mockup, dark and light. A theme toggle that remembers the choice.
- Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `api:types`.
- **Done when:** `pnpm build` writes `out/`, and `pnpm lint` and `pnpm typecheck` pass.

### M2. API contract and mock

- `api/openapi.yaml` with all endpoints and schemas from section 6.
- Generated types, an API client, MSW handlers with sample data and the lifecycle.
- **Done when:** with `NEXT_PUBLIC_API_MOCK=1`, a test page can list containers, and a new container goes from `pending` to `running`.

### M3. Auth

- Supabase client, session provider, RequireAuth, and the pages `/login`, `/signup`, `/reset-password`, `/auth/callback`.
- Auth mock mode (`NEXT_PUBLIC_AUTH_MOCK=1`) with a fake user `robert@example.com`.
- The API client adds the access token to each call.
- **Done when:** in mock mode you can sign in and sign out. With a real Supabase project, GitHub and email login work on `localhost:3000`.

### M4. Shell

- Top bar, project switcher (with "New project"), tabs, user menu, theme toggle, toasts.
- Command palette with actions, pages and resources, with keyboard control.
- **Done when:** all tabs open, the project switcher changes the `project` query parameter, and ⌘K / Ctrl+K works.

### M5. Overview

- Usage cards with sparklines and bars (a warning color above 75%).
- Resource cards for all types, with filter chips. Activity feed. "New" menu.
- **Done when:** it looks like the mockup overview in dark and light, and at 400 px width.

### M6. Service pages

- Containers, storage and AI pages, with the side sheet and the create dialog for each type.
- Actions: Container redeploy and delete. Bucket access keys and delete. AI key rotate and revoke.
- Secret dialog for new keys.
- AI page: endpoint, curl and Python samples (tabs), models from `/v1/catalog`.
- Container logs in the side sheet. Refresh them every 5 s while the sheet is open.
- Confirm each delete in a dialog.
- **Done when:** all flows in the mockup work against the mock API, with polling.

### M7. Settings, empty states and errors

- Settings page. Delete project with name confirmation.
- Empty states for each page, for example "No containers yet."
- Loading skeletons. Error states with a retry button.
- 404 page.
- **Done when:** a new user with no projects can create a project and then a resource, without a dead end.

### M8. Tests and CI

- Vitest: the polling interval function, status mapping, and form validation (names: lowercase letters, numbers and dashes, 3 to 40 characters).
- Playwright smoke test against the mock: sign in, create a container, see it become `running`, delete it.
- GitHub Actions: lint, typecheck, test and build on each push and PR.
- **Done when:** CI passes.

### M9. Deploy

- `infra/` with OpenTofu, the same as `pmservers-landingpage/infra/`:
  a Git-connected `cloudflare_pages_project` (build `pnpm build`, output `out`), a `cloudflare_pages_domain`, and a proxied CNAME.
- State in the shared R2 bucket with the key `pmservers-dashboard/terraform.tfstate`. See the wiki runbook `wiki/runbooks/opentofu-state.md`.
- Pages env vars from section 5. Production uses the mock API until the backend exists (`NEXT_PUBLIC_API_MOCK=1`).
- Add the production URL and the `*.pages.dev` preview URL to Supabase Auth redirect URLs.
- **Do not** run `tofu apply` without the user's approval.
- **Done when:** the site loads at the dashboard domain, and login works.

## 11. Rules for the builder

- Copy the mockup. If the mockup and this plan do not agree, this plan is correct for behavior and the mockup is correct for looks.
- Write UI text in simple, plain English. Say what happens: "Create container", then the toast "Creating worker-1".
- Use the words a user knows. Do not show internal names (Kubernetes, KubeVirt, Garage, Bifrost) in the UI.
- Do not put secrets in the repo. The repo is public.
- Keep components small. Do not add a state library. React Query and URL state are enough.
- Make all pages work at 400 px width, and with the keyboard only.
- Check `prefers-reduced-motion`.
- Commit after each milestone with a clear message.

## 12. Out of scope now

- The backend and anything in Kubernetes.
- Billing and payments. "AI spend" is only a number from the API.
- Teams, members and roles. One user owns each project.
- Supabase database tables.
- Real-time updates (SSE or WebSocket). Polling is enough now.

## 13. Open questions

Ask the user about these. Do not guess.

1. **Dashboard domain:** `console.pmservers.org` is the working name.
2. **Container URL domain:** `*.pmservers.app` in the mockup. Buying another domain is the user's decision.
3. **License** for the open source repo.
4. **GitHub repo:** probably `pretty-manageable-servers/pmservers-dashboard`. It must exist before M9.
6. **Supabase project:** the user makes it. You need the URL and anon key for M3.
