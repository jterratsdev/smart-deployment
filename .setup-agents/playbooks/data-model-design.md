<!-- setup-agents: 3.16.0 -->
# Data Model Design

## Goal
Design or review the data model changes required by this story.

## Steps
1. Read `sfdx-project.json` for `sourceApiVersion`.
2. Identify objects and fields to create or modify.
3. Document: object API name, field API names, types, relationships.
4. Check for existing custom objects before proposing new ones.
5. Include a Mermaid ERD for changes affecting 2+ objects.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role architect --type file --summary "Data Model Design completed"
```
