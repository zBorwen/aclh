# Change Summary

Introduce a two-stage Builder self-review lifecycle: Runtime preparation before final verification, followed by a snapshot-bound semantic review artifact after machine Evidence.

# Affected Modules

- Governance Runtime: prepare/verify behavior, Evidence exclusions, Delivery and Resync.
- Codex Adapter: embedded and external orchestration order.
- Task templates: review artifact references.
- Runtime Verification: self-review and full external-delivery fixtures.
- Canonical test command: serialize repository-mutating governance tests so Evidence does not race shared snapshots.

# Cross-boundary Impact

External consumers keep `self-review.json` in their own task workspace while the Engine owns validation. Machine Evidence ignores only semantic review outputs; Independent Review still observes the completed Builder review. Existing inline review fields no longer satisfy Delivery by themselves.

# Verification Scope

- TypeScript compilation and Harness checks.
- Complete serial unit/integration suite.
- External L2 consumer delivery.
- issue-management branch as the hands-on consumer target.
