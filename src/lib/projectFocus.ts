/**
 * How many projects can be "in focus" at once. Everything else tucks away behind one tap, so the page opens on a
 * short list of what you're actually pushing on rather than every project you have.
 */
export const PROJECT_FOCUS_MAX = 5

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const PROJECT_FOCUS_MAX_WORD = NUMBER_WORDS[PROJECT_FOCUS_MAX] ?? String(PROJECT_FOCUS_MAX)
