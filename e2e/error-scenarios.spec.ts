import { test, expect } from '@playwright/test';

test.describe('Error Scenarios and Fallback Mechanisms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle network connection errors gracefully', async ({ page }) => {
    // Select a story first
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Simulate network offline
    await page.context().setOffline(true);
    
    // Try to send a message
    await page.locator('[data-testid="text-input"]').fill('Test message during offline');
    await page.locator('[data-testid="send-button"]').click();
    
    // Should show connection error
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-toast"]')).toContainText(/connection|network|offline/i);
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Should show reconnection success
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({ timeout: 15000 });
  });

  test('should display error boundary when component crashes', async ({ page }) => {
    // Inject a script that will cause a component to crash
    await page.addInitScript(() => {
      // Override console.error to catch React error boundary
      const originalError = console.error;
      window.testErrors = [];
      console.error = (...args) => {
        window.testErrors.push(args.join(' '));
        originalError.apply(console, args);
      };
    });
    
    // Navigate and trigger potential error
    await page.goto('/?trigger-error=true');
    
    // Check if error boundary is displayed
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    if (await errorBoundary.isVisible()) {
      await expect(errorBoundary).toContainText(/something went wrong/i);
      
      // Check if retry button works
      await page.locator('[data-testid="error-retry-button"]').click();
      await expect(page.locator('[data-testid="story-selector"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle LLM service errors with fallback', async ({ page }) => {
    // Mock LLM service to return error
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'LLM service unavailable' })
      });
    });
    
    // Select story and send message
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    await page.locator('[data-testid="text-input"]').fill('Test message');
    await page.locator('[data-testid="send-button"]').click();
    
    // Should show LLM error message
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-toast"]')).toContainText(/AI service|LLM|unavailable/i);
    
    // Should show fallback message in chat
    await expect(page.locator('[data-testid="service-fallback"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle TTS service errors gracefully', async ({ page }) => {
    // Enable TTS first
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="settings-close"]').click();
    
    // Mock TTS service to fail
    await page.route('**/api/tts', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'TTS service unavailable' })
      });
    });
    
    // Select story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Send message to trigger TTS
    await page.locator('[data-testid="text-input"]').fill('Test TTS error');
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for AI response
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 30000 });
    
    // Should show TTS error but still display text
    await expect(page.locator('[data-testid="tts-error-indicator"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="message"][data-type="ai"]:last-child')).toBeVisible();
  });

  test('should handle ASR service errors with fallback to text input', async ({ page }) => {
    // Select story first
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Mock ASR to fail
    await page.addInitScript(() => {
      // Override webkitSpeechRecognition to simulate failure
      if (window.webkitSpeechRecognition) {
        const OriginalSpeechRecognition = window.webkitSpeechRecognition;
        window.webkitSpeechRecognition = function() {
          const recognition = new OriginalSpeechRecognition();
          const originalStart = recognition.start;
          recognition.start = function() {
            setTimeout(() => {
              recognition.onerror({ error: 'network' });
            }, 100);
          };
          return recognition;
        };
      }
    });
    
    // Try to use voice input
    await page.locator('[data-testid="voice-input-button"]').click();
    
    // Should show ASR error and fallback to text input
    await expect(page.locator('[data-testid="asr-error-toast"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-input"]')).toBeFocused();
  });

  test('should handle story loading errors', async ({ page }) => {
    // Mock stories API to fail
    await page.route('**/api/stories', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load stories' })
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should show story loading error
    await expect(page.locator('[data-testid="story-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="story-error"]')).toContainText(/failed to load|stories/i);
    
    // Should have retry button
    await expect(page.locator('[data-testid="story-retry-button"]')).toBeVisible();
  });

  test('should handle WebSocket connection failures', async ({ page }) => {
    // Select story first
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      // Force close WebSocket connection
      if (window.socket) {
        window.socket.disconnect();
      }
    });
    
    // Try to send a message
    await page.locator('[data-testid="text-input"]').fill('Test during disconnection');
    await page.locator('[data-testid="send-button"]').click();
    
    // Should show connection status indicator
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(/disconnected|reconnecting/i);
    
    // Should queue message and send when reconnected
    await expect(page.locator('[data-testid="message-queued"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle browser compatibility issues', async ({ page, browserName }) => {
    // Test Web Speech API availability
    const speechSupport = await page.evaluate(() => {
      return {
        speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
        speechSynthesis: !!window.speechSynthesis
      };
    });
    
    if (!speechSupport.speechRecognition) {
      // Should show ASR not supported message
      await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
      await page.locator('[data-testid="story-card"]').first().click();
      await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
      
      await expect(page.locator('[data-testid="asr-not-supported"]')).toBeVisible();
      // Voice input button should be disabled or hidden
      await expect(page.locator('[data-testid="voice-input-button"]')).toBeDisabled();
    }
    
    if (!speechSupport.speechSynthesis) {
      // Should show TTS not supported message in settings
      await page.locator('[data-testid="settings-button"]').click();
      await expect(page.locator('[data-testid="tts-not-supported"]')).toBeVisible();
    }
  });

  test('should handle audio permission denied', async ({ page }) => {
    // Mock getUserMedia to simulate permission denied
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => {
        return Promise.reject(new Error('Permission denied'));
      };
    });
    
    // Select story and try voice input
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    await page.locator('[data-testid="voice-input-button"]').click();
    
    // Should show permission error
    await expect(page.locator('[data-testid="microphone-permission-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="microphone-permission-error"]')).toContainText(/microphone|permission/i);
  });
});