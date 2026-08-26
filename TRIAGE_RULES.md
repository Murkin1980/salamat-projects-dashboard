# TRIAGE RULES

## ACTION_NOW
Human decision/action is required now or a high-priority project has a concrete next action that should start immediately.

## BLOCKED
Progress cannot continue because of a specific blocker/dependency/approval/environment failure.

## READY
Preconditions are satisfied and the next checkpoint can start.

## IN_PROGRESS
A checkpoint/run/experiment is actively executing.

## VALIDATION
Implementation exists and is under test, review, replay, pilot or evidence validation.

## HOLD
Work is intentionally paused. Must include reason and review condition/date when available.

## DONE
The currently defined target outcome/checkpoint is complete. DONE does not imply a repository will never change again.

## Precedence
BLOCKED overrides READY/IN_PROGRESS when a blocking condition prevents meaningful progress.
ACTION_NOW is reserved for portfolio attention, not merely activity.
VALIDATION is distinct from DONE.

## Staleness signals
Attention may flag:
- no meaningful movement for 7 days;
- new blocker;
- approval pending;
- checkpoint past expected review;
- source state conflict.
