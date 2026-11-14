# Space Farm (Team CODE44) repository instructions
Read these files explicitly at the start of every session:
README.md, TEAM_RULES.md, PROJECT_BRIEF.md, PROJECT_STATE.md, ROADMAP.md,
PROJECT_PLAN.md, docs/API_CONTRACT.md, docs/TEAM_PLAYBOOK.md, and your own docs/status file.

## Role and ownership
Identify your assigned role A/frontend, B/backend, or C/data from the user's prompt.
Confirm current Git branch and working-tree state before editing.
If role is unknown, ask only for the role and continue read-only inspection.
Use the exact path ownership matrix in PROJECT_PLAN.md. More-specific paths override parents.
A owns apps/web, docs/design and docs/DESIGN_BRIEF.md; B owns services/api root files (main.py, config, pyproject.toml), routes, schemas, engine, contracts, root configs (LICENSE, .gitignore, .env.example) and shared coordination docs;
C owns services/api/app/data_adapters, services/api/tests/data, data, tools/data and docs/DATA_RULES.md.
Only B edits shared root plans/contracts/config, except A and C own their specified documents.
Only the initial B bootstrap may create minimal scaffolds for all roles.

## Work and memory
Implement one small ROADMAP task at a time; test the actual behavior.
Update your own docs/status file after every meaningful task and before ending.
Never write another role's journal. Only B consolidates PROJECT_STATE and ROADMAP after integration.
Keep prior decisions and evidence; do not replace the entire project plan with a new imagined plan.
Mark unrun tests NOT_RUN and unfinished work honestly.
Ask the owner for cross-boundary changes using CR-A/B/C-### in your own journal.

## Contracts and truth
No silent schema, enum, endpoint or unit changes.
Never fabricate NASA observations, verified agronomic rules, financial returns or success metrics.
Label synthetic fixtures demo_fixture; never silently use them as real API fallback.
Only real matching snapshots may be labeled cached.
Unknown values stay unknown. Scenarios are hypothetical, not forecasts.
Preserve source, dates, units, coverage, versions and explanations.

## Git
Do not commit directly to main/develop or force push.
Commit only task-owned changes; do not automatically stage the whole repository.
Keep secrets, .env, private farm data and large raw files out of Git.
Open small PRs to develop. Only the designated B coordinator integrates them sequentially.
Use merge commits for this long-lived branch workflow; do not squash/rebase shared role histories.
Before syncing, save your work in a commit and confirm a clean tree.
Report conflicts rather than choosing all ours/theirs or deleting another person's changes.

