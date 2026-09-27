import type { RepoFact, RepositoryGraph } from '@pitcrew/protocol';

export function revalidateFacts(
  facts: readonly RepoFact[],
  current: Record<string, string>,
): RepoFact[] {
  return facts.map((fact) => ({
    ...fact,
    stale: Object.entries(fact.dependencies).some(
      ([path, digest]) => current[path] !== digest,
    ),
  }));
}
export function graphDigests(graph: RepositoryGraph): Record<string, string> {
  return {
    $boundaries: graph.boundaryDigest,
    ...Object.fromEntries(graph.files.map((file) => [file.path, file.digest])),
  };
}
export function relevantFacts(
  facts: readonly RepoFact[],
  query: string,
  limit = 30,
): RepoFact[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  return facts
    .filter((fact) => !fact.stale)
    .map((fact) => ({
      fact,
      score: terms.filter((term) =>
        (fact.subject + ' ' + fact.value).toLowerCase().includes(term),
      ).length,
    }))
    .sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id))
    .slice(0, limit)
    .map((item) => item.fact);
}
