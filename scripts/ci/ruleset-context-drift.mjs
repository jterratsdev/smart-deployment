export function requiredContextsFromRuleset(ruleset) {
  const requiredChecks = ruleset.rules?.find((rule) => rule.type === 'required_status_checks');
  return uniqueSorted(requiredChecks?.parameters?.required_status_checks?.map((check) => check.context) ?? []);
}

export function workflowContextsFromYaml(source, targetBranch = 'main') {
  if (!runsForPullRequestBranch(source, targetBranch)) return [];

  const contexts = [];
  const lines = source.split(/\r?\n/);
  let isInJobs = false;
  let currentJob;

  for (const line of lines) {
    if (/^jobs:\s*(?:#.*)?$/.test(line)) {
      isInJobs = true;
      continue;
    }

    if (!isInJobs) continue;
    if (/^[^\s#]/.test(line)) break;

    const job = line.match(/^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/);
    if (job) {
      if (currentJob && canEmitPullRequestStatus(currentJob)) contexts.push(currentJob.name ?? currentJob.id);
      currentJob = { id: job[1] };
      continue;
    }

    const name = line.match(/^    name:\s*(.+?)\s*$/);
    if (currentJob && name) currentJob.name = unquote(name[1]);
    const condition = line.match(/^    if:\s*(.+?)\s*$/);
    if (currentJob && condition) currentJob.condition = unquote(condition[1]);
    if (currentJob && /^    uses:\s*/.test(line)) currentJob.isReusableWorkflow = true;
  }

  if (currentJob && canEmitPullRequestStatus(currentJob)) contexts.push(currentJob.name ?? currentJob.id);
  return uniqueSorted(contexts);
}

function runsForPullRequestBranch(source, targetBranch) {
  const beforeJobs = source.split(/^jobs:\s*(?:#.*)?$/m, 1)[0];
  if (/^on:\s*\[[^\]]*\bpull_request\b[^\]]*\]\s*(?:#.*)?$/m.test(beforeJobs)) return true;

  const lines = beforeJobs.split(/\r?\n/);
  const triggerIndex = lines.findIndex((line) => /^\s{2}pull_request:\s*(?:#.*)?$/.test(line));
  if (triggerIndex < 0) return false;

  const triggerLines = [];
  for (const line of lines.slice(triggerIndex + 1)) {
    if (/^\s{2}\S/.test(line)) break;
    triggerLines.push(line);
  }

  const branches = readBranchFilter(triggerLines, 'branches');
  const ignoredBranches = readBranchFilter(triggerLines, 'branches-ignore');
  if (branches && !branches.includes(targetBranch)) return false;
  return !ignoredBranches?.includes(targetBranch);
}

function readBranchFilter(lines, key) {
  const index = lines.findIndex((line) => new RegExp(`^\\s{4}${key}:`).test(line));
  if (index < 0) return undefined;

  const inline = lines[index].match(/:\s*\[([^\]]*)\]/);
  if (inline) return inline[1].split(',').map((value) => unquote(value.trim()));

  const values = [];
  for (const line of lines.slice(index + 1)) {
    const item = line.match(/^\s{6}-\s*(.+?)\s*$/);
    if (!item) break;
    values.push(unquote(item[1]));
  }
  return values;
}

function canEmitPullRequestStatus(job) {
  if (job.isReusableWorkflow) return false;
  if (!job.condition) return true;

  const condition = job.condition.replace(/^\$\{\{\s*|\s*\}\}$/g, '').trim();
  if (condition === 'false') return false;
  const eventNames = [...condition.matchAll(/github\.event_name\s*==\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (eventNames.length > 0 && !eventNames.includes('pull_request')) return false;
  return !/github\.event_name\s*!=\s*['"]pull_request['"]/.test(condition);
}

export function compareRequiredContexts(requiredContexts, workflowContexts) {
  const emitted = new Set(workflowContexts);
  return {
    required: uniqueSorted(requiredContexts),
    emitted: uniqueSorted(workflowContexts),
    missing: uniqueSorted(requiredContexts.filter((context) => !emitted.has(context))),
  };
}

export function formatContextComparison(result) {
  const lines = [
    `Required ruleset contexts: ${formatList(result.required)}`,
    `Workflow job contexts: ${formatList(result.emitted)}`,
  ];

  if (result.missing.length === 0) {
    lines.push('Required check contexts match workflow job contexts.');
    return lines.join('\n');
  }

  lines.push(`Missing workflow contexts: ${result.missing.join(', ')}`);
  for (const context of result.missing) {
    lines.push(
      `::error title=Required check context drift::Ruleset context "${context}" has no matching workflow job name. Add "name: ${context}" to a PR-triggered job or update the repository ruleset.`
    );
  }

  return lines.join('\n');
}

function formatList(values) {
  return values.length === 0 ? '(none)' : values.join(', ');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function unquote(value) {
  const quote = value[0];
  return quote === value.at(-1) && (quote === '"' || quote === "'") ? value.slice(1, -1) : value;
}
