import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { scanAdditionalMetadata } from '../../../src/services/scanners/additional-metadata-scanner.js';

describe('additional metadata scanner', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it('discovers Data Kit source formats and preserves the parent dependency', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'additional-metadata-data-kit-'));
    tempDirectories.push(projectRoot);
    const packagePath = path.join(projectRoot, 'force-app', 'main', 'default');
    const definitionDir = path.join(packagePath, 'dataPackageKitDefinitions');
    const objectDir = path.join(packagePath, 'DataPackageKitObjects');
    const sourceObjectDir = path.join(packagePath, 'dataSourceObjects');
    await Promise.all([
      mkdir(definitionDir, { recursive: true }),
      mkdir(objectDir, { recursive: true }),
      mkdir(sourceObjectDir, { recursive: true }),
    ]);

    await Promise.all([
      writeFile(
        path.join(definitionDir, 'Store_Kit.dataPackageKitDefinition-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<DataPackageKitDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
  <dataKitSource>LOCAL</dataKitSource>
  <dataKitType>SANDBOX</dataKitType>
  <dataSpaceDefinitionDevName>default</dataSpaceDefinitionDevName>
  <deploymentOrder>{&quot;isAutoSequence&quot;:true,&quot;sequence&quot;:[]}</deploymentOrder>
  <developerName>Store_Kit</developerName>
  <isDeployed>false</isDeployed>
  <isEnabled>false</isEnabled>
  <masterLabel>Store Kit</masterLabel>
  <versionNumber>2.0</versionNumber>
</DataPackageKitDefinition>`
      ),
      writeFile(
        path.join(objectDir, 'Store_Kit_123.DataPackageKitObject-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<DataPackageKitObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <masterLabel>Store Kit</masterLabel>
  <parentDataPackageKitDefinitionName>Store_Kit</parentDataPackageKitDefinitionName>
  <referenceObjectName>Store__dlm</referenceObjectName>
  <referenceObjectType>MktDataModelObject</referenceObjectType>
</DataPackageKitObject>`
      ),
      writeFile(
        path.join(sourceObjectDir, 'Knowledge_Home.dataSourceObject-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<DataSourceObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <dataSource>Salesforce_Home</dataSource>
  <externalRecordIdentifier>Knowledge__kav</externalRecordIdentifier>
  <masterLabel>Knowledge__kav</masterLabel>
  <storageType>LOCAL</storageType>
  <templateVersion>1</templateVersion>
</DataSourceObject>`
      ),
    ]);

    const errors: string[] = [];
    const components = await scanAdditionalMetadata(packagePath, errors, () => false);
    const componentIds = components.map((component) => `${component.type}:${component.name}`);
    const kitObject = components.find((component) => component.type === 'DataPackageKitObject');

    expect(componentIds).to.include.members([
      'DataSourceObject:Knowledge_Home',
      'DataPackageKitDefinition:Store_Kit',
      'DataPackageKitObject:Store_Kit_123',
    ]);
    expect([...kitObject!.dependencies]).to.deep.equal(['DataPackageKitDefinition:Store_Kit']);
    expect(kitObject!.dependencyDetails).to.deep.equal([
      {
        nodeId: 'DataPackageKitDefinition:Store_Kit',
        kind: 'hard',
        source: 'parser',
        reason: 'DataPackageKitObject parentDataPackageKitDefinitionName identifies its parent Data Kit.',
      },
    ]);
    expect(errors).to.deep.equal([]);
  });

  it('respects ignored Data Kit files', async () => {
    const packagePath = await mkdtemp(path.join(os.tmpdir(), 'additional-metadata-data-kit-ignore-'));
    tempDirectories.push(packagePath);
    const objectDir = path.join(packagePath, 'DataPackageKitObjects');
    await mkdir(objectDir, { recursive: true });
    const filePath = path.join(objectDir, 'Ignored.DataPackageKitObject-meta.xml');
    await writeFile(
      filePath,
      '<DataPackageKitObject><parentDataPackageKitDefinitionName>Ignored</parentDataPackageKitDefinitionName></DataPackageKitObject>'
    );

    const components = await scanAdditionalMetadata(packagePath, [], (candidate) => candidate === filePath);

    expect(components).to.deep.equal([]);
  });
});
