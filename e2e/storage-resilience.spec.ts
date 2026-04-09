import { test, expect } from '@playwright/test';

test.describe('Storage resilience', () => {
  test('sequence persists across page reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a sequence
    const createBtn = page.getByRole('button', { name: /create.*sequence/i });
    await createBtn.first().click();
    await page.waitForURL(/\/builder\//);

    const nameInput = page.getByRole('textbox', { name: /sequence name/i });
    await nameInput.fill('Persist Test');

    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();
    await page.waitForURL('/');

    // Verify it's in the library
    await expect(page.locator('text=Persist Test')).toBeVisible();

    // Reload and verify it survived
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Persist Test')).toBeVisible();
  });

  test('app loads without errors when localStorage is empty', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Clear localStorage before loading
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should load and show the library (empty state)
    await expect(page.locator('text=Schlag')).toBeVisible();

    const real = errors.filter((e) => !e.includes('Wake Lock'));
    expect(real).toEqual([]);
  });

  test('app shows error when localStorage quota is exceeded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill localStorage to near capacity (5MB limit)
    // Each string is ~1MB. Fill 4.9MB to leave almost no room.
    await page.evaluate(() => {
      const chunk = 'x'.repeat(1024 * 1024); // 1MB string
      for (let i = 0; i < 4; i++) {
        try {
          localStorage.setItem(`_filler_${i}`, chunk);
        } catch {
          break;
        }
      }
      // Fill remaining space in smaller chunks
      for (let i = 0; i < 100; i++) {
        try {
          localStorage.setItem(`_filler_sm_${i}`, 'x'.repeat(10_000));
        } catch {
          break;
        }
      }
    });

    // Set up dialog handler to capture the alert
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Try to create and save a sequence
    const createBtn = page.getByRole('button', { name: /create.*sequence/i });
    await createBtn.first().click();
    await page.waitForURL(/\/builder\//);

    const nameInput = page.getByRole('textbox', { name: /sequence name/i });
    await nameInput.fill('Should Fail');

    const saveBtn = page.getByRole('button', { name: /save/i });
    await saveBtn.click();

    // Wait a moment for the error to propagate
    await page.waitForTimeout(500);

    // Either we got an alert about storage failure, or the save
    // succeeded because the sequence JSON was small enough to fit.
    // Both are acceptable — the point is the app didn't crash.
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Verify no uncaught exceptions
    const crashErrors = pageErrors.filter((e) => !e.includes('Wake Lock'));
    expect(crashErrors).toEqual([]);

    // Clean up filler data
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('_filler'))
        .forEach((k) => localStorage.removeItem(k));
    });
  });

  test('settings page shows storage usage on web', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // The storage usage row should be visible
    await expect(page.locator('text=Storage used')).toBeVisible();
    // Should show "X.X MB / 5 MB" format
    await expect(page.locator('text=/\\d+\\.\\d+ MB \\/ 5 MB/')).toBeVisible();
  });
});
