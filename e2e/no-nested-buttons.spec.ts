import { test, expect } from '@playwright/test';

test.describe('HTML validity: no nested buttons', () => {
  test('library page has no <button> inside <button>', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nestedButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];
      buttons.forEach((btn) => {
        const nested = btn.querySelectorAll('button');
        if (nested.length > 0) {
          const label =
            btn.getAttribute('aria-label') || btn.textContent?.slice(0, 40) || 'unknown';
          violations.push(`"${label}" contains ${nested.length} nested button(s)`);
        }
      });
      return violations;
    });

    expect(nestedButtons, 'Found nested <button> elements').toEqual([]);
  });

  test('builder page has no <button> inside <button>', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a new sequence to get to the builder
    const fab = page.getByRole('button', { name: 'Create new sequence' });
    await fab.click();
    await page.waitForURL(/\/builder\//);
    await page.waitForLoadState('networkidle');

    const nestedButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];
      buttons.forEach((btn) => {
        const nested = btn.querySelectorAll('button');
        if (nested.length > 0) {
          const label =
            btn.getAttribute('aria-label') || btn.textContent?.slice(0, 40) || 'unknown';
          violations.push(`"${label}" contains ${nested.length} nested button(s)`);
        }
      });
      return violations;
    });

    expect(nestedButtons, 'Found nested <button> elements').toEqual([]);
  });

  test('settings page has no <button> inside <button>', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const nestedButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];
      buttons.forEach((btn) => {
        const nested = btn.querySelectorAll('button');
        if (nested.length > 0) {
          const label =
            btn.getAttribute('aria-label') || btn.textContent?.slice(0, 40) || 'unknown';
          violations.push(`"${label}" contains ${nested.length} nested button(s)`);
        }
      });
      return violations;
    });

    expect(nestedButtons, 'Found nested <button> elements').toEqual([]);
  });

  test('template gallery has no <button> inside <button>', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    const nestedButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];
      buttons.forEach((btn) => {
        const nested = btn.querySelectorAll('button');
        if (nested.length > 0) {
          const label =
            btn.getAttribute('aria-label') || btn.textContent?.slice(0, 40) || 'unknown';
          violations.push(`"${label}" contains ${nested.length} nested button(s)`);
        }
      });
      return violations;
    });

    expect(nestedButtons, 'Found nested <button> elements').toEqual([]);
  });
});
