export const CODESTASH_ASSET_SCHEME = "codestash-asset://";

const ASSET_URI_REGEX = /codestash-asset:\/\/([a-f0-9]{16,64})(?:\.([a-z0-9]+))?/gi;
const ASSET_ID_STRICT_REGEX = /^[a-f0-9]{16,64}$/i;
const ASSET_EXT_STRICT_REGEX = /^[a-z0-9]{2,8}$/i;

export interface ParsedAssetUri {
  id: string;
  ext?: string;
}

export function isValidAssetId(id: string): boolean {
  return ASSET_ID_STRICT_REGEX.test(id);
}

export function sanitizeAssetExt(ext: string, fallback = "webp"): string {
  const clean = ext.trim().toLowerCase().replace(/^\./, "");
  return ASSET_EXT_STRICT_REGEX.test(clean) ? clean : fallback;
}

export function buildAssetUri(id: string, ext: string): string {
  const safeId = id.trim().toLowerCase();
  const safeExt = sanitizeAssetExt(ext);
  return `${CODESTASH_ASSET_SCHEME}${safeId}.${safeExt}`;
}

export function parseAssetUri(uri: string | null | undefined): ParsedAssetUri | null {
  if (!uri || !uri.startsWith(CODESTASH_ASSET_SCHEME)) {
    return null;
  }
  const rest = uri.slice(CODESTASH_ASSET_SCHEME.length).trim();
  const match = /^([a-f0-9]{16,64})(?:\.([a-z0-9]{2,8}))?(?:[?#].*)?$/i.exec(rest);
  if (!match) {
    return null;
  }
  return {
    id: match[1].toLowerCase(),
    ext: match[2]?.toLowerCase(),
  };
}

export function extractAssetIdsFromText(text?: string | null): string[] {
  if (!text || !text.includes(CODESTASH_ASSET_SCHEME)) {
    return [];
  }
  const seen = new Set<string>();
  ASSET_URI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ASSET_URI_REGEX.exec(text)) !== null) {
    seen.add(match[1].toLowerCase());
  }
  return Array.from(seen);
}

export function extractAssetIdsFromSnippet(snippet: {
  code?: string | null;
  description?: string | null;
  fragments?: Array<{ code?: string | null }> | null;
}): string[] {
  const ids = new Set<string>();
  for (const id of extractAssetIdsFromText(snippet.code)) {
    ids.add(id);
  }
  for (const id of extractAssetIdsFromText(snippet.description)) {
    ids.add(id);
  }
  if (Array.isArray(snippet.fragments)) {
    for (const frag of snippet.fragments) {
      for (const id of extractAssetIdsFromText(frag.code)) {
        ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

export function extractAssetIdsFromSnippets(
  snippets: ReadonlyArray<{
    code?: string | null;
    description?: string | null;
    fragments?: Array<{ code?: string | null }> | null;
  }>
): string[] {
  const allIds = new Set<string>();
  for (const snippet of snippets) {
    for (const id of extractAssetIdsFromSnippet(snippet)) {
      allIds.add(id);
    }
  }
  return Array.from(allIds);
}

export function hasAssetReferenceInSnippet(snippet: {
  code?: string | null;
  fragments?: Array<{ code?: string | null }> | null;
}): boolean {
  if (snippet.code?.includes(CODESTASH_ASSET_SCHEME)) {
    return true;
  }
  if (Array.isArray(snippet.fragments)) {
    return snippet.fragments.some((f) => f.code?.includes(CODESTASH_ASSET_SCHEME));
  }
  return false;
}

export function stripAssetUrisForSearch(text: string): string {
  if (!text || !text.includes(CODESTASH_ASSET_SCHEME)) {
    return text;
  }
  return text
    .replace(/!\[([^\]]*)\]\(codestash-asset:\/\/[^)\s]+\)/gi, "$1")
    .replace(/codestash-asset:\/\/[a-z0-9._-]+/gi, " ");
}

export function guessMimeTypeFromExt(ext?: string): string {
  const clean = (ext ?? "").toLowerCase().replace(/^\./, "");
  switch (clean) {
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}
