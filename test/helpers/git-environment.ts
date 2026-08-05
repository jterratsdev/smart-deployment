import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const gitRepositoryEnvironmentVariables = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
] as const;

export function createIsolatedGitEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = { ...source };

  for (const variableName of gitRepositoryEnvironmentVariables) {
    delete environment[variableName];
  }

  return environment;
}

export async function execIsolatedGit(cwd: string, ...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    env: createIsolatedGitEnvironment(),
  });
}
