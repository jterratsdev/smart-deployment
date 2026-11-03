import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';

describe('MetadataScannerService SharingRules integration', () => {
  let root: string | undefined;

  afterEach(async () => root && rm(root, { recursive: true, force: true }));

  it('discovers canonical decomposed object SharingRules and links them to the object', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canonical-sharing-rules-'));
    const objectDir = path.join(root, 'force-app/main/default/objects/Case');
    await mkdir(objectDir, { recursive: true });
    await writeFile(
      path.join(root, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '67.0' })
    );
    await writeFile(
      path.join(objectDir, 'Case.object-meta.xml'),
      '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><sharingModel>Private</sharingModel></CustomObject>'
    );
    await writeFile(
      path.join(objectDir, 'Case.sharingRules-meta.xml'),
      '<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingOwnerRules><fullName>Support</fullName><sharedTo><role>Support</role></sharedTo></sharingOwnerRules></SharingRules>'
    );

    const result = await new MetadataScannerService().scan({ sourcePath: root });
    const sharingRules = result.components.find((component) => component.type === 'SharingRules');
    expect(sharingRules?.name).to.equal('Case');
    expect([...(sharingRules?.dependencies ?? [])]).to.include('CustomObject:Case');
    expect(result.dependencyResult.components.has('SharingRules:Case')).to.equal(true);
  });
});
