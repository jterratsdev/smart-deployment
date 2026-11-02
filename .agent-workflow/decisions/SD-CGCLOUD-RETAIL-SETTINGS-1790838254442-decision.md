# Decision SD-CGCLOUD-RETAIL-SETTINGS: Implementation story points

- Status: accepted
- Owner: developer

## Context

developer completed developer

## Decision

3 points

## Consequences

Consumed context files recorded. Changed files recorded. Changed-file traceability recorded. Simplicity review recorded. Goal-to-verification map recorded. Architectural concerns recorded. Handoff summary ready. AC1 verification pending: Discover only settings/RetailExecution.settings-meta.xml as RetailExecutionSettings:RetailExecution -> requires an observable artifact, executed command, and explicit assertion. AC2 verification pending: Represent RetailExecutionSettings in the capability registry with API 47 minimum and lifecycle partial pending licensed-org evidence -> requires an observable artifact, executed command, and explicit assertion. AC3 verification pending: Order RetailExecutionSettings before dependent CGCloud custom metadata/code while preserving graph dependencies -> requires an observable artifact, executed command, and explicit assertion. AC4 verification pending: Do not register StockRotationSettings, Modeler, Mobile Sync or CGCloud records as executable metadata without evidence -> requires an observable artifact, executed command, and explicit assertion. AC5 verification pending: Focused deterministic tests, build and lint pass -> requires an observable artifact, executed command, and explicit assertion. Scalability evidence: Changed paths: src/services/scanners, src/types/metadata.ts, src/analysis/metadata-capability-definitions.ts, src/constants/deployment-order.ts, test/unit/services, test/unit/analysis, test/unit/constants, docs/research/metadata-catalog AC1 verification: Architect workload, growth, complexity, indexing, caching/queue, concurrency, failure, and measurement dimensions reviewed. AC2 verification: changed code paths mapped to time/space complexity and latency, memory, throughput, and concurrency budgets. AC3 verification: missing scalability analysis blocks relevant transitions unless bounded risk acceptance is recorded. AC4 verification: focused tests reject superficial prose and unsupported claims while measured evidence passes. AC5 verification: rules and playbooks instruct evidence-driven data structures and algorithms; nested loops are not banned mechanically. AC7 verification: changed code paths, complexity and resource budgets, command or benchmark evidence, and observable result are recorded. Complexity budget: indexed lookup target O(1) average or documented O(n) bounded scan; memory and latency budgets are measured. Benchmark command: npm run build && node --test test/workflow-handoff-contract.test.js; observed result: command exit code 0.
