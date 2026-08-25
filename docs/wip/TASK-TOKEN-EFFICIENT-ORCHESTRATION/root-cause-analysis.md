# Observed Symptom

PL-01 used 14,519,949 ACLH tokens versus 1,523,992 baseline tokens. The ACLH
Builder alone used 6,722,087 tokens and one invalid reviewer run used 3,255,910.

# Reproduction

The stored rollout shows 97 ACLH Builder tool calls versus 37 baseline calls,
192,605 versus 40,615 tool-output characters, and six ACLH sessions versus one
valid baseline session. A reviewer was dispatched immediately after repair before
Builder-owned freshness had been restored.

# Root Cause

Three causes compounded:

1. orchestration had no machine preflight before reviewer dispatch;
2. the Adapter required the model to infer current state from long lifecycle and
   Runtime material instead of consuming one bounded status result;
3. self-review and independent-review packets duplicated complete task documents.

The headline report also mixed valid workflow and protocol-violation work into one
number, obscuring where optimization was required.

# Affected Scope

- Codex Adapter Skill and lifecycle reference;
- Runtime task/review status and independent-review snapshot helpers;
- self-review and independent-review packet generation;
- external capability publication;
- Pocket Ledger experiment collection, reporting and reviewer dispatch preflight.

# Evidence

- Stored PL-01 rollout/result records under the experiment `results/` directory.
- RED external lifecycle, packet and reporting tests.
- GREEN targeted Runtime and controller test results recorded in `test-plan.md`.
