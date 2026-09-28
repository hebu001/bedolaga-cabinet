import { describe, expect, it } from 'vitest';
import { NEWS_EXCERPT_LIMIT, NEWS_TAG_LIMIT, newsLengthError } from './newsValidation';
import { getApiErrorMessage } from './api-error';

describe('news bot contract validation', () => {
  it.each([
    [NEWS_EXCERPT_LIMIT, 'Excerpt'],
    [NEWS_TAG_LIMIT, 'Tag'],
  ])(
    'accepts the exact %s boundary but rejects longer existing or entered values',
    (limit, label) => {
      expect(newsLengthError(`  ${'a'.repeat(limit)}  `, limit, label)).toBeNull();
      expect(newsLengthError('a'.repeat(limit + 1), limit, label)).toBe(
        `${label}: ${limit + 1} / ${limit}`,
      );
    },
  );
  it('counts Unicode consistently with Pydantic rather than UTF-16 units', () => {
    expect(newsLengthError('😀'.repeat(50), NEWS_TAG_LIMIT, 'Tag')).toBeNull();
    expect(newsLengthError('😀'.repeat(51), NEWS_TAG_LIMIT, 'Tag')).toBe('Tag: 51 / 50');
  });
  it('explains server-side 422 by field instead of the generic HTTP error', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 422',
      response: {
        status: 422,
        data: {
          detail: [{ loc: ['body', 'excerpt'], msg: 'String should have at most 1000 characters' }],
        },
      },
    };
    expect(getApiErrorMessage(error, 'Save failed')).toBe(
      'excerpt: String should have at most 1000 characters',
    );
  });
});
