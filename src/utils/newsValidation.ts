export const NEWS_EXCERPT_LIMIT = 1000;
export const NEWS_TAG_LIMIT = 50;

// Python/Pydantic count Unicode code points, including astral characters as one.
export function newsLengthError(value: string, limit: number, label: string): string | null {
  const length = Array.from(value.trim()).length;
  return length > limit ? `${label}: ${length} / ${limit}` : null;
}
