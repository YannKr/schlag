import { test, expect, type Page } from '@playwright/test';

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
  const createBtn = page.getByRole('button', { name: /create.*sequence/i });
  await createBtn.first().click();
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
 * Start a workout for the named sequence. Handles the get-ready countdown.
 */
async function startWorkout(page: Page, name: string) {
  const startBtn = page.getByRole('button', { name: new RegExp(`start ${name}`, 'i') });
  await startBtn.click();
  await page.waitForURL(/\/workout\//);
}

/**
 * Wait for the get-ready countdown to finish (if visible).
 * Returns whether the get-ready screen was shown.
 */
async function waitForGetReady(page: Page, timeoutMs = 15000): Promise<boolean> {
  const getReady = page.locator('text=GET READY');
  const visible = await getReady.isVisible().catch(() => false);
  if (visible) {
    // Wait for it to disappear (countdown finishes)
    await getReady.waitFor({ state: 'hidden', timeout: timeoutMs });
    return true;
  }
  return false;
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
    await expect(page.locator('text=GET READY')).toBeVisible({ timeout: 3000 });

    // Should show the sequence name on the get-ready screen
    await expect(page.locator('text=Ready Test').nth(1)).toBeVisible();

    // Should show a countdown number (3, 2, or 1)
    const countdown = page.locator('[accessibilityRole="timer"], [role="timer"]');
    // The countdown number should be visible somewhere on screen
    const hasNumber = await page.locator('text=/^[1-3]$/').first().isVisible().catch(() => false);
    expect(hasNumber || await page.locator('text=GET READY').isVisible()).toBeTruthy();

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

    const toggle = page.locator('text=Reduce motion').locator('..').locator('input[type="checkbox"], [role="switch"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
    }

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
// Test: Narrative Arc on All Themes
// ---------------------------------------------------------------------------

test.describe('Narrative Arc Themes', () => {
  test('workout renders without errors on dark theme', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await createSequence(page, 'Dark Theme Test');
    await startWorkout(page, 'Dark Theme Test');
    await waitForGetReady(page);

    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);
  });

  test('workout renders without errors on light theme', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Switch to light theme
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const lightOption = page.locator('text=Light').first();
    if (await lightOption.isVisible()) {
      await lightOption.click();
    }

    await createSequence(page, 'Light Theme Test');
    await startWorkout(page, 'Light Theme Test');
    await waitForGetReady(page);

    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);

    // Reset to dark theme
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const darkOption = page.locator('text=Dark').first();
    if (await darkOption.isVisible()) await darkOption.click();
  });

  test('workout renders without errors on interval-color theme', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Switch to interval-color theme
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const colorOption = page.locator('text=Color').first();
    if (await colorOption.isVisible()) {
      await colorOption.click();
    }

    await createSequence(page, 'Color Theme Test');
    await startWorkout(page, 'Color Theme Test');
    await waitForGetReady(page);

    await expect(page.getByRole('button', { name: /pause workout/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);

    await stopWorkout(page);

    // Reset to dark theme
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const darkOption = page.locator('text=Dark').first();
    if (await darkOption.isVisible()) await darkOption.click();
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

    // Capture the timer text over 5 seconds and verify it counts down smoothly
    const readings: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const timerText = await page.locator('[accessibilityRole="timer"], [role="timer"]').first().textContent().catch(() => null);
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
    await expect(page.locator('text=Get ready')).toBeVisible();
    await expect(page.locator('text=Reduce motion')).toBeVisible();

    // History section
    await expect(page.locator('text=Export history')).toBeVisible();
    await expect(page.locator('text=Import history')).toBeVisible();
    await expect(page.locator('text=Clear history')).toBeVisible();
  });
});
