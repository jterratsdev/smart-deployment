# Decision SD-CGCLOUD-RETAIL-SETTINGS: CGCloud product-role fusion

- Status: accepted
- Owner: architect

## Context

setup-agents cgcloudRoleSections maps developer, architect, sa, qa and release-manager; resolveProductRoleFusion suppresses the standalone product when a compatible selected role receives a fragment.

## Decision

Run metadata validation as architect with the selected cgcloud role fragment, implementation as developer with the cgcloud fragment, and verification as qa with the cgcloud fragment; do not create a cgcloud role or subagent when compatible roles are selected.

## Consequences

Task ownership remains role-based and product expertise is contextual content. Standalone cgcloud is only a fallback when no compatible role is selected.
