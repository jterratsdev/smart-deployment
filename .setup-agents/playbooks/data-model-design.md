<!-- setup-agents: 2.0.2 -->

# Data Model Design

## Goal

Design or review the data model changes required by this story.

## Steps

1. Read `sfdx-project.json` for `sourceApiVersion`.
2. Identify objects and fields to create or modify.
3. Document: object API name, field API names, types, relationships.
4. Check for existing custom objects before proposing new ones.
5. Include a Mermaid ERD for changes affecting 2+ objects.
6. Record evidence: `sf setup-agents evidence add --task <id> --type file --summary "Data model design documented"`
