# Data Cloud Retrieve Validation

## Scope

This validation covers read-only Metadata API discovery, source-format retrieval, and local plugin analysis. It does not deploy, activate, authorize, publish, or modify Data Cloud metadata or data.

Customer sandboxes are explicitly excluded. The observed validation used a non-client training org with an active Data Cloud permission set license.

## Observed Results

- `DataSourceObject` is discoverable through `sf org list metadata`.
- A targeted `sf project retrieve start` succeeds with API version 67.0.
- Salesforce CLI writes source format as:

  ```text
  dataSourceObjects/<member>.dataSourceObject-meta.xml
  ```

- The retrieved root element is `DataSourceObject` and includes the documented source, external record identifier, label, storage type, and template version fields.
- Smart Deployment scans the retrieved project as one `DataSourceObject` component and places it in one dependency wave without scanner errors.
- The available non-client training orgs did not contain `DataPackageKitDefinition` or `DataPackageKitObject` instances. Their exact source formats remain supported by official Metadata API documentation and anonymized repository fixtures, but live retrieval of those two types is still pending an org that contains a Data Kit.

No org IDs, usernames, instance URLs, access tokens, or retrieved member names are retained in this report.

## Opt-In Harness

Run the read-only E2E harness only with an explicitly approved non-client org:

```bash
SMART_DEPLOYMENT_DATACLOUD_ORG=<approved-alias> \
  SMART_DEPLOYMENT_DATACLOUD_NON_CLIENT_APPROVED=true \
  npx mocha "test/e2e/live-datacloud-retrieve.e2e.test.ts"
```

The harness:

1. Lists the three supported metadata types.
2. Retrieves at most one available member of each type into an OS temporary directory.
3. Runs `MetadataScannerService` locally.
4. Verifies discovered types and the Data Kit object-to-definition dependency when a kit object is present.
5. Deletes all retrieved source after the test.

Both environment variables are required. The second is an explicit assertion by the operator that the alias is a non-client org approved for this read-only test. The test remains skipped otherwise.

It never invokes Salesforce deployment, data mutation, activation, or package installation commands.

## Remaining Lifecycle Validation

A non-client org containing a real Data Kit is still required to validate:

- live source-format retrieval for `DataPackageKitDefinition` and `DataPackageKitObject`
- whether retrieving a definition includes related objects automatically
- DevOps Data Kit deployment history and partial-failure semantics
- required post-install stream deployment, connection authorization, and activation steps
- component status through `DataKitDeploymentLog`
