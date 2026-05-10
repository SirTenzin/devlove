export interface DetectionResult {
  /** Total kind words found in the text */
  count: number;
  /** Individual matches */
  matches: Match[];
}

export interface Match {
  word: string;
  index: number;
  severity: Severity;
  group: string;
}

/**
 * Severity here is intensity of affection:
 * - mild: small acknowledgements ("ok", "cool")
 * - moderate: genuine appreciation ("thanks", "nice")
 * - strong: full-on adoration ("love", "amazing", "you're the best")
 */
export type Severity = "mild" | "moderate" | "strong";

interface WordDef {
  word: string;
  severity: Severity;
  group: string;
}

/**
 * Core wordlist: kind, affectionate, and appreciative words people send
 * to their coding agents. Grouped by root sentiment for reporting rollup.
 *
 * Add words below. Each entry needs a `group` (the canonical root used for
 * rollup in the report — variants of the same root share a group) and a
 * `severity` (mild / moderate / strong) which is currently informational only.
 *
 * Each `word` must be unique across the whole list (later entries with the
 * same word will overwrite earlier ones).
 */
const WORDLIST: WordDef[] = [
  // === THANKS family ===
  { word: "thanks", severity: "moderate", group: "thanks" },
  { word: "thank you", severity: "moderate", group: "thanks" },
  { word: "ty", severity: "mild", group: "thanks" },
  { word: "cheers", severity: "mild", group: "thanks" },

  // === BRO family ===
  { word: "bro", severity: "moderate", group: "bro" },
  { word: "buddy", severity: "moderate", group: "bro" },
  { word: "pal", severity: "moderate", group: "bro" },
  { word: "mate", severity: "moderate", group: "bro" },
  { word: "friend", severity: "moderate", group: "bro" },
  { word: "boss", severity: "moderate", group: "bro" },
  { word: "boss man", severity: "moderate", group: "bro" },
  { word: "gang", severity: "moderate", group: "bro" },
  { word: "gng", severity: "moderate", group: "bro" },
  { word: "goat", severity: "strong", group: "bro" },
  { word: "goated", severity: "strong", group: "bro" },
  { word: "legend", severity: "strong", group: "bro" },

  // === GREAT family ===
  { word: "great", severity: "moderate", group: "great" },
  { word: "nice", severity: "moderate", group: "great" },
  { word: "excellent", severity: "strong", group: "great" },
  { word: "solid", severity: "moderate", group: "great" },
  { word: "awesome", severity: "strong", group: "great" },
  { word: "amazing", severity: "strong", group: "great" },
  { word: "incredible", severity: "strong", group: "great" },
  { word: "fantastic", severity: "strong", group: "great" },
  { word: "brilliant", severity: "strong", group: "great" },
  { word: "lifesaver", severity: "strong", group: "great" },

  // === GREAT WORK family ===
  { word: "great work", severity: "strong", group: "great work" },
  { word: "great job", severity: "strong", group: "great work" },
  { word: "good job", severity: "moderate", group: "great work" },
  { word: "good stuff", severity: "moderate", group: "great work" },
  { word: "good work", severity: "moderate", group: "great work" },
  { word: "nice job", severity: "moderate", group: "great work" },
  { word: "nice work", severity: "moderate", group: "great work" },
  { word: "nice one", severity: "moderate", group: "great work" },
  { word: "well done", severity: "strong", group: "great work" },

  // === PLEASE family ===
  { word: "please", severity: "moderate", group: "please" },
  { word: "pls", severity: "mild", group: "please" },
  { word: "plz", severity: "mild", group: "please" },

  // === SORRY family ===
  { word: "sorry", severity: "moderate", group: "sorry" },
  { word: "my bad", severity: "moderate", group: "sorry" },
  { word: "mb", severity: "mild", group: "sorry" },
  { word: "oops", severity: "mild", group: "sorry" },

  // === LOVE family ===
  { word: "love", severity: "strong", group: "love" },
  { word: "ily", severity: "strong", group: "love" },
  { word: "kiss", severity: "strong", group: "love" },

  // === YAY family ===
  { word: "yay", severity: "mild", group: "yay" },
];

/**
 * Strip XML-wrapped attachment blocks that get injected into "user" messages
 * by various clients (file attachments, system reminders, project context, etc.)
 * so we don't count words that appear inside attached file contents.
 *
 * These tags wrap content the user didn't actually type:
 *   <file>...</file>             — opencode @-mentioned files
 *   <system-reminder>...</system-reminder> — injected reminders
 *   <project>...</project>       — project context blocks
 */
const ATTACHMENT_TAGS = ["file", "system-reminder", "project"];
const ATTACHMENT_PATTERN = new RegExp(
  `<(${ATTACHMENT_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?</\\1>`,
  "gi",
);

export function stripAttachments(text: string): string {
  return text.replace(ATTACHMENT_PATTERN, " ");
}

/**
 * Build the detection regex from the wordlist.
 * Sort longer words first so "lifesaver" matches before "live" would, etc.
 */
function buildPattern(words: WordDef[]): RegExp {
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);
  const pattern = sorted.map((w) => w.word).join("|");
  return new RegExp(`\\b(${pattern})\\b`, "gi");
}

const DEFAULT_PATTERN = buildPattern(WORDLIST);
const WORD_MAP = new Map(WORDLIST.map((w) => [w.word.toLowerCase(), w]));

/**
 * Detect kind words in a string.
 *
 * Runs detection in two passes:
 * 1. Direct match on original (lowercased) text — captures original positions.
 * 2. Match on repeat-collapsed text — catches loooove → love, thaaaanks → thanks.
 *
 * Dedup strategy: each pass tracks its own match positions, and we map pass-2
 * collapsed-text positions back to original-text positions to avoid double-
 * counting words that already matched in pass 1.
 */
export function detect(text: string): DetectionResult {
  const cleaned = stripAttachments(text);
  return runDetection(cleaned, DEFAULT_PATTERN, WORD_MAP);
}

function runDetection(
  text: string,
  pattern: RegExp,
  wordMap: Map<string, WordDef>,
): DetectionResult {
  const matches: Match[] = [];
  const lower = text.toLowerCase();
  const seenOriginal = new Set<number>(); // original-text positions already matched

  // Pass 1: match against original (lowercased) text. Indices are in original space.
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(lower)) !== null) {
    const word = m[0].toLowerCase();
    const entry = wordMap.get(word);
    if (!entry) continue;
    if (seenOriginal.has(m.index)) continue;
    seenOriginal.add(m.index);
    matches.push({ word, index: m.index, severity: entry.severity, group: entry.group });
  }

  // Pass 2: match against collapsed text. Indices are in collapsed space, so we
  // map them back to the original via a position-mapping built during collapse.
  const { collapsed, originalIndexOf } = collapseRepeatsWithMap(lower);
  if (collapsed !== lower) {
    pattern.lastIndex = 0;
    while ((m = pattern.exec(collapsed)) !== null) {
      const word = m[0].toLowerCase();
      const entry = wordMap.get(word);
      if (!entry) continue;
      const originalIdx = originalIndexOf[m.index];
      if (originalIdx === undefined) continue;
      if (seenOriginal.has(originalIdx)) continue;
      seenOriginal.add(originalIdx);
      matches.push({ word, index: originalIdx, severity: entry.severity, group: entry.group });
    }
  }

  return { count: matches.length, matches };
}

/**
 * Collapse runs of 2+ identical characters, also returning a mapping from
 * each collapsed-text index back to its corresponding original-text index.
 */
function collapseRepeatsWithMap(text: string): {
  collapsed: string;
  originalIndexOf: number[];
} {
  let collapsed = "";
  const originalIndexOf: number[] = [];
  let prev: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== undefined && ch !== prev) {
      originalIndexOf.push(i);
      collapsed += ch;
      prev = ch;
    }
  }
  return { collapsed, originalIndexOf };
}

/**
 * Create a custom detector with additional words.
 */
export function createDetector(
  extraWords?: WordDef[],
): (text: string) => DetectionResult {
  const allWords = extraWords ? [...WORDLIST, ...extraWords] : WORDLIST;
  const pattern = buildPattern(allWords);
  const wordMap = new Map(allWords.map((w) => [w.word.toLowerCase(), w]));

  return (text: string): DetectionResult => {
    const cleaned = stripAttachments(text);
    return runDetection(cleaned, pattern, wordMap);
  };
}

export type { WordDef as WordEntry };
