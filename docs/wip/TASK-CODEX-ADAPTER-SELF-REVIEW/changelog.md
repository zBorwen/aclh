# Changelog

- 2026-08-24: Initialized task TASK-CODEX-ADAPTER-SELF-REVIEW (risk L2, strategy tdd, branch agent/codex-adapter-self-review)
- 2026-08-24: Reproduced the missing self-review transition with a failing external-consumer test.
- 2026-08-24: Added prepare/verify self-review lifecycle with snapshot-bound review artifacts.
- 2026-08-24: Updated Adapter orchestration, Delivery/Resync checks, templates, and external lifecycle tests.
- 2026-08-24: Exercised the external Runtime against `agent/issue-management`; core check/typecheck/77 tests/build and Builder browser smoke passed, while the new Gap Registry correctly blocked delivery because the consumer has no `test:browser` or human coverage record.
- 2026-08-24: Made the canonical repository test script serial after the default parallel run reproduced 12 shared-repository snapshot races; the same 103 tests pass serially.
- 2026-08-24: Fixed embedded Context freshness to ignore the same task-local semantic review outputs as Evidence; Delivery Gate had exposed the omission after a real Builder review.
