# Chaos Resilience Testing

Design deterministic failure scenarios that prove workflows, APIs, providers,
gates, budgets, and regulated flows degrade safely.

## When To Load

- Trigger: `chaos`
- Trigger: `resilience`
- Trigger: `fault injection`
- Trigger: `failure mode`
- Trigger: `provider timeout`
- Trigger: `provider unavailable`
- Trigger: `offline mode`
- Trigger: `circuit breaker`
- Trigger: `rate limit`
- Trigger: `budget exhaustion`
- Trigger: `approval race`
- Trigger: `policy failure`
- Trigger: `audit failure`
- Trigger: `stale data`
- Trigger: `corrupted state`
- Trigger: `tenant isolation`
- Trigger: `regulated flow`

## Procedure

1. Identify the task, acceptance criteria, impacted runtime surfaces, and the
   user-visible or release-critical outcome that must survive failure.
2. Classify each failure as one of:
   - fail closed: security, approvals, regulated authority, secrets, PII/PHI,
     payment, policy, tenant isolation, or destructive actions;
   - degrade with recovery: optional enrichment, UI panels, advisory features,
     non-critical telemetry, or external references;
   - retry with bounds: transient provider/API, storage, webhook, or scheduler
     failures with explicit timeout, backoff, and retry limits.
3. Select deterministic scenarios before implementation. Prefer controlled
   stubs, fake providers, injected stores, fixture corruption, and bounded
   timeout simulation over random production-style fault injection.
4. For each scenario, define:
   - fault injected;
   - expected behavior;
   - expected user/operator message;
   - expected audit/event/evidence output;
   - recovery path;
   - acceptance criteria covered.
5. Validate at least the relevant categories:
   - provider/model timeout or unavailable provider;
   - external API/network unavailable;
   - corrupted or partially written local state;
   - stale reads or cache mismatch;
   - concurrent update/approval race;
   - budget/rate-limit exhaustion;
   - policy engine denial or failure;
   - audit/event write failure;
   - offline mode with optional sources unavailable;
   - tenant/regulatory boundary enforcement.
6. Capture observable evidence. A passing command alone is not enough; prove the
   final state, emitted event, user message, skipped activation, blocked gate, or
   recovery artifact.
7. Record unresolved resilience gaps with owner, severity, release impact, and
   whether Product/Security/Compliance accepted the risk.

## Stack Guidance

- Start with local deterministic faults: Node tests, fake providers, fake
  storage/repositories, controlled timers, `AbortController`, injected clocks,
  and fixture corruption.
- Use Playwright route stubs for web/API degraded states such as timeout, stale
  data, malformed payload, empty response, or server error.
- Use Docker Compose, Toxiproxy, WireMock/MSW/Pact, k6, and OpenTelemetry only
  when integration or SaaS boundaries require network/service-level evidence.
- Use Chaos Mesh or LitmusChaos only for future Kubernetes-managed services;
  these are not npm package MVP dependencies.
- Keep stack details in backlog or architecture docs and load only the relevant
  scenario guidance into task context.

## Evidence Report Template

```md
# Chaos / Resilience Evidence

Task:
Issue/User Story:
Environment:
Date:

## Scenario Matrix

| Scenario | Fault | Expected behavior | Actual behavior | Evidence | Result |
| -------- | ----- | ----------------- | --------------- | -------- | ------ |

## Acceptance Criteria Coverage

| AC | Scenario | Result | Notes |
| -- | -------- | ------ | ----- |

## Recovery And Audit

| Scenario | Recovery path | Audit/event evidence | User/operator message |
| -------- | ------------- | -------------------- | --------------------- |

## Gaps

| Gap | Severity | Owner | Release decision |
| --- | -------- | ----- | ---------------- |
```

## Acceptance Rules

- Security, compliance, tenant isolation, approval, regulated authority, secrets,
  and payment-related failures must fail closed unless an explicit accepted risk
  says otherwise.
- Optional enrichment and advisory features may degrade, but must expose clear
  rationale and recovery guidance.
- Retries must be bounded by timeout, retry count, backoff, and budget policy.
- Chaos evidence must map back to acceptance criteria and release gates.
- A generated or automated reviewer cannot self-approve resilience gaps in
  regulated or high-risk flows.

## Evidence

- `command`
- `file`
- `log`
- `report`
- `trace`
