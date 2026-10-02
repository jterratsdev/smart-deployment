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

  it('discovers the canonical Retail Execution settings singleton and parses documented flags', async () => {
    const packagePath = await mkdtemp(path.join(os.tmpdir(), 'additional-metadata-retail-settings-'));
    tempDirectories.push(packagePath);
    const settingsDir = path.join(packagePath, 'settings');
    await mkdir(settingsDir, { recursive: true });
    await Promise.all([
      writeFile(
        path.join(settingsDir, 'RetailExecution.settings-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<RetailExecutionSettings xmlns="http://soap.sforce.com/2006/04/metadata">
  <enableRetailExecution>true</enableRetailExecution>
  <enableProductHierarchy>false</enableProductHierarchy>
  <enableVisitSharing>true</enableVisitSharing>
</RetailExecutionSettings>`
      ),
      writeFile(
        path.join(settingsDir, 'StockRotation.settings-meta.xml'),
        '<StockRotationSettings xmlns="http://soap.sforce.com/2006/04/metadata" />'
      ),
      writeFile(path.join(packagePath, 'cgcloud__Promotion__c.xml'), '<records />'),
      writeFile(path.join(packagePath, 'modeler.businessobject.xml'), '<businessObject />'),
      writeFile(path.join(packagePath, 'cgc_sync__Sync_Config__c.records.xml'), '<records />'),
    ]);

    const errors: string[] = [];
    const components = await scanAdditionalMetadata(packagePath, errors, () => false);
    const retailSettings = components.find((component) => component.type === 'RetailExecutionSettings');

    expect(components.map((component) => `${component.type}:${component.name}`)).to.include(
      'RetailExecutionSettings:RetailExecution'
    );
    expect(retailSettings?.facts).to.deep.equal({
      kind: 'retail-execution-settings',
      enableRetailExecution: true,
      enableProductHierarchy: false,
      enableVisitSharing: true,
    });
    expect(components.map((component) => component.type)).not.to.include('StockRotationSettings');
    expect(components.map((component) => component.filePath)).not.to.satisfy((paths: string[]) =>
      paths.some((filePath) => filePath.includes('modeler.') || filePath.includes('cgc_sync__'))
    );
    expect(errors).to.deep.equal([]);
  });

  it('rejects a Retail Execution filename with the wrong XML root', async () => {
    const packagePath = await mkdtemp(path.join(os.tmpdir(), 'additional-metadata-retail-settings-invalid-'));
    tempDirectories.push(packagePath);
    const settingsDir = path.join(packagePath, 'settings');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      path.join(settingsDir, 'RetailExecution.settings-meta.xml'),
      '<StockRotationSettings xmlns="http://soap.sforce.com/2006/04/metadata" />'
    );
    const errors: string[] = [];

    const components = await scanAdditionalMetadata(packagePath, errors, () => false);

    expect(components).to.deep.equal([]);
    expect(errors[0]).to.include('Expected RetailExecutionSettings XML root');
  });

  it('rejects malformed Retail Execution XML and invalid boolean values', async () => {
    const packagePath = await mkdtemp(path.join(os.tmpdir(), 'additional-metadata-retail-settings-malformed-'));
    tempDirectories.push(packagePath);
    const settingsDir = path.join(packagePath, 'settings');
    await mkdir(settingsDir, { recursive: true });
    const filePath = path.join(settingsDir, 'RetailExecution.settings-meta.xml');
    await writeFile(filePath, '<RetailExecutionSettings><enableRetailExecution>true</RetailExecutionSettings>');
    const malformedErrors: string[] = [];

    expect(await scanAdditionalMetadata(packagePath, malformedErrors, () => false)).to.deep.equal([]);
    expect(malformedErrors[0]).to.include('Invalid RetailExecutionSettings XML');

    await writeFile(
      filePath,
      '<RetailExecutionSettings><enableRetailExecution>garbage</enableRetailExecution></RetailExecutionSettings>'
    );
    const booleanErrors: string[] = [];
    expect(await scanAdditionalMetadata(packagePath, booleanErrors, () => false)).to.deep.equal([]);
    expect(booleanErrors[0]).to.include('Invalid boolean value for enableRetailExecution: garbage');

    await writeFile(
      filePath,
      '<RetailExecutionSettings><enableRetailExecution>1</enableRetailExecution></RetailExecutionSettings>'
    );
    const numericErrors: string[] = [];
    expect(await scanAdditionalMetadata(packagePath, numericErrors, () => false)).to.deep.equal([]);
    expect(numericErrors[0]).to.include('Invalid boolean value for enableRetailExecution: 1');
  });
});
