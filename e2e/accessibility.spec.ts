import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Check main application structure
    await expect(page.locator('[role="main"], main')).toBeVisible();
    
    // Check story selector accessibility
    await expect(page.locator('[data-testid="story-selector"]')).toHaveAttribute('role', 'region');
    await expect(page.locator('[data-testid="story-selector"]')).toHaveAttribute('aria-label', /story selection|choose story/i);

    // Check story cards
    const storyCards = page.locator('[data-testid="story-card"]');
    await expect(storyCards.first()).toHaveAttribute('role', 'button');
    await expect(storyCards.first()).toHaveAttribute('tabindex', '0');

    // Select a story to test chat interface
    await storyCards.first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Check chat interface accessibility
    await expect(page.locator('[data-testid="chat-interface"]')).toHaveAttribute('role', 'region');
    await expect(page.locator('[data-testid="chat-interface"]')).toHaveAttribute('aria-label', /chat|conversation/i);

    // Check message list
    await expect(page.locator('[data-testid="chat-messages"]')).toHaveAttribute('role', 'log');
    await expect(page.locator('[data-testid="chat-messages"]')).toHaveAttribute('aria-live', 'polite');

    // Check input controls
    await expect(page.locator('[data-testid="text-input"]')).toHaveAttribute('aria-label', /message input|type message/i);
    await expect(page.locator('[data-testid="send-button"]')).toHaveAttribute('aria-label', /send message/i);
    await expect(page.locator('[data-testid="voice-input-button"]')).toHaveAttribute('aria-label', /voice input|record voice/i);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test story selection with keyboard
    await page.keyboard.press('Tab');
    
    // First story card should be focused
    await expect(page.locator('[data-testid="story-card"]:first-child')).toBeFocused();
    
    // Navigate between story cards
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid="story-card"]:nth-child(2)')).toBeFocused();
    
    // Select story with Enter
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Test chat interface keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="text-input"]')).toBeFocused();

    // Type a message
    await page.keyboard.type('Hello, this is a keyboard test');
    
    // Navigate to send button
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="send-button"]')).toBeFocused();
    
    // Send message with Enter
    await page.keyboard.press('Enter');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="message"][data-type="user"]').last())
      .toContainText('Hello, this is a keyboard test');

    // Test settings panel keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Navigate to settings button
    await expect(page.locator('[data-testid="settings-button"]')).toBeFocused();
    
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

    // Navigate within settings
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="tts-toggle"]')).toBeFocused();
    
    // Close settings with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
  });

  test('should support screen reader announcements', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Check for screen reader announcements
    const announcements = page.locator('[aria-live="polite"], [aria-live="assertive"]');
    await expect(announcements).toHaveCount(1, { timeout: 5000 });

    // Send a message and check for announcement
    await page.locator('[data-testid="text-input"]').fill('Test screen reader announcement');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for AI response
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 30000 });

    // Check that new messages are announced
    const chatMessages = page.locator('[data-testid="chat-messages"]');
    await expect(chatMessages).toHaveAttribute('aria-live', 'polite');
  });

  test('should have proper color contrast', async ({ page }) => {
    // This is a basic check - in a real scenario, you'd use axe-core or similar
    const backgroundColor = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    const textColor = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Basic check that colors are defined
    expect(backgroundColor).toBeTruthy();
    expect(textColor).toBeTruthy();
    expect(backgroundColor).not.toBe(textColor);

    // Check button contrast
    const button = page.locator('[data-testid="send-button"]');
    const buttonBg = await button.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const buttonText = await button.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    expect(buttonBg).toBeTruthy();
    expect(buttonText).toBeTruthy();
    expect(buttonBg).not.toBe(buttonText);
  });

  test('should support high contrast mode', async ({ page }) => {
    // Simulate high contrast mode
    await page.addInitScript(() => {
      // Add high contrast media query simulation
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => {
          if (query.includes('prefers-contrast: high')) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => {},
            };
          }
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
          };
        },
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify application still works in high contrast mode
    await expect(page.locator('[data-testid="story-selector"]')).toBeVisible();
    
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Verify chat functionality works
    await page.locator('[data-testid="text-input"]').fill('High contrast test');
    await page.locator('[data-testid="send-button"]').click();
    
    await expect(page.locator('[data-testid="message"][data-type="user"]').last())
      .toContainText('High contrast test');
  });

  test('should support reduced motion preferences', async ({ page }) => {
    // Simulate reduced motion preference
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => {
          if (query.includes('prefers-reduced-motion: reduce')) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => {},
            };
          }
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
          };
        },
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify animations are reduced/disabled
    const storyCard = page.locator('[data-testid="story-card"]').first();
    
    // Check that hover effects are minimal
    await storyCard.hover();
    
    // The application should still be fully functional
    await storyCard.click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Test that loading indicators still work but with reduced motion
    await page.locator('[data-testid="text-input"]').fill('Reduced motion test');
    await page.locator('[data-testid="send-button"]').click();

    // Loading indicator should appear but without excessive animation
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
  });

  test('should have proper focus management', async ({ page }) => {
    // Test focus trap in modals
    await page.locator('[data-testid="settings-button"]').click();
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

    // Focus should be trapped within the settings panel
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(['tts-toggle', 'volume-slider', 'speed-slider', 'settings-close']).toContain(focusedElement);

    // Close settings and verify focus returns
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="settings-button"]')).toBeFocused();
  });

  test('should provide alternative text for images and icons', async ({ page }) => {
    // Check for alt text on any images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      
      // Images should have either alt text or aria-label
      expect(alt || ariaLabel).toBeTruthy();
    }

    // Check for aria-labels on icon buttons
    const iconButtons = page.locator('button[aria-label]');
    const buttonCount = await iconButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = iconButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(0);
    }
  });

  test('should handle voice input accessibility', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Voice input button should have proper accessibility attributes
    const voiceButton = page.locator('[data-testid="voice-input-button"]');
    await expect(voiceButton).toHaveAttribute('aria-label', /voice input|record|microphone/i);
    await expect(voiceButton).toHaveAttribute('role', 'button');

    // Click voice input
    await voiceButton.click();

    // Should announce recording state
    await expect(voiceButton).toHaveAttribute('aria-pressed', 'true');
    await expect(voiceButton).toHaveAttribute('aria-label', /stop recording|recording/i);

    // Stop recording
    await voiceButton.click();
    await expect(voiceButton).toHaveAttribute('aria-pressed', 'false');
  });
});