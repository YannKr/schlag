import { test, expect } from '@playwright/test';

import {
  EMPTY_LIBRARY_TEXT,
  createSequenceButton,
  startWorkout,
} from './helpers';

test.describe('Schlag smoke tests', () => {
  test('library loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fresh storage shows the library empty state
    await expect(page.locator(`text=${EMPTY_LIBRARY_TEXT}`)).toBeVisible();
    await expect(createSequenceButton(page)).toBeVisible();

    // No JS errors (filter out known dev-mode warnings)
    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);
  });

  test('can create a sequence and see it in the library', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click create
    await createSequenceButton(page).click();
    await page.waitForURL(/\/builder\//);

    // Fill in name
    const nameInput = page.getByRole('textbox', { name: /sequence name/i });
    await nameInput.fill('Test Workout');

    // Save
    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();

    // Back at library
    await page.waitForURL('/');
    await expect(page.locator('text=Test Workout')).toBeVisible();
  });

  test('can start a workout and see the timer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a sequence first
    await createSequenceButton(page).click();
    await page.waitForURL(/\/builder\//);

    const nameInput = page.getByRole('textbox', { name: /sequence name/i });
    await nameInput.fill('Quick Timer');

    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();
    await page.waitForURL('/');

    // Start the workout
    await startWorkout(page, 'Quick Timer');

    // Timer controls should be visible (after the 3s GET READY countdown)
    await expect(
      page.getByRole('button', { name: /pause workout/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /stop workout/i }),
    ).toBeVisible();

    // Stop the workout. On web this raises a native confirm() — accept it,
    // then verify we actually land back at the library.
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /stop workout/i }).click();
    await page.waitForURL('/');
    // The sequence row is visible again in the library
    await expect(
      page.getByRole('button', { name: /quick timer.*tap to start/i }),
    ).toBeVisible();
  });

  test('settings page renders all sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('AUDIO', { exact: true })).toBeVisible();
    await expect(page.getByText('DISPLAY', { exact: true })).toBeVisible();
    await expect(page.getByText('SEQUENCES', { exact: true })).toBeVisible();

    // No ACCOUNT section
    await expect(page.getByText('ACCOUNT', { exact: true })).not.toBeVisible();
  });
});
