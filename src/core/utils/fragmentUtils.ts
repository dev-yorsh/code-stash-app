import { Snippet, SnippetFragment } from "@/core/types";

/**
 * Generates the next default fragment label following the sequence:
 * Fragment, Fragment 1, Fragment 2, Fragment 3, etc.
 */
export function generateNextFragmentLabel(fragments: { label: string }[]): string {
  const existing = new Set(
    fragments.map((f) => f.label.trim().toLowerCase())
  );

  if (!existing.has("fragment")) {
    return "Fragment";
  }

  let counter = 1;
  while (existing.has(`fragment ${counter}`)) {
    counter++;
  }

  return `Fragment ${counter}`;
}

/**
 * Ensures a snippet has at least one valid fragment.
 * If the snippet has fragments, returns a cloned copy.
 * If not, creates the default "Fragment" from the snippet's code and language.
 */
export function getSnippetFragments(snippet?: Snippet | null): SnippetFragment[] {
  if (snippet?.fragments && snippet.fragments.length > 0) {
    return snippet.fragments.map((f) => ({ ...f }));
  }

  return [
    {
      id: "f-" + (snippet?.id ? `${snippet.id}-1` : Date.now().toString()),
      label: "Fragment",
      code: snippet?.code || "",
      language: snippet?.language || "plaintext",
    },
  ];
}

/**
 * Reorders a list of snippet fragments by placing sourceId before or after targetId.
 */
export function reorderFragments(
  list: SnippetFragment[],
  sourceId: string,
  targetId: string,
  position: "before" | "after"
): SnippetFragment[] {
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return list;
  }

  const result = [...list];
  const [removed] = result.splice(sourceIndex, 1);

  const newTargetIndex = result.findIndex((item) => item.id === targetId);
  if (newTargetIndex === -1) return list;

  const insertIndex = position === "before" ? newTargetIndex : newTargetIndex + 1;
  result.splice(insertIndex, 0, removed);

  return result;
}

/**
 * Normalizes text for fast, case-insensitive and accent-insensitive search.
 */
export function normalizeSearchText(text?: string | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Finds the best matching fragment for a search query (checking label, code, and language).
 * Falls back to the first fragment when no query is provided or no specific fragment matches.
 */
export function findMatchingFragment(
  fragments: SnippetFragment[],
  searchQuery?: string
): SnippetFragment {
  const fallback = fragments[0];
  if (!searchQuery || !searchQuery.trim() || fragments.length <= 1) {
    return fallback;
  }

  const q = normalizeSearchText(searchQuery.trim());
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return fallback;

  let bestFrag = fallback;
  let bestScore = 0;

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    const labelNorm = normalizeSearchText(frag.label);
    const codeNorm = normalizeSearchText(frag.code);
    const langNorm = normalizeSearchText(frag.language);

    let score = 0;
    if (labelNorm === q) score += 200;
    else if (labelNorm.startsWith(q)) score += 150;
    else if (labelNorm.includes(q)) score += 100;

    if (codeNorm.includes(q)) score += 80;
    if (langNorm === q || langNorm.includes(q)) score += 50;

    if (tokens.length > 1) {
      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (labelNorm.includes(tok)) score += 25;
        if (codeNorm.includes(tok)) score += 15;
        if (langNorm.includes(tok)) score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestFrag = frag;
    }
  }

  return bestFrag;
}


