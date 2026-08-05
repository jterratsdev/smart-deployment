# Audio/Video Transcription Evidence

Transcribe workflow-local audio and video artifacts into reviewable evidence
without leaking media, secrets, or regulated data.

## When To Load

- Trigger: `transcription`
- Trigger: `transcribe`
- Trigger: `transcript`
- Trigger: `audio`
- Trigger: `video`
- Trigger: `recording`
- Trigger: `demo recording`
- Trigger: `sprint review`
- Trigger: `interview`
- Trigger: `discovery call`
- Trigger: `support call`
- Trigger: `meeting recording`
- Trigger: `voice note`
- Trigger: `subtitle`
- Trigger: `vtt`
- Trigger: `srt`

## Operating Rules

1. Treat media as sensitive by default. Do not send audio, video, or raw
   transcript text to an external provider unless an explicit policy opt-in
   allows that provider and the task evidence requires it.
2. Prefer local/offline engines for first pass transcription. If no approved
   local engine is available, record a degraded evidence note instead of
   silently uploading media elsewhere.
3. Validate the source artifact before processing:
   - path must be workflow-local or an approved evidence artifact reference;
   - file must be readable and inside configured size/duration limits;
   - format/codec support must be known or explicitly marked degraded.
4. Record provenance for every transcript:
   - source artifact or workflow-local path;
   - source hash;
   - duration and detected language when available;
   - engine/provider/model;
   - actor, task id, timestamp, and command/API route;
   - consent, retention, and tenant/regulatory notes when supplied.
5. Redact before persistence. Remove or mask secrets, API keys, tokens,
   credentials, configured PII, health/financial/legal identifiers, and other
   regulated markers from transcript artifacts and summaries.
6. Keep outputs compact and structured:
   - Markdown report for humans;
   - JSON for tools and evidence linking;
   - VTT/SRT only when timestamp confidence is adequate;
   - raw transcripts should be stored as files, not pasted into handoffs.
7. Extract workflow findings from transcript content:
   - decisions;
   - risks;
   - action items;
   - acceptance-criteria candidates;
   - defects or support issues;
   - lesson-learned candidates;
   - unresolved questions.
8. QA evidence must map transcript findings to acceptance criteria and timestamp
   ranges. A transcript alone is not proof unless the relevant behavior or
   decision is referenced with observable evidence.

## Failure Modes

Fail closed or produce degraded evidence for:

- missing `ffmpeg` or local transcription engine;
- unsupported codec or corrupted media;
- oversized file or excessive duration;
- provider policy blocks external transcription;
- unreadable or non-workflow-local artifact path;
- redaction engine failure;
- partial transcript or low timestamp confidence;
- missing consent/retention requirements in regulated contexts.

## Transcript Evidence Template

```md
# Transcript Evidence

Task:
Source artifact:
Source hash:
Duration:
Language:
Engine/provider/model:
Actor:
Generated at:
Consent/retention:
Redaction policy:

## Acceptance Criteria Mapping

| AC | Timestamp | Evidence | Result | Notes |
| -- | --------- | -------- | ------ | ----- |

## Decisions

| Timestamp | Decision | Owner | Follow-up |
| --------- | -------- | ----- | --------- |

## Risks / Defects

| Timestamp | Finding | Severity | Evidence | Owner |
| --------- | ------- | -------- | -------- | ----- |

## Action Items

| Timestamp | Action | Owner | Due |
| --------- | ------ | ----- | --- |

## Lesson Candidates

| Timestamp | Lesson candidate | Prevention |
| --------- | ---------------- | ---------- |

## Gaps

| Gap | Owner | Rationale |
| --- | ----- | --------- |
```

## Evidence

- `file`
- `video`
- `log`
- `report`
