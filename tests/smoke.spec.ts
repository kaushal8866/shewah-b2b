import { test, expect } from '@playwright/test';

test.describe('Shewah B2B — Smoke Tests', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access the dashboard
    await page.goto('/dashboard');
    
    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText(/Login/i);
  });

  test('landing page is publicly accessible', async ({ page }) => {
    await page.goto('/');
    
    // Should see Shewah branding or specific landing content
    // Adjust selector/text based on the actual landing page content
    await expect(page).toHaveTitle(/Shewah/i);
  });

  test('shared design links are publicly accessible', async ({ page }) => {
    // This is a prefix route that should be public
    await page.goto('/shared-design/test-id');
    
    // Should NOT be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
