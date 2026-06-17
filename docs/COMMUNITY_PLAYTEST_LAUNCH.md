# Community playtest launch runbook

Use this runbook when the feedback build is deployed and you are ready to recruit players and volunteer reviewers.

## Launch goal

Create a small, repeatable community loop:

1. Players do one short run.
2. Players submit feedback from the end screen.
3. Volunteers review each item as `approved`, `denied`, or `needs_info`.
4. Approved items become backlog candidates.
5. The community sees a short update showing what changed because of their notes.

## Readiness checklist

Do these before public recruiting:

- [ ] Deploy the game build with `VITE_PLAYTEST_FEEDBACK_API_URL` and/or `VITE_PLAYTEST_FEEDBACK_URL`.
- [ ] Deploy or choose the feedback queue backend.
- [ ] Deploy the volunteer admin UI or confirm the issue-queue fallback.
- [ ] Submit one test feedback item from the public game page.
- [ ] Confirm a reviewer can mark one item `approved`.
- [ ] Confirm a reviewer can mark one item `denied`.
- [ ] Confirm a reviewer can mark one item `needs_info`.
- [ ] Write down the public play link.
- [ ] Write down the reviewer/admin link.
- [ ] Choose the first reviewer seed group.

If the direct API is not deployed yet, launch with the GitHub/GitLab issue fallback and keep the same community messaging.

## Recruitment sequence

### Step 1: Seed reviewers first

Target: 3-5 trusted people.

Ask for reviewers before asking for lots of players. The first reviewer group should be comfortable making small judgment calls without blocking on the owner.

Reviewer invitation CTA:

> Want to help shape a weird arcade game? I need a few volunteer reviewers for Men Eat Peanut Butter. Reviewers look at player notes and mark them approved, denied, duplicate, or needs-info. No coding required.

### Step 2: Controlled public playtest

Target: 25-50 players.

Ask each player for one run and one note. Keep the playtest ask small enough that people can say yes immediately.

Player CTA:

> Play one 5-minute run, then hit **Send feedback** on the end screen.

### Step 3: Publish a feedback recap

Post a small recap after the first batch:

- number of runs or submissions
- number approved
- number denied/duplicates
- top three themes
- what will change next

This proves the loop is real and encourages the second wave.

## Channel priority

Start with channels where weird small games and direct creator updates perform well:

1. Personal Discords and friend/community servers.
2. itch.io devlog.
3. Bluesky/Mastodon/Twitter/X short posts with a GIF or screenshot.
4. Reddit only where self-promo/playtest posts are allowed.
5. Game-dev communities where feedback requests are normal.
6. Newsletter or mailing list, if available.

Avoid blasting every channel on the same day. Seed reviewers first, then post the playtest link in 2-3 places, then expand once the queue works.

## Daily operating loop during playtest

Use this loop while the playtest is active:

1. Check pending feedback.
2. Remove spam/abuse.
3. Merge duplicates.
4. Mark actionable items `approved`.
5. Mark unclear items `needs_info` with one specific question.
6. Mark out-of-scope items `denied` with a short reason.
7. Add approved themes to a short recap note.

## Metrics to report publicly

Keep metrics human and lightweight:

- Feedback submissions reviewed.
- Approved backlog candidates.
- Most-mentioned issue.
- Most-liked moment.
- One planned change.

Example:

> First playtest batch reviewed: 31 notes, 18 approved, 7 duplicates, 4 needs-info, 2 denied. Biggest themes: Frenzy clarity, No Napkins stickiness, and wanting a faster restart. Thank you for making the peanut butter better.

## Owner review queue

These items can wait for owner review:

- Final deployed play URL.
- Final reviewer/admin URL.
- Which communities are allowed for posting.
- Whether reviewers can create backlog issues directly.
- Whether social posts should mention the $5 early access price or focus only on playtesting.
- Whether to use screenshots, GIFs, or a short gameplay clip in the first public blast.
