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

The optimized replay exposed two additional lifecycle causes:

4. `init-task.ts` created only a shallow specification and task template; there was
   no first-class `plan.md` or planning verifier, so prompt restatement could pass as
   task refinement;
5. independent Review used binary `PASS|REJECT`, and status treated any non-PASS as
   unresolved work, coupling Review findings to automatic Repair instead of a user
   decision.

The headline report also mixed valid workflow and protocol-violation work into one
number, obscuring where optimization was required.

The expiry-tracker dual run made the remaining structure measurable: baseline used
17 shell commands and about 980,822 total tokens; ACLH used 56 shell commands and
about 5,938,191 total tokens. Pre-code governance consumed about 2,227,684 tokens
and post-core-gate finalization about 2,695,270, while implementation plus core
gates was about 1,015,237. Roughly 95.5% of the excess was cached input replay.

The remaining root causes were therefore Adapter-visible round trips, not product
coding: incomplete bootstrap schemas caused format discovery, a fixed browser step
ran regardless of task need, and post-build gates were exposed as many separate
model turns. Repair also retained the old active Review record, preventing the
next review cycle.

# Affected Scope

- Codex Adapter Skill and lifecycle reference;
- Runtime task/review status and independent-review snapshot helpers;
- self-review and independent-review packet generation;
- external capability publication;
- Pocket Ledger experiment collection, reporting and reviewer dispatch preflight.
- self-describing task contract, Builder finalizer, browser proof selection, and
  Repair round rotation.

# Evidence

- Stored PL-01 rollout/result records under the experiment `results/` directory.
- RED external lifecycle, packet and reporting tests.
- GREEN targeted Runtime and controller test results recorded in `test-plan.md`.
