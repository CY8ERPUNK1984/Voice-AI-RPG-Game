import { test as setup, expect } from '@playwright/test';

setup('global setup', async ({ page }) => {
  // Navigate to the application to ensure it's running
  await page.goto('/');
  
  // Wait for the application to load completely
  await page.waitForLoadState('networkidle');
  
  // Verify the application is accessible
  await expect(page.locator('body')).toBeVisible();
  
  // Check if stories are loaded (basic health check)
  await expect(page.locator('[data-testid="story-selector"], [data-testid="story-error"]')).toBeVisible({ timeout: 15000 });
  
  console.log('✅ Application is running and accessible');
});