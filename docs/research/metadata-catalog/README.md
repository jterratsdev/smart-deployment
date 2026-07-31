# Salesforce Metadata Catalog Research

This catalog compares Salesforce product metadata and adjacent deployment
artifacts with the capabilities currently implemented by smart-deployment.
The research baseline is Salesforce API `67.0`.

## Catalog contract

Each candidate uses the stable key:

```text
<apiVersion>|<deploymentChannel>|<vendorType>
```

`apiVersion` is `67.0` for Salesforce API artifacts and `n/a` for provider or
external artifacts. Deployment channels are limited to:

- `metadata-api`
- `source-format-composite`
- `managed-package-data`
- `provider-lifecycle`
- `external-provider`
- `unknown`

The capability dimensions distinguish discovery, parsing, dependency
extraction, ordering, lifecycle support, and fixture or CLI evidence. Presence
in an ordering list alone does not mean that a type is supported.

## Product clusters

| Cluster                                | Product profiles                                           | Candidates | Report                                 |
| -------------------------------------- | ---------------------------------------------------------- | ---------: | -------------------------------------- |
| C1 Core CRM and channels               | Sales, Service, FSL, Experience, Slack                     |         60 | [C1](c1-core-crm-channels.md)          |
| C2 Data, analytics, and AI             | CRMA, Data 360, Tableau, AI                                |         35 | [C2](c2-data-analytics-ai.md)          |
| C3 Commerce, marketing, and revenue    | Commerce, CPQ, Revenue, SFMC, Loyalty                      |         28 | [C3](c3-commerce-marketing-revenue.md) |
| C4 Integration and Industries platform | MuleSoft, OmniStudio, Industries                           |         21 | [C4](c4-integration-industries.md)     |
| C5 Regulated and social sectors        | FSC, Health, Education, Nonprofit, Public Sector           |         28 | [C5](c5-regulated-social-sectors.md)   |
| C6 Industrial, asset, and location     | CGCloud, Manufacturing, Automotive, Energy, Maps, Net Zero |         33 | [C6](c6-industrial-asset-location.md)  |
| C7 Communications and media            | Communications, Media                                      |         14 | [C7](c7-communications-media.md)       |

The catalog contains 219 unique candidates across all 30 product profiles.
Shared platform metadata has one canonical owner. In particular, C1 owns
`OrderManagementSettings`; C3 and C4 only provide product-specific
cross-references.

## Recommended delivery order

1. Introduce one typed, API-versioned capability registry and alias table.
2. Add a deployment-channel classifier before expanding scanner coverage.
3. Correct existing partial-support claims and preserve parsed dependencies at
   scanner boundaries.
4. Implement focused scanner families for nearby Metadata API and
   source-format candidates.
5. Add dedicated adapters for managed-package data and provider lifecycles.
6. Require licensed-org or provider evidence before promoting candidates whose
   lifecycle cannot be proven locally.

Product object records, managed package data, and external provider assets are
included as negative boundaries. They must not enter Metadata API deployment
plans merely because their product profile is recognized.

## Validation

The consolidated QA result is documented in [qa-review.md](qa-review.md).
