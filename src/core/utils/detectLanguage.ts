import { SupportedLanguage } from "@/core/theme/tokens";

interface WeightedPattern {
  regex: RegExp;
  weight: number;
}

function scorePatterns(text: string, patterns: WeightedPattern[]): number {
  let score = 0;
  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].regex.test(text)) {
      score += patterns[i].weight;
    }
  }
  return score;
}

const MARKDOWN_FENCED_BLOCK_RE =
  /(?:^|\r?\n)[ \t]{0,3}(```|~~~)[^\n]*\r?\n[\s\S]*?\r?\n[ \t]{0,3}\1[ \t]*(?=\r?\n|$)/g;

/**
 * Strips Markdown fenced code block bodies before scoring programming languages
 * so embedded ```ts / ```python / ```mermaid examples do not hijack Markdown docs.
 */
function stripMarkdownFencedBlocks(text: string): string {
  return text.replace(MARKDOWN_FENCED_BLOCK_RE, "\n").trim();
}

/**
 * Intelligent multi-signal weighted language detector for code snippets.
 * Evaluates syntax signatures, structural rules, and disambiguation penalties
 * across all supported programming languages.
 */
export function detectLanguage(code: string): SupportedLanguage {
  const trimmed = code.trim();
  if (!trimmed) {
    return "plaintext";
  }

  // 1. Shebang (#!) immediate detection
  if (trimmed.startsWith("#!")) {
    const firstLine = trimmed.split("\n", 1)[0].toLowerCase();
    if (firstLine.includes("python")) return "python";
    if (firstLine.includes("ts-node") || firstLine.includes("deno") || firstLine.includes("bun")) {
      return "typescript";
    }
    if (firstLine.includes("node")) return "javascript";
    if (/\b(bash|sh|zsh|fish|ksh|ash)\b/.test(firstLine)) return "shell";
  }

  // 2. Strict or trailing-comma JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      try {
        const relaxed = trimmed.replace(/,\s*([}\]])/g, "$1");
        JSON.parse(relaxed);
        return "json";
      } catch {
        // Not pure JSON; continue scoring (could be JS/TS object, Rust block, CSS, etc.)
      }
    }
  }

  // 3. Weighted scoring across all supported languages
  const scores: Record<SupportedLanguage, number> = {
    typescript: 0,
    javascript: 0,
    rust: 0,
    python: 0,
    java: 0,
    cpp: 0,
    sql: 0,
    html: 0,
    css: 0,
    json: 0,
    markdown: 0,
    shell: 0,
    yaml: 0,
    plaintext: 0,
  };

  // Score programming/markup languages against text outside Markdown code fences
  // so embedded ```ts / ```python / ```mermaid snippets inside Markdown don't hijack detection.
  const analysisText = stripMarkdownFencedBlocks(trimmed);

  // --- RUST ---
  scores.rust = scorePatterns(analysisText, [
    { regex: /\bfn\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(<[^>]*>)?\s*\(/, weight: 4 },
    { regex: /\blet\s+mut\s+[a-zA-Z_]/, weight: 4 },
    { regex: /\bpub(\([^)]+\))?\s+(async\s+)?(fn|struct|enum|mod|trait|impl|type|const|use)\b/, weight: 4 },
    { regex: /\bimpl(\s*<[^>]*>)?\s+[A-Za-z_][A-Za-z0-9_:]*/, weight: 4 },
    { regex: /\buse\s+(std|crate|super|serde|tokio|tauri|anyhow|thiserror)::/, weight: 4 },
    { regex: /\b(println|eprintln|format|vec|panic|todo|unimplemented|unreachable| env|include_str)!\s*[\(\[]/, weight: 4 },
    { regex: /#\[(\w+::)?(derive|inline|test|cfg|allow|warn|serde|tokio|tauri)\b/, weight: 4 },
    { regex: /->\s*(Result|Option|Vec|Box|Arc|Rc| Self|&|impl\s)/, weight: 3 },
    { regex: /\bmatch\s+[^;{]+\{/, weight: 3 },
    { regex: /\b(Some|Ok|Err)\s*\(/, weight: 2 },
    { regex: /\.(unwrap|expect|unwrap_or|unwrap_or_else|is_some|is_none|is_ok|is_err)\s*\(/, weight: 2 },
    { regex: /\b(&str|&mut\s+\w+|String::from|Vec::new)\b/, weight: 3 },
  ]);

  // --- PYTHON ---
  scores.python = scorePatterns(analysisText, [
    { regex: /^\s*(async\s+)?def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*(->\s*[^:]+)?:/m, weight: 4 },
    { regex: /^\s*class\s+[a-zA-Z_][a-zA-Z0-9_]*(\s*\([^)]*\))?\s*:/m, weight: 4 },
    { regex: /^\s*from\s+[a-zA-Z0-9_.]+\s+import\s+/m, weight: 4 },
    { regex: /^\s*import\s+[a-zA-Z0-9_.]+(\s+as\s+[a-zA-Z0-9_]+)?\s*$/m, weight: 3 },
    { regex: /^\s*elif\s+.+:/m, weight: 4 },
    { regex: /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/, weight: 5 },
    { regex: /\bdef\s+__init__\s*\(\s*self\b/, weight: 5 },
    { regex: /\bself\.[a-zA-Z_][a-zA-Z0-9_]*/, weight: 3 },
    { regex: /^\s*@(dataclass|property|staticmethod|classmethod|app\.(get|post|put|delete|route))\b/m, weight: 4 },
    { regex: /^\s*except(\s+[A-Za-z0-9_., ()]+)?\s*:/m, weight: 4 },
    { regex: /^\s*with\s+open\s*\([^)]+\)\s+as\s+\w+\s*:/m, weight: 4 },
    { regex: /\bprint\s*\(/, weight: 2 },
    { regex: /\b(None|True|False)\b/, weight: 2 },
    { regex: /\[[^\]]+\bfor\s+[a-zA-Z_]\w*\s+in\s+[^\]]+\]/, weight: 3 },
  ]);

  // --- JAVA ---
  scores.java = scorePatterns(analysisText, [
    { regex: /\b(public|private|protected)\s+(abstract\s+|final\s+)?(class|interface|enum|record)\s+[A-Z][a-zA-Z0-9_]*/, weight: 4 },
    { regex: /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(\[\s*\]|\.\.\.)\s*\w+\s*\)/, weight: 5 },
    { regex: /\bSystem\.(out|err)\.(println|print|printf)\s*\(/, weight: 5 },
    { regex: /^\s*import\s+(static\s+)?(java|javax|jakarta|org\.springframework|org\.junit|com\.google)\.[a-zA-Z0-9_.*]+;/m, weight: 5 },
    { regex: /^\s*package\s+[a-zA-Z0-9_.]+;/m, weight: 4 },
    { regex: /@(Override|Autowired|SpringBootApplication|RestController|Controller|Service|Repository|Entity|Table|Id|GetMapping|PostMapping|Bean|Test)\b/, weight: 4 },
    { regex: /\b(private|protected|public)\s+(static\s+)?(final\s+)?(int|long|double|float|boolean|char|byte|short|String|void|List<[^>]+>|Map<[^>]+>|Set<[^>]+>|Optional<[^>]+>)\s+[a-zA-Z_]\w*\s*[=;()]/, weight: 3 },
    { regex: /\bnew\s+(ArrayList|HashMap|HashSet|LinkedList|StringBuilder|Optional)\b/, weight: 3 },
  ]);

  // --- C / C++ ---
  scores.cpp = scorePatterns(analysisText, [
    { regex: /^\s*#include\s+[<"][a-zA-Z0-9_./+-]+[>"]/m, weight: 5 },
    { regex: /^\s*#(define|ifndef|ifdef|endif|pragma\s+once)\b/m, weight: 4 },
    { regex: /\bstd::(cout|cin|cerr|endl|vector|string|map|unordered_map|set|unique_ptr|shared_ptr|make_unique|make_shared|move|sort|pair|function)\b/, weight: 5 },
    { regex: /\busing\s+namespace\s+std\s*;/, weight: 5 },
    { regex: /\btemplate\s*<\s*(typename|class)\s+[A-Za-z_]/, weight: 5 },
    { regex: /\bint\s+main\s*\(\s*(void|int\s+\w+\s*,\s*(const\s+)?char\s*\*\s*\w+(\[\])?)?\s*\)\s*\{/, weight: 5 },
    { regex: /\bnullptr\b/, weight: 4 },
    { regex: /\b(cout|cerr)\s*<<|cin\s*>>/, weight: 4 },
    { regex: /\b(printf|scanf|fprintf|sprintf|snprintf|malloc|calloc|realloc|free|memcpy|memset|strlen|strcmp)\s*\(/, weight: 3 },
    { regex: /\b(uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|ssize_t)\b/, weight: 3 },
    { regex: /\b(void|int|char|float|double|long|unsigned|struct\s+\w+)\s*\*\s*[a-zA-Z_]\w*\s*[=,;)]/, weight: 3 },
  ]);

  // --- SQL ---
  scores.sql = scorePatterns(analysisText, [
    { regex: /\bSELECT\b[\s\S]+?\bFROM\b\s+[a-zA-Z0-9_`."[\]]+/i, weight: 5 },
    { regex: /\bINSERT\s+INTO\s+[a-zA-Z0-9_`."[\]]+\s*(\([^)]+\))?\s*VALUES\b/i, weight: 5 },
    { regex: /\bUPDATE\s+[a-zA-Z0-9_`."[\]]+\s+SET\s+[a-zA-Z0-9_`."]+\s*=/i, weight: 5 },
    { regex: /\bDELETE\s+FROM\s+[a-zA-Z0-9_`."[\]]+/i, weight: 5 },
    { regex: /\bCREATE\s+(OR\s+REPLACE\s+)?(TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW|INDEX|UNIQUE\s+INDEX|DATABASE|SCHEMA|FUNCTION|PROCEDURE|TRIGGER)\b/i, weight: 5 },
    { regex: /\b(ALTER|DROP|TRUNCATE)\s+TABLE\s+[a-zA-Z0-9_`."[\]]+/i, weight: 5 },
    { regex: /\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+(OUTER\s+)?JOIN\s+[a-zA-Z0-9_`."[\]]+\s+ON\b/i, weight: 4 },
    { regex: /\bWHERE\s+[a-zA-Z0-9_`."]+\s*(=|<>|!=|>|<|>=|<=|\bIN\b|\bLIKE\b|\bIS\s+(NOT\s+)?NULL\b|\bBETWEEN\b)/i, weight: 3 },
    { regex: /\b(GROUP\s+BY|ORDER\s+BY|HAVING\s+COUNT)\b/i, weight: 3 },
    { regex: /\b(PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES|AUTO_INCREMENT|NOT\s+NULL|DEFAULT\s+NOW\(\)|VARCHAR\(\d+\))\b/i, weight: 3 },
  ]);

  // --- TYPESCRIPT & JAVASCRIPT ---
  const jsCommonScore = scorePatterns(analysisText, [
    { regex: /\b(const|let|var)\s+(\{[^}]+\}|\[[^\]]+\]|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/, weight: 3 },
    { regex: /\b(async\s+)?function\s*\*?\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, weight: 3 },
    { regex: /\bconsole\.(log|error|warn|info|debug|table|dir|time|timeEnd)\s*\(/, weight: 4 },
    { regex: /^\s*import\s+([\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?/m, weight: 4 },
    { regex: /^\s*export\s+(default\s+)?(async\s+)?(function|const|let|var|class)\b/m, weight: 4 },
    { regex: /\b(document|window)\.(getElementById|querySelector|querySelectorAll|addEventListener|localStorage|sessionStorage|fetch)\b/, weight: 4 },
    { regex: /\bmodule\.exports\s*=|\brequire\s*\(\s*['"][^'"]+['"]\s*\)/, weight: 4 },
    { regex: /\([^)]*\)\s*=>\s*(\{|[^\s;])|[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>\s*/, weight: 2 },
    { regex: /\.(map|filter|reduce|forEach|find|some|every|flatMap|then|catch)\s*\(/, weight: 2 },
    { regex: /\b(useState|useEffect|useMemo|useCallback|useRef|useContext|useReducer)\s*\(/, weight: 4 },
    { regex: /\bclassName\s*=\s*["'{]|\bonClick\s*=\s*\{/, weight: 4 },
  ]);

  const tsSpecificScore = scorePatterns(analysisText, [
    { regex: /^\s*(export\s+)?(declare\s+)?interface\s+[A-Z][a-zA-Z0-9_]*(\s*<[^>]+>)?\s*(extends\s+[^{]+)?\{/m, weight: 5 },
    { regex: /^\s*(export\s+)?(declare\s+)?type\s+[A-Z][a-zA-Z0-9_]*(\s*<[^>]+>)?\s*=/m, weight: 5 },
    { regex: /^\s*(export\s+)?(const\s+)?enum\s+[A-Z][a-zA-Z0-9_]*\s*\{/m, weight: 5 },
    { regex: /\bimport\s+type\s+\{/, weight: 5 },
    { regex: /\b(useState|useRef|useMemo|useCallback|useContext|createContext)<[^>]+>\s*\(/, weight: 5 },
    { regex: /:\s*React\.(FC|FunctionComponent|ReactNode|MouseEvent|ChangeEvent|KeyboardEvent|FormEvent|CSSProperties)\b/, weight: 5 },
    { regex: /\b(Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|Promise|Array|ReadonlyArray|Set|Map)<\s*[a-zA-Z0-9_[\]|&<>,\s]+\s*>/, weight: 4 },
    { regex: /(\w+|\))\s*\??:\s*(string|number|boolean|any|unknown|never|void|bigint|symbol|object)(\[\])?\s*[=,;)\n{]/, weight: 4 },
    { regex: /\([a-zA-Z_$][a-zA-Z0-9_$]*\s*\??:\s*[A-Z][a-zA-Z0-9_<>[\]|&\s]*\)/, weight: 3 },
    { regex: /\bas\s+(const|unknown|any|string|number|boolean|[A-Z][a-zA-Z0-9_<>[\]]*)\b/, weight: 4 },
    { regex: /\bsatisfies\s+[A-Z][a-zA-Z0-9_<>[\]]*/, weight: 5 },
    { regex: /\b(private|protected|public|readonly)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*(\??:\s*|=)/, weight: 3 },
  ]);

  scores.javascript = jsCommonScore;
  scores.typescript = tsSpecificScore > 0 ? jsCommonScore + tsSpecificScore : 0;

  // Penalize Java / C++ if TS/JS specific tokens are strong
  if (scores.typescript >= 5 || scores.javascript >= 5) {
    if (!/\bSystem\.out\.|\bpublic\s+static\s+void\s+main\b/.test(analysisText)) {
      scores.java = Math.max(0, scores.java - 4);
    }
  }

  // --- HTML ---
  scores.html = scorePatterns(analysisText, [
    { regex: /<!DOCTYPE\s+html\b/i, weight: 6 },
    { regex: /<(html|head|body|meta|link|title)\b[^>]*>/i, weight: 5 },
    { regex: /<(div|section|article|header|footer|main|nav|aside|ul|ol|li|table|thead|tbody|tr|td|th|form|input|button|select|option|textarea|label|h[1-6]|p|a|span|img|svg|canvas|iframe|script|style)\b[^>]*>/i, weight: 3 },
    { regex: /<\/(html|head|body|div|section|article|header|footer|main|nav|aside|ul|ol|li|table|form|button|select|textarea|label|h[1-6]|p|a|span|svg|script|style)>/i, weight: 3 },
  ]);

  // Disambiguate JSX / TSX from pure HTML
  const hasJsxOrTsxSignals =
    /\b(import\s+.*from|export\s+(default|const|function|interface|type)|const\s+\[|useState|useEffect|className=|onClick=\{|onChange=\{|return\s*\(\s*<)/.test(
      analysisText
    );
  if (hasJsxOrTsxSignals) {
    scores.html = 0;
    if (tsSpecificScore > 0) {
      scores.typescript += 4;
    } else {
      scores.javascript += 4;
    }
  }

  // --- CSS ---
  scores.css = scorePatterns(analysisText, [
    { regex: /@(media|keyframes|import|tailwind|layer|supports|font-face)\b/, weight: 5 },
    { regex: /:root\s*\{[\s\S]*?--[a-zA-Z0-9-]+\s*:/, weight: 5 },
    { regex: /(^|[\s,}])([.#]?[a-zA-Z0-9_-]+|:[a-zA-Z-]+)\s*\{[^}]*\b(display|position|margin|padding|color|background|background-color|border|border-radius|font-size|font-family|font-weight|width|height|max-width|min-height|flex|grid|gap|align-items|justify-content|opacity|transition|transform|z-index|box-shadow|cursor|overflow)\s*:/m, weight: 5 },
    { regex: /^\s*--[a-zA-Z0-9-]+\s*:\s*[^;]+;\s*$/m, weight: 3 },
    { regex: /\b(var\(--[a-zA-Z0-9-]+\)|rgba?\([^)]+\)|hsla?\([^)]+\)|\d+(px|rem|em|vh|vw|%))\s*[;}]/, weight: 2 },
  ]);

  // --- SHELL / BASH ---
  scores.shell = scorePatterns(analysisText, [
    { regex: /^\s*if\s+\[\[?\s+.*?\s+\]\]?\s*;\s*then\b/m, weight: 5 },
    { regex: /^\s*for\s+\w+\s+in\s+[^;]+;\s*do\b/m, weight: 5 },
    { regex: /^\s*(fi|done|esac)\s*$/m, weight: 4 },
    { regex: /^\s*(sudo|chmod|chown|mkdir|rm\s+-[rf]+|cp\s+-|mv\s+|ls\s+-|cat\s+|grep\s+|awk\s+|sed\s+|curl\s+|wget\s+|tar\s+-|ssh\s+|scp\s+|git\s+(clone|status|add|commit|push|pull|checkout|branch|merge|rebase|log|diff)|docker\s+(run|build|pull|push|ps|exec|compose)|kubectl\s+(get|apply|describe|logs|delete)|npm\s+(install|i|run|test|build|start|init)|pnpm\s+|yarn\s+|cargo\s+(build|run|test|check|add)|pip\s+install|brew\s+install|apt(-get)?\s+(install|update|upgrade)|systemctl\s+|export\s+[A-Z0-9_]+=|echo\s+)/m, weight: 4 },
    { regex: /\$\{[A-Za-z0-9_]+\}|\$[1-9@#?$!]\b/, weight: 2 },
  ]);

  // Prevent Shell false positives when strong programming language constructs exist
  if (
    scores.typescript >= 5 ||
    scores.javascript >= 5 ||
    scores.python >= 5 ||
    scores.rust >= 5 ||
    scores.java >= 5 ||
    scores.cpp >= 5
  ) {
    scores.shell = Math.max(0, scores.shell - 4);
  }

  // --- MARKDOWN ---
  scores.markdown = scorePatterns(trimmed, [
    { regex: /^#{1,6}\s+\S+.*$/m, weight: 3 },
    { regex: /^#{2,6}\s+\S+.*$/m, weight: 2 },
    { regex: /^[ \t]{0,3}(```|~~~)[a-zA-Z0-9_+-]*[^\n]*\r?\n[\s\S]*?\r?\n[ \t]{0,3}\1[ \t]*(?=\r?\n|$)/m, weight: 6 },
    { regex: /^\s*[-*+]\s+\[[ xX]\]\s+\S+/m, weight: 4 },
    { regex: /!?\[[^\]]+\]\((?:https?:\/\/|codestash-asset:|\/|\.\/|#|\S+\.[a-z]{2,})[^)]*\)/, weight: 3 },
    { regex: /^\|.+\|.+\|\s*\r?\n\s*\|[-:| ]+\|/m, weight: 5 },
    { regex: /^\s*>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/m, weight: 4 },
    { regex: /^\s*>\s+\S+/m, weight: 2 },
    { regex: /\*\*[^*\n]+\*\*/, weight: 2 },
    { regex: /~~[^~\n]+~~/, weight: 2 },
    { regex: /`[^`\n]+`/, weight: 2 },
    { regex: /^\s*(?:[-*+]|\d+\.)\s+\S+.*\r?\n\s*(?:[-*+]|\d+\.)\s+\S+/m, weight: 2 },
  ]);

  // --- YAML ---
  const hasBracesOrSemicolons = /[{};]/.test(analysisText);
  scores.yaml = scorePatterns(analysisText, [
    { regex: /^---[ \t]*\r?$/m, weight: 4 },
    { regex: /^(apiVersion|kind|metadata|spec|services|volumes|networks|jobs|runs-on|steps|env|dependencies|devDependencies)\s*:/m, weight: 4 },
    { regex: /^[a-zA-Z0-9_.-]+\s*:\s*(\S+.*)?\r?\n\s+[a-zA-Z0-9_.-]+\s*:/m, weight: 4 },
    { regex: /^\s*-\s+[a-zA-Z0-9_.-]+\s*:\s*\S+/m, weight: 3 },
    { regex: /^\s*[a-zA-Z0-9_.-]+\s*:\s*\r?\n(\s+-\s+\S+)+/m, weight: 4 },
  ]);
  if (hasBracesOrSemicolons && !/^---[ \t]*\r?$/m.test(analysisText)) {
    scores.yaml = Math.max(0, scores.yaml - 4);
  }
  // Markdown document starting with YAML frontmatter should still resolve to Markdown
  if (/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/.test(trimmed) && scores.markdown >= 3) {
    scores.yaml = Math.max(0, scores.yaml - 6);
  }

  // --- JSON fallback (partial / relaxed JSON object or array) ---
  if (
    /^\s*\{\s*"[^"]+"\s*:/.test(analysisText) &&
    analysisText.endsWith("}")
  ) {
    scores.json = 5;
  }

  // Find highest scoring language (minimum threshold: 3 points)
  const priorityOrder: SupportedLanguage[] = [
    "typescript",
    "rust",
    "python",
    "java",
    "cpp",
    "sql",
    "css",
    "json",
    "javascript",
    "html",
    "shell",
    "yaml",
    "markdown",
  ];

  let bestLang: SupportedLanguage = "plaintext";
  let bestScore = 2; // require at least 3 points to classify as non-plaintext

  for (const lang of priorityOrder) {
    if (scores[lang] > bestScore) {
      bestScore = scores[lang];
      bestLang = lang;
    }
  }

  return bestLang;
}
