# Community playtest feedback

Men Eat Peanut Butter is a static browser game. The playtest loop supports two intake paths:

1. Direct form submission to a feedback API when `VITE_PLAYTEST_FEEDBACK_API_URL` is configured.
2. A prefilled issue/form fallback when `VITE_PLAYTEST_FEEDBACK_URL` is configured.

This keeps the itch build lightweight while leaving room for a volunteer moderation backend.

## Player flow

1. A player finishes a run.
2. The end screen shows **Send feedback**.
3. The game opens a feedback form with category, note, optional contact, and public-review consent.
4. If an API is configured, the game submits directly to the community queue.
5. If no API is configured or submission fails, the player can open a prefilled issue/form fallback.

The generated report includes build version, modifier, ending, spoons, Crust Credits, jar remaining, Frenzy state, and chain count.

## Recruiting and volunteer operations

Use these docs when the feedback loop is deployed:

- `docs/COMMUNITY_PLAYTEST_LAUNCH.md` - staged launch plan and readiness checklist.
- `docs/OUTREACH_COPY.md` - copy/paste recruiting posts for players and reviewers.
- `docs/VOLUNTEER_REVIEWER_GUIDE.md` - reviewer onboarding, decision rules, and escalation process.

## Configure intake

Copy `.env.example` to `.env.local` for local testing or set these variables in the release environment.

| Variable | Purpose |
| --- | --- |
| `VITE_PLAYTEST_FEEDBACK_API_URL` | Public POST endpoint for in-game feedback submissions. |
| `VITE_PLAYTEST_FEEDBACK_URL` | Fallback issue/form URL for "Open issue instead". |
| `VITE_PLAYTEST_ADMIN_API_URL` | Volunteer review API root. If unset, the admin strips a trailing `/feedback` from `VITE_PLAYTEST_FEEDBACK_API_URL`. |

### Direct feedback API

The in-game form sends:

```text
POST VITE_PLAYTEST_FEEDBACK_API_URL
Content-Type: application/json
```

Payload:

```json
{
  "schemaVersion": 1,
  "submittedAt": "2026-06-15T14:12:00.000Z",
  "category": "feel",
  "message": "The frenzy moment felt great.",
  "contact": "optional",
  "allowPublicReview": true,
  "runSummary": {
    "buildVersion": "0.1.0",
    "modifier": "Double Chunk",
    "modifierId": "double",
    "ended": "jar_empty",
    "spoons": 24,
    "crustCredits": 4,
    "jarPercent": 0,
    "frenzyActive": false,
    "chain": 3
  },
  "pageUrl": "https://example.com/game",
  "userAgent": "browser user agent"
}
```

Successful response:

```json
{ "id": "fb_123", "reviewUrl": "https://example.com/admin/fb_123" }
```

Only the POST endpoint should be public. Add rate limits and spam checks at the API layer.

## Included Cloudflare Worker API scaffold

This repo includes an optional Worker/D1 backend in `feedback-api/`.

Files:

- `wrangler.jsonc` - Worker config with placeholder D1 database ID.
- `feedback-api/migrations/0001_feedback_submissions.sql` - D1 schema.
- `feedback-api/src/index.ts` - Worker entrypoint.
- `feedback-api/src/handler.ts` - HTTP routing, CORS, auth, validation, and JSON responses.
- `feedback-api/src/store.ts` - D1 and in-memory stores.

Local setup:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars and set MODERATOR_TOKEN to a long random value
npm run db:migrate:local
npm run dev:api
```

Local frontend wiring:

```bash
VITE_PLAYTEST_FEEDBACK_API_URL="http://localhost:8787/feedback" npm run dev
VITE_PLAYTEST_ADMIN_API_URL="http://localhost:8787" npm run dev:admin
```

Production setup checklist:

1. Create the D1 database:
   ```bash
   wrangler d1 create men-eat-pb-feedback
   ```
2. Replace the placeholder `database_id` in `wrangler.jsonc`.
3. Apply migrations:
   ```bash
   wrangler d1 migrations apply men-eat-pb-feedback --remote
   ```
4. Set the moderator token as a secret:
   ```bash
   wrangler secret put MODERATOR_TOKEN
   ```
5. Set `ALLOWED_ORIGINS` to the itch/page origin instead of `*`.
6. Set `REVIEW_BASE_URL` to the deployed admin URL if you want submit responses to link reviewers there.
7. Deploy:
   ```bash
   wrangler deploy
   ```

Security notes:

- Public players only need `POST /feedback`.
- Volunteers need `Authorization: Bearer <MODERATOR_TOKEN>` for `GET /feedback` and `PATCH /feedback/:id`.
- The Worker hashes bearer tokens before comparison to avoid direct string comparison.
- Keep `.dev.vars` and real Worker secrets out of git.

### GitHub issue queue

```bash
VITE_PLAYTEST_FEEDBACK_URL="https://github.com/OWNER/men-eat-pb/issues/new?template=playtest-feedback.md"
npm run build
```

The game appends:

- `title`
- `body`
- `labels=playtest,pending-review`

### GitLab issue queue

```bash
VITE_PLAYTEST_FEEDBACK_URL="https://gitlab.com/GROUP/men-eat-pb/-/issues/new"
npm run build
```

The game appends:

- `issue[title]`
- `issue[description]`
- `issue[labels]=playtest,pending-review`

### Form fallback

Any URL can be used. For a generic form, expect `title`, `body`, and `labels` query parameters. If no URL is configured, the game opens a `mailto:` draft so local builds still have an escape hatch.

## Volunteer admin UI

The review UI is separate from the itch game bundle.

```bash
npm run dev:admin
npm run build:admin
```

It expects:

```text
GET /feedback?status=pending
GET /feedback?status=approved
GET /feedback?status=denied
GET /feedback?status=needs_info
PATCH /feedback/:id
Authorization: Bearer <moderator-token>
```

Queue response:

```json
{
  "items": [
    {
      "id": "fb_123",
      "createdAt": "2026-06-15T14:12:00.000Z",
      "status": "pending",
      "category": "balance",
      "message": "No Napkins feels too sticky.",
      "contact": "optional",
      "allowPublicReview": true,
      "runSummary": {}
    }
  ]
}
```

Review decision:

```text
PATCH /feedback/fb_123
```

```json
{
  "status": "approved",
  "reviewer": "Mira",
  "reviewNote": "Clear balance report."
}
```

## Volunteer review workflow

Use labels as the moderation state machine:

| State | Labels | Meaning |
| --- | --- | --- |
| Pending | `playtest`, `pending-review` | New community feedback waiting for a volunteer. |
| Approved | `playtest`, `approved` | Clear, actionable, and appropriate for the backlog. |
| Denied | `playtest`, `denied` | Duplicate, unclear after follow-up, abusive, spam, or out of scope. |
| Needs info | `playtest`, `needs-info` | A volunteer asked the player for clarification. |

Recommended volunteer steps:

1. Read the player note and run summary.
2. Remove spam or abusive content according to the community policy.
3. Search for duplicates.
4. If actionable, replace `pending-review` with `approved` and link/create the backlog issue.
5. If not actionable, replace `pending-review` with `denied`, leave a short reason, and close the issue.
6. If unclear, replace `pending-review` with `needs-info` and ask one specific follow-up question.

Keep the process public by default. Ask players not to include private contact details in feedback.

## Approval criteria

Approve feedback when it is:

- Specific enough to reproduce or discuss.
- Relevant to the current playable build.
- Useful for balance, clarity, accessibility, bugs, or game feel.
- Safe for volunteers to keep in the public tracker.

Deny or close feedback when it is:

- Spam, abuse, or unrelated promotion.
- A duplicate with no new information.
- A feature request that contradicts the design goals.
- Too vague after one clarification attempt.

## Backend/admin option

Minimum data model:

```text
feedback_submissions
- id
- created_at
- status: pending | approved | denied | needs_info
- category: bug | balance | feel | accessibility | other
- body
- run_summary_json
- reviewer
- review_note
```

Minimum endpoints:

```text
POST /feedback
GET /feedback?status=pending
PATCH /feedback/:id
```

Only `POST /feedback` should be public. Volunteer review actions need authentication.

## Owner decisions queued for later review

These choices are intentionally configurable and do not block playtesting:

- Final public intake target: included Worker API, GitHub issues, GitLab issues, or hosted form.
- Volunteer auth model: the scaffold uses a shared moderator token; magic links, GitHub OAuth, or GitLab OAuth can replace it later.
- Public policy copy for contact info and public review consent.
- Final label names if the community already has a preferred taxonomy.
- Whether approved feedback becomes issues automatically or waits for maintainer batching.
- Production Cloudflare account/project ownership, D1 database ID, allowed origins, and admin hosting URL.
