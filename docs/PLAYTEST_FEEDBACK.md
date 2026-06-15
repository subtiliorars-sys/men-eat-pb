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

## Configure intake

Copy `.env.example` to `.env.local` for local testing or set these variables in the release environment.

| Variable | Purpose |
| --- | --- |
| `VITE_PLAYTEST_FEEDBACK_API_URL` | Public POST endpoint for in-game feedback submissions. |
| `VITE_PLAYTEST_FEEDBACK_URL` | Fallback issue/form URL for "Open issue instead". |
| `VITE_PLAYTEST_ADMIN_API_URL` | Volunteer review API root. Defaults to `VITE_PLAYTEST_FEEDBACK_API_URL` when unset. |

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

- Final public intake target: GitHub issues, GitLab issues, hosted form, or direct feedback API.
- Volunteer auth model: shared moderator token, magic links, GitHub OAuth, or GitLab OAuth.
- Public policy copy for contact info and public review consent.
- Final label names if the community already has a preferred taxonomy.
- Whether approved feedback becomes issues automatically or waits for maintainer batching.
