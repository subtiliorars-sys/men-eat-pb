# Community playtest feedback

Men Eat Peanut Butter is a static browser game, so the first community playtest loop should use the tools the community already understands: an issue queue with labels and volunteer review.

## Player flow

1. A player finishes a run.
2. The end screen shows **Send feedback**.
3. The game opens the configured playtest intake URL with a prefilled title/body.
4. The player adds what felt fun, confusing, broken, unfair, or worth keeping.

The generated report includes build version, modifier, ending, spoons, Crust Credits, jar remaining, Frenzy state, and chain count.

## Configure the intake URL

Set `VITE_PLAYTEST_FEEDBACK_URL` before building the itch.io zip.

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

## Future backend/admin option

If the public issue queue gets too noisy, keep the game-side contract and point `VITE_PLAYTEST_FEEDBACK_URL` at a tiny hosted form/API.

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
