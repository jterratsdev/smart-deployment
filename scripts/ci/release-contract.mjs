import { readFile } from 'node:fs/promises';

export const canonicalRepository = 'https://github.com/jterratsdev/smart-deployment';

const normalizeRepository = (value) =>
  (typeof value === 'string' ? value : value?.url)
    ?.replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);

const shellTokens = (command) => {
  const tokens = [];
  let value = '';
  let quote;
  let quoted = false;

  const pushWord = () => {
    if (value || quoted) tokens.push({ type: 'word', value, quoted });
    value = '';
    quoted = false;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        quote = undefined;
        quoted = true;
      } else if (character === '\\' && quote === '"' && index + 1 < command.length) {
        value += command[++index];
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      quoted = true;
    } else if (character === '\\' && index + 1 < command.length) {
      value += command[++index];
    } else if (/\s/.test(character)) {
      pushWord();
    } else if (';&|(){}'.includes(character)) {
      pushWord();
      const pair = command.slice(index, index + 2);
      if (pair === '&&' || pair === '||') index += 1;
      tokens.push({ type: 'operator', value: pair === '&&' || pair === '||' ? pair : character, quoted: false });
    } else {
      value += character;
    }
  }
  pushWord();
  return tokens;
};

const skipCommandWrappers = (tokens) => {
  let index = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index]?.value ?? '')) index += 1;
  while (index < tokens.length) {
    const executable = tokens[index].value.split('/').pop();
    if (executable === 'command' || executable === 'builtin' || executable === 'exec') {
      index += 1;
      while (tokens[index]?.value.startsWith('-')) index += 1;
      continue;
    }
    if (executable === 'env') {
      index += 1;
      while (index < tokens.length) {
        const token = tokens[index].value;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) index += 1;
        else if (token === '-u' || token === '--unset' || token === '-C' || token === '--chdir') index += 2;
        else if (token.startsWith('-')) index += 1;
        else break;
      }
      continue;
    }
    break;
  }
  return index;
};

const gitSubcommand = (tokens, index) => {
  const optionsWithValues = new Set([
    '-C',
    '-c',
    '--config-env',
    '--exec-path',
    '--git-dir',
    '--namespace',
    '--super-prefix',
    '--work-tree',
  ]);
  index += 1;
  while (index < tokens.length) {
    const token = tokens[index].value;
    if (token === '--') return tokens[index + 1]?.value;
    if (!token.startsWith('-')) return token;
    if (optionsWithValues.has(token)) index += 2;
    else index += 1;
  }
};

const commandContainsDirectGitWrite = (command) => {
  const commands = [];
  let current = [];
  for (const token of shellTokens(command)) {
    if (token.type === 'operator') {
      if (current.length > 0) commands.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) commands.push(current);

  return commands.some((tokens) => {
    const executableIndex = skipCommandWrappers(tokens);
    const executable = tokens[executableIndex]?.value.split('/').pop();
    if (/^(?:ba|da|k|z)?sh$/.test(executable ?? '') && tokens[executableIndex + 1]?.value === '-c') {
      return commandContainsDirectGitWrite(tokens[executableIndex + 2]?.value ?? '');
    }
    if (executable === 'eval')
      return commandContainsDirectGitWrite(
        tokens
          .slice(executableIndex + 1)
          .map(({ value }) => value)
          .join(' ')
      );
    if (executable !== 'git' || tokens[executableIndex]?.quoted) return false;
    return /^(?:commit|push)$/i.test(gitSubcommand(tokens, executableIndex) ?? '');
  });
};

const containsDirectGitWrite = (value) => {
  if (typeof value === 'string') return commandContainsDirectGitWrite(value);
  if (Array.isArray(value)) return value.some(containsDirectGitWrite);
  if (value && typeof value === 'object') return Object.values(value).some(containsDirectGitWrite);
  return false;
};

const parseYarnLock = (source) => {
  const entries = [];
  let entry;
  for (const line of source.split(/\r?\n/)) {
    if (line && !/^\s/.test(line) && line.endsWith(':') && !line.startsWith('#')) {
      entry = {
        descriptors: line
          .slice(0, -1)
          .split(/,\s*/)
          .map((descriptor) => descriptor.replace(/^"|"$/g, '')),
      };
      entries.push(entry);
      continue;
    }
    const field = line.match(/^  (version|resolved|integrity) (.+)$/);
    if (entry && field) entry[field[1]] = field[2].replace(/^"|"$/g, '');
  }
  return entries;
};

const resolutionPackageName = (resolution) => {
  if (resolution.startsWith('@')) return resolution;
  return resolution.split('/').at(-1);
};

const descriptorNamesPackage = (descriptor, packageName) => descriptor.startsWith(`${packageName}@`);

export const validateYarnLock = (packageJson, source) => {
  const errors = [];
  const entries = parseYarnLock(source);
  for (const entry of entries) {
    if (!entry.version) continue;
    const label = entry.descriptors.join(', ');
    if (!entry.resolved) errors.push(`yarn.lock entry ${label} is missing resolved`);
    else {
      try {
        new URL(entry.resolved);
      } catch {
        errors.push(`yarn.lock entry ${label} has invalid resolved`);
      }
    }
    if (!entry.integrity) errors.push(`yarn.lock entry ${label} is missing integrity`);
    else if (
      !/^sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2}(?:\s+sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2})*$/.test(
        entry.integrity
      )
    ) {
      errors.push(`yarn.lock entry ${label} has invalid integrity`);
    }
  }

  for (const [resolution, requiredVersion] of Object.entries(packageJson.resolutions ?? {})) {
    const packageName = resolutionPackageName(resolution);
    const matches = entries.filter((entry) =>
      entry.descriptors.some((descriptor) => descriptorNamesPackage(descriptor, packageName))
    );
    if (!matches.some((entry) => entry.version === requiredVersion)) {
      errors.push(`yarn.lock resolution ${resolution} must select ${requiredVersion}`);
    }
  }
  return errors;
};

export const validateReleaseContract = (packageJson, releaseConfig) => {
  const errors = [];
  const expected = {
    repository: canonicalRepository,
    homepage: canonicalRepository,
    bugs: `${canonicalRepository}/issues`,
  };

  for (const [field, expectedValue] of Object.entries(expected)) {
    const actual =
      field === 'repository' ? normalizeRepository(packageJson[field]) : packageJson[field]?.url ?? packageJson[field];
    if (actual !== expectedValue)
      errors.push(`package.json ${field} must be ${expectedValue}; received ${String(actual)}`);
  }

  for (const plugin of releaseConfig.plugins ?? []) {
    const name = pluginName(plugin);
    if (name === '@semantic-release/git')
      errors.push('@semantic-release/git commits release artifacts directly to main');
    if (containsDirectGitWrite(plugin)) errors.push(`${name} config contains a direct git commit or push command`);
  }

  return errors;
};

export const validateReleaseContractFiles = async (root = new URL('../../', import.meta.url)) => {
  const [packageSource, releaseSource, yarnLockSource] = await Promise.all([
    readFile(new URL('package.json', root), 'utf8'),
    readFile(new URL('.releaserc.json', root), 'utf8'),
    readFile(new URL('yarn.lock', root), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageSource);
  return [
    ...validateReleaseContract(packageJson, JSON.parse(releaseSource)),
    ...validateYarnLock(packageJson, yarnLockSource),
  ];
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateReleaseContractFiles();
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Release metadata and protected-main contracts are valid.');
  }
}
