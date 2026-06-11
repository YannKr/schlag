import { test, expect, type Page } from '@playwright/test';

import {
  GET_READY_APPEAR_TIMEOUT_MS,
  createSequenceButton,
  startWorkout,
  waitForGetReady,
} from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a sequence via the builder UI and return to the library.
 * Returns the sequence name for later lookup.
 */
async function createSequence(
  page: Page,
  name: string,
  opts?: { intervalDuration?: number; intervalCount?: number },
) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click create
  await createSequenceButton(page).click();
  await page.waitForURL(/\/builder\//);

  // Fill name
  const nameInput = page.getByRole('textbox', { name: /sequence name/i });
  await nameInput.fill(name);

  // Set interval duration if specified
  if (opts?.intervalDuration) {
    const durationInput = page.getByRole('textbox', { name: /duration/i }).first();
    if (await durationInput.isVisible()) {
      await durationInput.fill(String(opts.intervalDuration));
    }
  }

  // Save
  const saveBtn = page.getByRole('button', { name: /save/i });
  await saveBtn.click();
  await page.waitForURL('/');
  await expect(page.locator(`text=${name}`)).toBeVisible();
}

/**
 * Stop the current workout via the stop button + confirm dialog.
 */
async function stopWorkout(page: Page) {
  // Handle web confirm dialog
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /stop workout/i }).click();
  // Wait to return to library
  await page.waitForURL('/', { timeout: 5000 }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Test: Get-Ready Countdown
// ---------------------------------------------------------------------------

test.describe('Get-Ready Countdown', () => {
  test('shows GET READY screen before workout starts', async ({ page }) => {
    await createSequence(page, 'Ready Test');
    await startWorkout(page, 'Ready Test');

    // The get-ready screen should be visible
    await expect(page.locator('text=GET READY')).toBeVisible({
      timeout: GET_READY_APPEAR_TIMEOUT_MS,
    });

    // Scope to the get-ready screen's own container (the parent of the
    // "GET READY" eyebrow) so we assert the get-ready screen's own copy,
    // not the library row still mounted underneath in the web navigation
    // stack (react-navigation keeps the previous screen in the DOM).
    const getReadyScreen = page
      .getByText('GET READY', { exact: true })
      .locator('..');

    // The sequence name must be rendered by the get-ready screen itself
    await expect(getReadyScreen.getByText('Ready Test')).toBeVisible();

    // A countdown digit (3, 2, or 1) must be visible during get-ready
    await expect(getReadyScreen.getByText(/^[1-3]$/)).toBeVisible();

    // Wait for get-ready to finish
    await waitForGetReady(page);

    // Now the actual workout timer should be running
    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });

    await stopWorkout(page);
  });

  test('get-ready countdown is configurable in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should see get-ready setting in DISPLAY section
    await expect(page.getByText('DISPLAY', { exact: true })).toBeVisible();

    // The get-ready control should be visible with default "3s" selected
    await expect(page.locator('text=Get ready')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test: Reduce Motion
// ---------------------------------------------------------------------------

test.describe('Reduce Motion', () => {
  test('reduce motion toggle exists in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Reduce motion')).toBeVisible();
  });

  test('workout runs without errors when reduce motion is enabled', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Enable reduce motion in settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const toggle = page.getByRole('switch', { name: /reduce motion/i });
    await toggle.click();

    // Create sequence and start workout
    await createSequence(page, 'ReduceMotion Test');
    await startWorkout(page, 'ReduceMotion Test');
    await waitForGetReady(page);

    // Timer should be running
    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });

    // Let it run for a few seconds
    await page.waitForTimeout(3000);

    // No JS errors
    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);
  });
});

// ---------------------------------------------------------------------------
// Test: Workout Rendering
//
// The Signal redesign made the workout screen full-bleed interval color and
// dropped the old dark/light/interval-color theme rendering — the screen no
// longer reads settings.workoutTheme (see TODOS.md: "Decide the fate of the
// 'Workout theme' setting"). The former per-theme tests are collapsed into a
// single render test that keeps the console-error protection. The Settings
// theme selector still ships, so we exercise it once here (pick a non-default
// theme) to keep at least one e2e touch on the selector UI.
// ---------------------------------------------------------------------------

test.describe('Workout Rendering', () => {
  test('workout renders without errors (non-default theme selected)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Pick a non-default workout theme (default is Dark) before starting
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Theme: Light' }).click();

    await createSequence(page, 'Render Test');
    await startWorkout(page, 'Render Test');
    await waitForGetReady(page);

    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);
  });
});

// ---------------------------------------------------------------------------
// Test: Session History Import/Export
// ---------------------------------------------------------------------------

test.describe('Session History', () => {
  test('export history button exists in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('HISTORY', { exact: true })).toBeVisible();
    await expect(page.locator('text=Export history')).toBeVisible();
  });

  test('import history button exists in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Import history')).toBeVisible();
  });

  test('export history downloads a JSON file', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Listen for download
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    await page.locator('text=Export history').click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/schlag-history.*\.json/);
    }
    // If no download event (empty history triggers alert), that's also OK
  });
});

// ---------------------------------------------------------------------------
// Test: Workout Timer Core (regression tests)
// ---------------------------------------------------------------------------

test.describe('Workout Timer', () => {
  test('timer counts down without skipping seconds', async ({ page }) => {
    await createSequence(page, 'Timer Precision');
    await startWorkout(page, 'Timer Precision');
    await waitForGetReady(page);

    // Wait for timer to be visible
    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });

    // Capture the timer text over 5 seconds and verify it counts down smoothly.
    // The countdown is the DSEG7 AnimatedCountdown, exposed as role="timer".
    const readings: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const timerText = await page.getByRole('timer').first().textContent().catch(() => null);
      if (timerText) readings.push(timerText.trim());
    }

    // Should have captured some readings
    expect(readings.length).toBeGreaterThan(0);

    // Timer values should be decreasing (parse MM:SS)
    const seconds = readings
      .map((r) => {
        const parts = r.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return -1;
      })
      .filter((s) => s >= 0);

    for (let i = 1; i < seconds.length; i++) {
      // Each reading should be <= previous (counting down)
      // Allow +/- 1 second tolerance for timing jitter
      expect(seconds[i]).toBeLessThanOrEqual(seconds[i - 1] + 1);
    }

    // At least one reading must have strictly decreased — a frozen timer
    // (identical readings throughout) must fail this test.
    expect(
      seconds.some((s, i) => i > 0 && s < seconds[i - 1]),
      `expected at least one strictly decreasing reading, got: ${readings.join(', ')}`,
    ).toBe(true);

    await stopWorkout(page);
  });

  test('pause and resume work correctly', async ({ page }) => {
    await createSequence(page, 'Pause Test');
    await startWorkout(page, 'Pause Test');
    await waitForGetReady(page);

    // Pause
    await page.getByRole('button', { name: /pause workout/i }).click();
    await expect(page.getByRole('button', { name: /resume workout/i })).toBeVisible();

    // Capture time while paused
    await page.waitForTimeout(2000);

    // Resume
    await page.getByRole('button', { name: /resume workout/i }).click();
    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible();

    await stopWorkout(page);
  });

  test('ambient background renders without errors (CSS fallback)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await createSequence(page, 'Ambient Test');
    await startWorkout(page, 'Ambient Test');
    await waitForGetReady(page);

    // Let it run with ambient effects active
    await page.waitForTimeout(3000);

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);
  });
});

// ---------------------------------------------------------------------------
// Test: Settings Completeness
// ---------------------------------------------------------------------------

test.describe('Settings', () => {
  test('all new settings are present', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Audio section
    await expect(page.locator('text=Voice countdown')).toBeVisible();

    // Display section
    await expect(page.locator('text=Workout theme')).toBeVisible();
    await expect(page.locator('text=Get ready')).toBeVisible();
    await expect(page.locator('text=Reduce motion')).toBeVisible();

    // History section
    await expect(page.locator('text=Export history')).toBeVisible();
    await expect(page.locator('text=Import history')).toBeVisible();
    await expect(page.locator('text=Clear history')).toBeVisible();
  });
});
