# Decision SD-SCOPE-GAPS-AUDIT: Use Apex testFor only when declared

- Status: accepted
- Owner: architect

## Context

Salesforce Apex Developer Guide describes @IsTest(testFor='ApexClass:Name,ApexTrigger:Name') at class level from API 66 as beta and linked to RunRelevantTests; current TestExecutor invents NameTest/NameTests when no known tests are found. The source scanner already reads Apex class contents and marks isTest but does not extract testFor.

## Decision

Treat declared testFor targets as explicit relationships for test selection when present in scanned test-class source; select only verified existing test classes for RunSpecifiedTests. Do not infer tests that do not exist, do not silently opt customers into beta RunRelevantTests, and fall back to RunLocalTests when no verified related tests exist. Validate annotation syntax, API and namespace cases before implementation.

## Consequences

New parser/scanner and selector tests should cover multiple targets, same name with distinct class/trigger type, comments and methods, missing targets, no annotation and beta opt-in constraints. No automatic org mutation or dependency lock changes.
