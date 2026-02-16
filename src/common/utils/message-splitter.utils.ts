const MAX_PART_LENGTH = 120;
const MIN_PART_LENGTH = 8;

const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Detects and truncates repetitive loops in text.
 * Catches patterns like "kkk fui kkk tchau kkk fui kkk tchau" repeating.
 */
export function stripRepetition(text: string): string {
  // Try pattern lengths from 5 to 60 chars
  for (let len = 5; len <= 60; len++) {
    // Search for a substring that repeats 3+ times consecutively
    const regex = new RegExp(`(.{${len},${len}})\\1{2,}`, 's');
    const match = regex.exec(text);
    if (match) {
      // Truncate at the start of the repetition, keeping one occurrence
      return text.substring(0, match.index + match[1].length).trim();
    }
  }
  return text;
}

/**
 * Splits a natural text response into multiple short WhatsApp-style messages.
 * Uses sentence boundaries, line breaks, and length limits.
 * Never splits URLs across messages.
 */
export function splitIntoMessages(text: string): string[] {
  const cleaned = stripRepetition(text.replace(/\|{2,}/g, '\n').trim());

  // Split on line breaks first (model often uses these naturally)
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parts: string[] = [];

  for (const line of lines) {
    if (line.length <= MAX_PART_LENGTH) {
      parts.push(line);
      continue;
    }

    // Line too long — split by sentence boundaries (protecting URLs)
    const sentences = splitBySentences(line);
    let current = '';

    for (const sentence of sentences) {
      if (!current) {
        current = sentence;
      } else if ((current + ' ' + sentence).length <= MAX_PART_LENGTH) {
        current += ' ' + sentence;
      } else {
        parts.push(current);
        current = sentence;
      }
    }

    if (current) {
      parts.push(current);
    }
  }

  // Merge parts that are too short with the previous one
  // but never merge into a part that contains a URL if it would exceed limit
  const merged: string[] = [];
  for (const part of parts) {
    if (
      merged.length > 0 &&
      part.length < MIN_PART_LENGTH &&
      !URL_REGEX.test(part) &&
      (merged[merged.length - 1] + ' ' + part).length <= MAX_PART_LENGTH
    ) {
      merged[merged.length - 1] += ' ' + part;
    } else {
      merged.push(part);
    }
    URL_REGEX.lastIndex = 0;
  }

  // Cap at 5 parts max (WhatsApp spam protection)
  return merged.length > 0 ? merged.slice(0, 5) : [text];
}

function splitBySentences(text: string): string[] {
  // Protect URLs from being split on dots
  const placeholders: string[] = [];
  const protected_ = text.replace(URL_REGEX, (url) => {
    placeholders.push(url);
    return `\x00URL${placeholders.length - 1}\x00`;
  });
  URL_REGEX.lastIndex = 0;

  // Split on sentence-ending punctuation followed by space or end
  const raw = protected_.match(/[^.!?…]+[.!?…]*\s*/g) || [protected_];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) =>
      s.replace(/\x00URL(\d+)\x00/g, (_, i) => placeholders[Number(i)]),
    );
}
