import { type Locator, type Page } from '@playwright/test';

/** Empty-state title shown in the library when no sequences exist. */
export const EMPTY_LIBRARY_TEXT = 'No sequences yet';

/** How long the GET READY screen has to appear after a workout starts. */
export const GET_READY_APPEAR_TIMEOUT_MS = 3000;

/** Escape regex metacharacters so a literal string can be embedded in a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The library's create-sequence button.
 *
 * The empty library renders only the empty-state "Create your first sequence"
 * CTA; a populated library renders only the header "Create new sequence"
 * action — the two never coexist, so this locator resolves to exactly one
 * element and fails loudly (strict mode) if an unexpected second match appears.
 */
export function createSequenceButton(page: Page): Locator {
  return page.getByRole('button', { name: /create (your first|new) sequence/i });
}

/**
 * Start a workout for the named sequence by clicking its library row.
 * Does NOT wait out the get-ready countdown; call waitForGetReady after.
 */
export async function startWorkout(page: Page, name: string) {
  // Sequence row is a button: "<name>. <duration>. Tap to start…"
  const startBtn = page.getByRole('button', {
    name: new RegExp(`${escapeRegExp(name)}.*tap to start`, 'i'),
  });
  await startBtn.click();
  await page.waitForURL(/\/workout\//);
}

/**
 * Wait for the get-ready countdown to finish (if visible).
 * Returns whether the get-ready screen was shown.
 */
export async function waitForGetReady(
  page: Page,
  timeoutMs = 15000,
): Promise<boolean> {
  const getReady = page.locator('text=GET READY');
  const appeared = await getReady
    .waitFor({ state: 'visible', timeout: GET_READY_APPEAR_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    // Wait for it to disappear (countdown finishes)
    await getReady.waitFor({ state: 'hidden', timeout: timeoutMs });
  }
  return appeared;
}
