const API_VERSION = '2022-11-28';

export async function fetchRepositoryRuleset({ repository, rulesetName, token, fetchImpl = fetch }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const rulesets = await requestJson(fetchImpl, `https://api.github.com/repos/${repository}/rulesets`, headers);
  const summary = rulesets.find(
    (ruleset) => ruleset.name === rulesetName && ruleset.target === 'branch' && ruleset.enforcement === 'active'
  );
  if (!summary) throw new Error(`Active branch ruleset "${rulesetName}" was not found in ${repository}.`);

  return requestJson(fetchImpl, `https://api.github.com/repos/${repository}/rulesets/${summary.id}`, headers);
}

async function requestJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub API request failed (${response.status}) for ${url}. Use a fine-grained PAT or GitHub App token with repository Administration read permission.`
    );
  }
  return response.json();
}
