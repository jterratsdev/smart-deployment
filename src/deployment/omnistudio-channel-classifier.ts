import { readFile as fsReadFile, realpath as fsRealpath, stat as fsStat } from 'node:fs/promises';
import * as path from 'node:path';

export type OmniStudioChannel = 'native-metadata' | 'managed-datapack' | 'blocked';

export type OmniStudioChannelReason =
  | 'native-shape'
  | 'managed-shape'
  | 'unknown-shape'
  | 'identity-unproven'
  | 'channel-conflict';

export type OmniStudioChannelClassification = {
  path: string;
  channel: OmniStudioChannel;
  artifactKey?: string;
  reason: OmniStudioChannelReason;
  evidence: string[];
  remedy?: string;
};

export type ClassifyOmniStudioChannelsInput = {
  projectRoot: string;
  changedPaths: readonly string[];
  readFile?: (absPath: string) => Promise<string>;
  resolveRealPath?: (absPath: string) => Promise<string>;
  statSize?: (absPath: string) => Promise<number>;
};

type ReadFileFn = (absPath: string) => Promise<string>;
type RealPathFn = (absPath: string) => Promise<string>;
type StatSizeFn = (absPath: string) => Promise<number>;

type FileIo = {
  readFile: ReadFileFn;
  resolveRealPath: RealPathFn;
  statSize: StatSizeFn;
};

type ReadResult = { status: 'ok'; content: string } | { status: 'oversize' } | { status: 'unreadable' };

type NativeTypeDefinition = {
  type: string;
  directory: string;
  suffix: string;
};

/**
 * Metadata API registry facts for the four simple-file OmniStudio native types.
 *
 * @see docs/architecture/c4-omnistudio-channel-classification.md
 */
const NATIVE_TYPES: readonly NativeTypeDefinition[] = [
  { type: 'OmniDataTransform', directory: 'omniDataTransforms', suffix: '.rpt-meta.xml' },
  { type: 'OmniIntegrationProcedure', directory: 'omniIntegrationProcedures', suffix: '.oip-meta.xml' },
  { type: 'OmniScript', directory: 'omniScripts', suffix: '.os-meta.xml' },
  { type: 'OmniUiCard', directory: 'omniUiCard', suffix: '.ouc-meta.xml' },
];

const NATIVE_DIRECTORY_NAMES = new Set(NATIVE_TYPES.map((nativeType) => nativeType.directory));

/**
 * VBT `VlocityDataPackType` folder name -> native Metadata API type name, used only to build a
 * shared conflict key (F2 security fix). The native-type side of this map is confirmed from the
 * Metadata API registry (docs/architecture/c4-omnistudio-channel-classification.md). The VBT-side
 * name convention (e.g. whether VBT typically names IntegrationProcedure/OmniScript folders
 * `Type_SubType_Language`, matching the native file name) is NOT independently confirmed against
 * VBT documentation or a real exported DataPack (open TBD #2 in the architecture doc). Conflict
 * detection therefore compares the raw `<Name>` segment exactly (case-sensitive), which is the most
 * conservative choice available without that confirmation: an identical name on both sides is
 * always flagged as a conflict (fail closed), but a real VBT naming convention that differs from
 * the native file name for the same artifact would not be caught by this exact-match comparison.
 */
const VBT_TYPE_TO_NATIVE_TYPE: Readonly<Record<string, string>> = {
  DataRaptor: 'OmniDataTransform',
  IntegrationProcedure: 'OmniIntegrationProcedure',
  OmniScript: 'OmniScript',
  FlexCard: 'OmniUiCard',
};

// Legacy candidate-selection regex. Candidate selection may stay broad; it never decides the channel.
const LEGACY_OMNI_PATTERN =
  /(?:^|\/)(vlocity|omnistudio|omniScripts|dataRaptors|integrationProcedures|flexCards)(?:\/|$)/iu;

const UNRESOLVED_NAMESPACE_TOKEN = '%vlocity_namespace%';

/**
 * Strict managed Salesforce API name: `<namespace>__<name>__<suffix>`, where `suffix` is a real
 * Salesforce managed-component suffix. Requires two literal `__` separators, so an unmanaged
 * `Object__c`/`Field__c` value (one separator) never matches (F1 security fix).
 */
const MANAGED_API_NAME_PATTERN =
  /^([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*)__[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*__(?:c|mdt|e|x|b)$/u;

/** A valid Salesforce namespace: starts with a letter, letters/digits/underscore, no "__". */
const NAMESPACE_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*$/u;

/**
 * The only identity-bearing DataPack field this classifier trusts for managed-package identity.
 * Named explicitly (not a generic "scan every field" loop) so any future field addition is a
 * reviewable, named decision rather than an implicit widening of the identity surface.
 */
const IDENTITY_FIELD_VLOCITY_RECORD_SOBJECT_TYPE = 'VlocityRecordSObjectType';

// Minimal, read-only VBT job file source for a declared namespace (amendment to the architect design:
// a concrete `<ns>__` prefix is not required when the project declares its namespace in this file).
// Only a root-level (column 0) `namespace:`/`vlocity.namespace:` key is honored (F3 security fix).
const JOB_FILE_RELATIVE_PATH = 'vlocity.yaml';
const JOB_NAMESPACE_LINE_PATTERN = /^(?:vlocity\.)?namespace\s*:\s*['"]?([A-Za-z][A-Za-z0-9_]*)['"]?\s*$/mu;

/**
 * Size caps checked via `stat` before a file is read (N3 security hardening — the original F5 fix
 * checked size only after the full UTF-8 read, limiting parsing but not memory use). `vlocity.yaml`
 * is a short, hand-written job file, so it gets a much smaller cap than DataPack JSON exports.
 */
const MAX_DATAPACK_JSON_BYTES = 5 * 1024 * 1024;
const MAX_JOB_FILE_BYTES = 64 * 1024;

/**
 * One remedy per blocked reason, matching the reason-to-remedy table in
 * docs/known-limitations.md. Keep both in sync.
 */
const BLOCKED_REMEDIES: Record<'unknown-shape' | 'identity-unproven' | 'channel-conflict', string> = {
  'unknown-shape':
    'Keep only native registry files (omniDataTransforms/*.rpt-meta.xml, omniIntegrationProcedures/*.oip-meta.xml, omniScripts/*.os-meta.xml, omniUiCard/*.ouc-meta.xml) or VBT exports shaped as <Type>/<Name>/<Name>_DataPack.json; if the path is not OmniStudio, add it to .forceignore.',
  'identity-unproven': `For an unresolved "${UNRESOLVED_NAMESPACE_TOKEN}" token, declare "namespace: <ns>" in "${JOB_FILE_RELATIVE_PATH}" at the project root; otherwise re-export with VBT so the record carries a concrete "<ns>__" prefix (fix or re-export if the DataPack JSON is malformed).`,
  'channel-conflict':
    'Keep the artifact in exactly one format (native Metadata API or managed DataPack) and remove the other.',
};

/**
 * Pure, deterministic classifier. Assigns every OmniStudio-candidate path to exactly one channel:
 * native-metadata, managed-datapack, or blocked. Directory spelling alone never yields
 * managed-datapack. No I/O other than reading candidate source files already on disk and confined
 * to `projectRoot` (injectable for tests).
 *
 * @ac AC-001, AC-002, AC-003
 */
export async function classifyOmniStudioChannels(
  input: ClassifyOmniStudioChannelsInput
): Promise<OmniStudioChannelClassification[]> {
  const io: FileIo = {
    readFile: input.readFile ?? defaultReadFile,
    resolveRealPath: input.resolveRealPath ?? defaultResolveRealPath,
    statSize: input.statSize ?? defaultStatSize,
  };
  const candidates = [...new Set(input.changedPaths.map(normalizePath))].filter(isOmniStudioCandidate);

  const results = new Map<string, OmniStudioChannelClassification>();
  for (const candidatePath of candidates) {
    // eslint-disable-next-line no-await-in-loop -- classification order must stay deterministic per path.
    results.set(candidatePath, await classifyOne(candidatePath, input.projectRoot, io));
  }

  detectConflicts(results);

  return [...results.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function isOmniStudioCandidate(filePath: string): boolean {
  if (LEGACY_OMNI_PATTERN.test(filePath)) {
    return true;
  }
  return filePath.split('/').some((segment) => NATIVE_DIRECTORY_NAMES.has(segment));
}

async function classifyOne(
  candidatePath: string,
  projectRoot: string,
  io: FileIo
): Promise<OmniStudioChannelClassification> {
  const nativeMatch = matchNativeType(candidatePath);
  if (nativeMatch) {
    return {
      path: candidatePath,
      channel: 'native-metadata',
      artifactKey: `${nativeMatch.type}:${nativeMatch.name}`,
      reason: 'native-shape',
      evidence: [
        `Parent directory "${nativeMatch.directory}" and suffix "${nativeMatch.suffix}" match the Metadata API registry for ${nativeMatch.type}.`,
      ],
    };
  }

  if (isNativeDirectoryWithWrongSuffix(candidatePath)) {
    return unknownShape(
      candidatePath,
      'Parent directory matches a native OmniStudio registry directory, but the file suffix does not match the paired Metadata API suffix.'
    );
  }

  const shapeMatch = matchManagedShape(candidatePath);
  if (!shapeMatch) {
    return unknownShape(candidatePath, 'Path does not match the native registry or the VBT DataPack layout.');
  }

  const jsonResult = await tryReadFile(io, projectRoot, shapeMatch.jsonPath, MAX_DATAPACK_JSON_BYTES);
  if (jsonResult.status === 'oversize') {
    return identityUnproven(
      candidatePath,
      `"${shapeMatch.jsonPath}" exceeds the ${MAX_DATAPACK_JSON_BYTES}-byte size cap for DataPack JSON parsing.`
    );
  }
  if (jsonResult.status === 'unreadable') {
    return unknownShape(
      candidatePath,
      `No readable "${shapeMatch.jsonPath}" DataPack JSON was found for this VBT folder (or it resolves outside the project root).`
    );
  }

  const parsed = tryParseDataPackJson(jsonResult.content);
  if (!parsed) {
    return identityUnproven(
      candidatePath,
      `"${shapeMatch.jsonPath}" is not valid DataPack JSON (malformed, or missing string VlocityDataPackType/${IDENTITY_FIELD_VLOCITY_RECORD_SOBJECT_TYPE}).`
    );
  }

  const identity = await resolveIdentity(parsed.vlocityRecordSObjectType, projectRoot, io);
  if (!identity) {
    return identityUnproven(
      candidatePath,
      `"${IDENTITY_FIELD_VLOCITY_RECORD_SOBJECT_TYPE}" value "${parsed.vlocityRecordSObjectType}" in "${shapeMatch.jsonPath}" is not a concrete managed API name, and no project namespace is declared for the unresolved "${UNRESOLVED_NAMESPACE_TOKEN}" token.`
    );
  }

  return {
    path: candidatePath,
    channel: 'managed-datapack',
    artifactKey: `DataPack:${shapeMatch.dataPackType}/${shapeMatch.name}`,
    reason: 'managed-shape',
    evidence: [
      `VBT DataPack shape matched at "${shapeMatch.jsonPath}" (VlocityDataPackType="${parsed.vlocityDataPackType}").`,
      identity.source === 'concrete-prefix'
        ? `Concrete managed namespace "${identity.namespace}" found in ${IDENTITY_FIELD_VLOCITY_RECORD_SOBJECT_TYPE}="${parsed.vlocityRecordSObjectType}".`
        : `Project-declared namespace "${identity.namespace}" resolved the "${UNRESOLVED_NAMESPACE_TOKEN}" token from "${JOB_FILE_RELATIVE_PATH}".`,
    ],
  };
}

function matchNativeType(
  filePath: string
): { type: string; directory: string; suffix: string; name: string } | undefined {
  const segments = filePath.split('/');
  const fileName = segments[segments.length - 1] ?? '';
  const parentDir = segments[segments.length - 2] ?? '';

  for (const nativeType of NATIVE_TYPES) {
    if (parentDir === nativeType.directory && fileName.endsWith(nativeType.suffix)) {
      const name = fileName.slice(0, -nativeType.suffix.length);
      if (name.length > 0) {
        return { ...nativeType, name };
      }
    }
  }

  return undefined;
}

function isNativeDirectoryWithWrongSuffix(filePath: string): boolean {
  const segments = filePath.split('/');
  const parentDir = segments[segments.length - 2] ?? '';
  return NATIVE_DIRECTORY_NAMES.has(parentDir);
}

function matchManagedShape(filePath: string): { dataPackType: string; name: string; jsonPath: string } | undefined {
  const segments = filePath.split('/');
  if (segments.length < 3) {
    return undefined;
  }

  const fileName = segments[segments.length - 1] ?? '';
  const name = segments[segments.length - 2] ?? '';
  const dataPackType = segments[segments.length - 3] ?? '';
  const expectedFileName = `${name}_DataPack.json`;

  if (fileName === expectedFileName) {
    return { dataPackType, name, jsonPath: filePath };
  }

  // Sibling file in the same DataPack folder: inherit the folder's classification by locating the
  // folder's own `<Name>_DataPack.json`. If it is not readable, the candidate is unknown-shape.
  const siblingSegments = [...segments.slice(0, -1), expectedFileName];
  return { dataPackType, name, jsonPath: siblingSegments.join('/') };
}

function tryParseDataPackJson(
  raw: string
): { vlocityDataPackType: string; vlocityRecordSObjectType: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  const vlocityDataPackType = record.VlocityDataPackType;
  const vlocityRecordSObjectType = record[IDENTITY_FIELD_VLOCITY_RECORD_SOBJECT_TYPE];

  if (typeof vlocityDataPackType !== 'string' || typeof vlocityRecordSObjectType !== 'string') {
    return undefined;
  }

  return { vlocityDataPackType, vlocityRecordSObjectType };
}

async function resolveIdentity(
  sObjectType: string,
  projectRoot: string,
  io: FileIo
): Promise<{ namespace: string; source: 'concrete-prefix' | 'declared-namespace' } | undefined> {
  const concreteMatch = MANAGED_API_NAME_PATTERN.exec(sObjectType);
  if (concreteMatch?.[1]) {
    return { namespace: concreteMatch[1], source: 'concrete-prefix' };
  }

  if (sObjectType.includes(UNRESOLVED_NAMESPACE_TOKEN)) {
    const declared = await readDeclaredJobNamespace(projectRoot, io);
    if (declared) {
      const resolvedValue = sObjectType.split(UNRESOLVED_NAMESPACE_TOKEN).join(declared);
      const resolvedMatch = MANAGED_API_NAME_PATTERN.exec(resolvedValue);
      if (resolvedMatch?.[1] === declared) {
        return { namespace: declared, source: 'declared-namespace' };
      }
    }
  }

  return undefined;
}

async function readDeclaredJobNamespace(projectRoot: string, io: FileIo): Promise<string | undefined> {
  const jobResult = await tryReadFile(io, projectRoot, JOB_FILE_RELATIVE_PATH, MAX_JOB_FILE_BYTES);
  if (jobResult.status !== 'ok') {
    return undefined;
  }

  const candidate = JOB_NAMESPACE_LINE_PATTERN.exec(jobResult.content)?.[1];
  return candidate && NAMESPACE_PATTERN.test(candidate) ? candidate : undefined;
}

/**
 * Reads `relativePath` under `projectRoot`, confining the read to the project root, in three
 * layers.
 *
 * Lexical layer (F4): reject any path that resolves outside `projectRoot` before touching the
 * filesystem (covers `..` traversal and absolute paths that escape the root).
 *
 * Size layer (N3 hardening): `stat` the resolved path and reject (`oversize`) before reading if it
 * exceeds `maxBytes`, so an oversized file is never loaded into memory at all — not just rejected
 * after a full UTF-8 read.
 *
 * Symlink layer (F4, hardened per N2): resolve both the real project root and the real file path
 * via `io.resolveRealPath`. A symlink inside the project pointing outside it is rejected
 * (`unreadable`). Unlike the original fix, a `realpath` failure on EITHER side now fails closed
 * (`unreadable`) rather than falling back to trusting the read — the in-memory test doubles used
 * by this module's own test suite inject a `resolveRealPath` that returns its input unchanged
 * (identity function) instead of relying on a real-`fs.realpath` failure being tolerated.
 */
async function tryReadFile(
  io: FileIo,
  projectRoot: string,
  relativePath: string,
  maxBytes: number
): Promise<ReadResult> {
  const absPath = path.resolve(projectRoot, relativePath);
  if (escapesRoot(projectRoot, absPath)) {
    return { status: 'unreadable' };
  }

  const size = await io.statSize(absPath).catch(() => undefined);
  if (size === undefined) {
    return { status: 'unreadable' };
  }
  if (size > maxBytes) {
    return { status: 'oversize' };
  }

  let content: string;
  try {
    content = await io.readFile(absPath);
  } catch {
    return { status: 'unreadable' };
  }

  const realProjectRoot = await io.resolveRealPath(projectRoot).catch(() => undefined);
  const realAbsPath = await io.resolveRealPath(absPath).catch(() => undefined);
  if (realProjectRoot === undefined || realAbsPath === undefined || escapesRoot(realProjectRoot, realAbsPath)) {
    return { status: 'unreadable' };
  }

  return { status: 'ok', content };
}

function escapesRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.startsWith('..') || path.isAbsolute(relative);
}

async function defaultReadFile(absPath: string): Promise<string> {
  return fsReadFile(absPath, 'utf8');
}

async function defaultResolveRealPath(absPath: string): Promise<string> {
  return fsRealpath(absPath);
}

async function defaultStatSize(absPath: string): Promise<number> {
  const stats = await fsStat(absPath);
  return stats.size;
}

function detectConflicts(results: Map<string, OmniStudioChannelClassification>): void {
  const byLogicalKey = new Map<string, Array<{ path: string; channel: OmniStudioChannel }>>();

  for (const [candidatePath, classification] of results) {
    const logicalKey = toLogicalKey(classification);
    if (!logicalKey) {
      continue;
    }
    const bucket = byLogicalKey.get(logicalKey) ?? [];
    bucket.push({ path: candidatePath, channel: classification.channel });
    byLogicalKey.set(logicalKey, bucket);
  }

  for (const [logicalKey, entries] of byLogicalKey) {
    const channels = new Set(entries.map((entry) => entry.channel));
    if (channels.size <= 1) {
      continue;
    }
    for (const entry of entries) {
      results.set(entry.path, {
        path: entry.path,
        channel: 'blocked',
        reason: 'channel-conflict',
        evidence: [
          `Logical artifact "${logicalKey}" is classified as both native-metadata and managed-datapack across this input.`,
        ],
        remedy: BLOCKED_REMEDIES['channel-conflict'],
      });
    }
  }
}

/**
 * Builds the shared conflict key in native-type naming (`<NativeType>:<Name>`) for both channels,
 * so a managed DataPack type is mapped through `VBT_TYPE_TO_NATIVE_TYPE` (F2 security fix) before
 * comparison. A DataPack type with no native counterpart (e.g. `SObject`) cannot conflict with any
 * native classification and returns `undefined`.
 *
 * The key is lower-cased (N1 security hardening) because Salesforce `DeveloperName`/component-name
 * uniqueness is case-insensitive — `D` and `d` are the same org artifact — so a case-sensitive key
 * would miss a real conflict between e.g. `vlocity/DataRaptor/d/...` and `omniDataTransforms/D...`.
 */
function toLogicalKey(classification: OmniStudioChannelClassification): string | undefined {
  if (classification.channel === 'native-metadata' && classification.artifactKey) {
    return classification.artifactKey.toLowerCase();
  }

  if (classification.channel === 'managed-datapack' && classification.artifactKey) {
    const [, rest] = classification.artifactKey.split('DataPack:');
    if (!rest) {
      return undefined;
    }
    const [dataPackType, name] = rest.split('/');
    if (!dataPackType || !name) {
      return undefined;
    }
    const nativeType = VBT_TYPE_TO_NATIVE_TYPE[dataPackType];
    if (!nativeType) {
      return undefined;
    }
    return `${nativeType}:${name}`.toLowerCase();
  }

  return undefined;
}

function unknownShape(candidatePath: string, detail: string): OmniStudioChannelClassification {
  return {
    path: candidatePath,
    channel: 'blocked',
    reason: 'unknown-shape',
    evidence: [detail],
    remedy: BLOCKED_REMEDIES['unknown-shape'],
  };
}

function identityUnproven(candidatePath: string, detail: string): OmniStudioChannelClassification {
  return {
    path: candidatePath,
    channel: 'blocked',
    reason: 'identity-unproven',
    evidence: [detail],
    remedy: BLOCKED_REMEDIES['identity-unproven'],
  };
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
