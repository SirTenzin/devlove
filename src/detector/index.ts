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
  { word: "thank", severity: "moderate", group: "thanks" },
  { word: "ty", severity: "mild", group: "thanks" },

  // === LOVE family ===
  { word: "love", severity: "strong", group: "love" },

  // TODO: add the rest of the wordlist here.
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
 * Normalize text before matching:
 * Collapse runs of 2+ identical characters to a single one for matching purposes.
 * e.g. "thaaaanks" → "thanks", "yesssss" → "yes", "loooove" → "love"
 */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
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
 * 1. Direct match on original text (preserves positions)
 * 2. Match on repeat-collapsed text (catches loooove, thaaaanks, etc.)
 */
export function detect(text: string): DetectionResult {
  const cleaned = stripAttachments(text);
  const matches: Match[] = [];
  const seen = new Set<number>(); // track positions we've already matched

  // Pass 1: direct match on original (lowercase) text
  runPattern(cleaned, cleaned.toLowerCase(), matches, seen);

  // Pass 2: match on collapsed text to catch repeated chars
  const collapsed = collapseRepeats(cleaned.toLowerCase());
  if (collapsed !== cleaned.toLowerCase()) {
    runPattern(cleaned, collapsed, matches, seen);
  }

  return { count: matches.length, matches };
}

function runPattern(
  _originalText: string,
  searchText: string,
  matches: Match[],
  seen: Set<number>,
): void {
  DEFAULT_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DEFAULT_PATTERN.exec(searchText)) !== null) {
    if (seen.has(match.index)) continue;

    const word = match[0].toLowerCase();
    const entry = WORD_MAP.get(word);
    if (!entry) continue;

    seen.add(match.index);
    matches.push({
      word,
      index: match.index,
      severity: entry.severity,
      group: entry.group,
    });
  }
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
    const matches: Match[] = [];
    const seen = new Set<number>();

    const lower = cleaned.toLowerCase();
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lower)) !== null) {
      if (seen.has(match.index)) continue;
      const word = match[0].toLowerCase();
      const entry = wordMap.get(word);
      if (!entry) continue;
      seen.add(match.index);
      matches.push({ word, index: match.index, severity: entry.severity, group: entry.group });
    }

    const collapsed = collapseRepeats(lower);
    if (collapsed !== lower) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(collapsed)) !== null) {
        if (seen.has(match.index)) continue;
        const word = match[0].toLowerCase();
        const entry = wordMap.get(word);
        if (!entry) continue;
        seen.add(match.index);
        matches.push({ word, index: match.index, severity: entry.severity, group: entry.group });
      }
    }

    return { count: matches.length, matches };
  };
}

export type { WordDef as WordEntry };
