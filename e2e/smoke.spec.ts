import { test, expect } from '@playwright/test';

test.describe('Schlag smoke tests', () => {
  test('library loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should have the app title
    await expect(page.locator('text=Schlag')).toBeVisible();

    // No JS errors (filter out known dev-mode warnings)
    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);
  });

  test('can create a sequence and see it in the library', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click create
    const createBtn = page.getByRole('button', { name: /create.*sequence/i });
    await createBtn.first().click();
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
    const createBtn = page.getByRole('button', { name: /create.*sequence/i });
    await createBtn.first().click();
    await page.waitForURL(/\/builder\//);

    const nameInput = page.getByRole('textbox', { name: /sequence name/i });
    await nameInput.fill('Quick Timer');

    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();
    await page.waitForURL('/');

    // Start the workout
    const startBtn = page.getByRole('button', { name: /start quick timer/i });
    await startBtn.click();
    await page.waitForURL(/\/workout\//);

    // Timer controls should be visible
    await expect(
      page.getByRole('button', { name: /pause workout/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /stop workout/i }),
    ).toBeVisible();

    // Stop the workout
    await page.getByRole('button', { name: /stop workout/i }).click();
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
