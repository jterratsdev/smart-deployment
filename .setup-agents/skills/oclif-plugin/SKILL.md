---
name: oclif-plugin-dev
description: >-
  Develop oclif/sf CLI plugins: commands, flags, hooks, manifest generation,
  TypeScript ESM patterns, testing with mocha/chai, npm packaging.
  USE FOR: oclif command, sf plugin, CLI flag, hook, manifest, sf-plugins-core,
  SfCommand, Messages, schema generate, command snapshot, wireit, plugin link.
  Activated on-demand for developer profile.
---

# oclif Plugin Development

## Project Structure

```
src/
├── commands/<topic>/<subtopic>/<verb>.ts   # Command files
├── services/                               # Business logic (testable, no oclif deps)
├── types/index.ts                          # Shared type definitions
├── generators/                             # Content generators
├── profiles/                               # Profile definitions
messages/
├── <topic>.<subtopic>.<verb>.md            # i18n message files (markdown sections)
test/
├── unit/                                   # Fast unit tests (no oclif bootstrap)
├── commands/                               # Command integration tests
├── e2e/                                    # End-to-end CLI output tests
schemas/                                    # Auto-generated JSON schemas per command
```

## Command Anatomy

```typescript
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('<package-name>', '<message-key>');

export type MyResult = { /* JSON-serializable result */ };

export default class MyCommand extends SfCommand<MyResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      required: true,
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      default: false,
    }),
  };

  public async run(): Promise<MyResult> {
    const { flags } = await this.parse(MyCommand);
    // Business logic goes in services/, not here
    this.log(messages.getMessage('info.success', [flags.name]));
    return { /* result */ };
  }
}
```

## Messages File Format

File: `messages/<package>.<topic>.<verb>.md`

```markdown
# summary

One-line summary for --help.

# description

Multi-line description with details.

# flags.name.summary

Short flag description.

# flags.name.description

Longer flag description with usage context.

# examples

- Basic usage:

  <%= config.bin %> <%= command.id %> --name foo

# info.success

Operation completed for %s.
```

## Flag Patterns

| Pattern | Usage |
|---------|-------|
| `Flags.string({ required: true })` | Required string input |
| `Flags.boolean({ default: false })` | Optional toggle |
| `Flags.integer({ min: 1, default: 5 })` | Bounded number |
| `Flags.string({ options: [...] })` | Enum-style selection |
| `Flags.string({ multiple: true })` | Repeatable flag |
| `Flags.string({ exclusive: ['other'] })` | Mutually exclusive |

## Testing

### Unit Tests (mocha + chai)

```typescript
import { expect } from 'chai';
import { myFunction } from '../../../src/services/my-service.js';

describe('myFunction', () => {
  it('returns expected result', () => {
    const result = myFunction(input);
    expect(result).to.deep.equal(expected);
  });
});
```

### Command Tests

```typescript
import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import MyCommand from '../../../src/commands/my/command.js';

describe('my command', () => {
  const $$ = new TestContext();
  afterEach(() => $$.restore());

  it('runs successfully', async () => {
    const result = await MyCommand.run(['--name', 'test']);
    expect(result.name).to.equal('test');
  });
});
```

## Build & Release Pipeline

```bash
# Development
yarn build              # Compile TypeScript (wireit-managed)
yarn lint               # ESLint check
yarn test               # Full test suite (lint + compile + unit + schema + snapshot)

# Schema & Snapshot (MUST run after adding/modifying commands)
./bin/dev.js schema generate      # Regenerate JSON schemas
./bin/dev.js snapshot:generate    # Update command snapshot

# Link for local testing
sf plugins link .       # Link plugin to local sf CLI
```

## Key Rules

1. **Result types must be JSON-serializable** — commands support `--json` output.
2. **Messages over hardcoded strings** — all user-facing text via Messages API.
3. **Services over command logic** — keep commands thin, business logic in `src/services/`.
4. **ESM-only** — use `.js` extensions in imports, `import.meta.url` for paths.
5. **Schema + snapshot after changes** — new commands/flags require regeneration.
6. **Wireit for build orchestration** — defined in package.json, caches builds.
7. **Complexity limit 20** — extract private methods or helper functions if exceeded.
8. **No `eslint-disable`** — fix the pattern, don't suppress the rule.
9. **Append-only state** — use JSONL for state persistence, dedupe on read.
10. **`compact()` removes undefined** — use it when building records with optional fields.

## Hooks

```typescript
// src/hooks/<event>.ts
import type { Hook } from '@oclif/core';

const hook: Hook<'init'> = async function (options) {
  // Hook logic
};

export default hook;
```

Register in `package.json`:
```json
{
  "oclif": {
    "hooks": {
      "init": "./lib/hooks/init.js"
    }
  }
}
```

## Common Patterns

### JSONL State Persistence

```typescript
import { appendJsonlFile, dedupeById, readJsonlFile } from './file-writer.js';

export function listRecords(cwd: string): MyRecord[] {
  return dedupeById(readJsonlFile<MyRecord>(filePath(cwd)));
}

export function addRecord(cwd: string, record: MyRecord): void {
  appendJsonlFile(filePath(cwd), record);
}
```

### Profile Owner Pattern

```typescript
import type { SetupAgentsProfileOwner } from '../types/index.js';

// Always store owners as 'setup-agents:<profileId>'
const owner: SetupAgentsProfileOwner = \`setup-agents:\${profileId}\`;
```

### Error Handling with Result Type

```typescript
import type { Result, WorkflowError } from '../types/index.js';
import { ok, err } from '../types/index.js';

function riskyOp(): Result<Data, WorkflowError> {
  if (bad) return err({ code: 'my-error', message: 'Details' });
  return ok(data);
}
```
