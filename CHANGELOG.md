# Changelog

## 2026-08-23 — Production HTTPS outage: three compounding deploy-pipeline bugs

Production (`fhir.applied-thoughts.com`) was unreachable on both HTTP and
HTTPS (connections refused on 80/443). Root-caused and fixed across four
releases; each fix uncovered the next issue once the deploy pipeline could
actually be trusted to run the code it claimed to run.

### 1. ACME cert wait was a fixed sleep (v1.1.2)

`deploy-production.sh` slept a fixed 20s for Let's Encrypt's HTTP-01
challenge, which can take 30-60s. Replaced with a retry loop polling
`/fhir/metadata` over HTTPS for up to 90s.

### 2. Self-modifying deploy script masked every fix above (v1.1.3)

`deploy-production.sh` ran `git fetch && git reset --hard origin/master` on
**itself** partway through its own execution. Bash buffers a script's
contents at process start, so the self-pull silently ran the rest of that
same invocation using stale, pre-fix logic — meaning v1.1.2's fix (and
likely prior "fix(prod)" commits) never actually took effect on their own
tagged deploy. Confirmed by v1.1.2's own deploy log still printing text the
commit had removed.

**Fixed:** moved the `git fetch`/`reset` into the GitHub Actions SSH step,
run *before* invoking `bash scripts/deploy-production.sh` as a fresh
process, guaranteeing the script executed is the one on disk.

### 3. Caddy was crash-looping since HTTPS was enabled (v1.1.4)

With the pipeline now trustworthy, the real fault surfaced: `docker compose
logs caddy` showed a continuous crash loop —
`unrecognized global option: reverse_proxy`. The `caddy` service in
`docker-compose.prod.yml` had no `environment:` block, so `DOMAIN` never
reached the Caddy process; `{$DOMAIN}` in the Caddyfile resolved empty,
turning the site block into Caddy's *global options* block, where
`reverse_proxy` isn't valid. Caddy refused to start, so nothing ever
listened on 80/443. **Fixed:** added `environment: DOMAIN: ${DOMAIN}` to the
`caddy` service.

### 4. Duplicate security response headers (v1.1.5)

Found while building the production smoke-test script: `/fhir/*` responses
carried `X-Content-Type-Options` and `X-Frame-Options` **twice** — Caddy's
standalone `header {}` block sets them on the request path (before
`reverse_proxy` runs), and `reverse_proxy` then *adds* (not replaces) the
same headers already returned by the backend (Spring Security defaults).
Valid per HTTP spec, but breaks strict clients (.NET's `HttpClient`, and by
extension PowerShell 7's `Invoke-RestMethod`/`Invoke-WebRequest`) with
`InvalidOperationException`. **Fixed:** moved the three headers into
`reverse_proxy`'s `header_down` subdirective, which runs after the upstream
response is received and correctly overwrites.

### Added

- **`scripts/smoke-test-production.ps1`** — end-to-end verification against
  the live deployment (not mocks): FHIR metadata, Admin UI reachability,
  401 enforcement, login, admin stats, full Patient CRUD, and Synthea
  generation. Documented in the README under Testing.

### Verification

All 10 smoke-test checks pass against `https://fhir.applied-thoughts.com`.
Manually re-triggered `deploy-production.yml` via `workflow_dispatch` after
all fixes landed; both jobs succeeded and production remained healthy
afterward.

### Known remaining risks

1. **Manual SSH access to the production host is unreliable from at least
   one operator's network.** Diagnosed extensively: the `deploy` user's
   `authorized_keys`, sshd config, and both RSA and ED25519 test keys were
   all verified correct; the connection is reset immediately after the
   server accepts the public key and the client sends its signature —
   reproduced identically across two independent SSH client implementations
   (Windows OpenSSH and WSL's native Linux OpenSSH), ruling out a client or
   server misconfiguration. Points to something in that network path
   (firewall/VPN/ISP-level interference). **Does not affect the CI/CD
   pipeline**, which authenticates successfully via its own dedicated key
   (`fhir-platform-deploy@github-actions`) on every run.
2. **`Location`/`Content-Location` headers on FHIR responses use `http://`
   even when served over HTTPS**, likely a missing `X-Forwarded-Proto`
   passthrough from nginx to `fhir-server`. Cosmetic; not yet fixed.

## 2026-08-10 — Admin UI session, authorization, pagination and environment configuration

Reported as *"error loading stats on multiple pages"* in the admin UI.
Investigation found the reported symptom plus several unrelated defects, one of
them a security vulnerability. All are fixed and verified.

### The reported bug

JWT sessions expire after 24 hours. Three layers combined to turn that into a
confusing failure:

1. `JwtAuthFilter` silently ignored an invalid or expired token, letting the
   request continue anonymously with no signal that authentication had failed.
2. `SecurityConfig` configured no `AuthenticationEntryPoint`, so Spring fell
   back to `Http403ForbiddenEntryPoint` and answered unauthenticated requests
   with **403** — indistinguishable from a genuine permission failure.
3. The axios interceptor only reacted to 401, so the 403 passed through without
   clearing credentials or redirecting to login.

The app therefore stayed *apparently* signed in while every `/api/admin/**`
call failed. Because `/fhir/**` is public, Patients and Resource Explorer kept
working while Dashboard, Users and Synthea broke — that split was the
diagnostic giveaway.

**Fixed in #5.** `JwtUtil.checkToken` now distinguishes `VALID` / `EXPIRED` /
`INVALID`; unauthenticated requests return **401** with a reason code
(`token_expired`, `invalid_token`, `unauthorized`), while **403** is reserved
for an authenticated user lacking the role. The client redirects on 401 only,
and shows the reason on the login screen.

### Security: unauthenticated privilege escalation

Found while implementing the above. `/api/auth/register` was `permitAll` **and**
honoured a caller-supplied role, so **any unauthenticated party who could reach
the server could create themselves a working ADMIN account.** Confirmed against
a running instance: `201 Created`, no credentials required. The account created
during testing was deleted immediately.

**Fixed in #6.** Only `/api/auth/login` is public; registration requires ADMIN,
and both creation paths validate the role against `AppUser.VALID_ROLES`.

### Other defects found

| Defect | Detail | PR |
|---|---|---|
| `POST /api/admin/users` did not exist | The admin UI had always called it, so "Create User" silently failed against an unmapped route | #6 |
| Role vocabulary mismatch | The UI offered a `USER` role the backend does not define; such an account would have matched no authority | #6 |
| Pagination did not paginate | `_offset` was ignored entirely — page 2 returned the same rows as page 1 | #6 |
| `Bundle.total` was wrong | A hardcoded 100-row cap leaked into the total, so Observation reported 100 matches when it held 3,056 | #6 |
| Dashboard rendered 2 cards, not 15 | `/api/admin/stats` returns a nested payload; the frontend typed it as flat, so one card displayed `[object Object]` | #4 |
| `JWT_SECRET` was inert | The property is `app.jwt.secret`, so the override needs `APP_JWT_SECRET`. Dev and staging both fell back to the secret committed in `application.yaml`, making tokens interchangeable between environments | #10 |
| Staging would have reintroduced it | `docker-compose.staging.yml` also set the ineffective `JWT_SECRET`; corrected before merge | #3 |

### Added

- **API Console** (`/api-console`, ADMIN only) — invoke any endpoint the
  platform exposes and inspect the raw response: status, duration, headers,
  body. Uses a dedicated axios instance so testing an unauthenticated call
  cannot sign the operator out. #8, #9
- **The project's first tests** — 23 backend tests covering JWT classification,
  the 401/403 split, admin user creation and role validation, and paging. They
  use `@WebMvcTest` slices and mocked repositories, so no MongoDB is required.
  Previously `src/test` was empty and `mvn verify` asserted nothing. #10
- **Staging environment** and auto-deploy on push to `master`. #3

### Verification

19 checks across both environments: 401/403 semantics, escalation blocked,
cross-environment token rejection in both directions, 15 resource types in
stats, paging returning distinct pages with correct totals, and all UI routes
served.

The test suite was mutation-checked rather than assumed correct: removing the
`exceptionHandling` block from `SecurityConfig` makes it fail with
`Status expected:<401> but was:<403>` — the original symptom.

### Known remaining risks

1. **No frontend test tooling.** `fhir-admin-ui` has no vitest, jest or
   Playwright. Dashboard rendering, the console auth toggle and
   redirect-on-401 are verified manually only.
2. **Both signing keys are committed placeholders.** Set `APP_JWT_SECRET` and
   `STAGING_APP_JWT_SECRET` to unique random values before either environment
   is reachable beyond localhost.
3. **Every push to `master` auto-deploys to staging** via the self-hosted
   runner.
4. **There is no production environment** defined in this repository.
