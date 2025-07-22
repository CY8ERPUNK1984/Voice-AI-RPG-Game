import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load application within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="story-selector"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Application should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`Application loaded in ${loadTime}ms`);
  });

  test('should handle multiple rapid interactions', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Send multiple messages rapidly
    const messages = [
      'Hello',
      'What is this place?',
      'Tell me more',
      'I want to explore',
      'Show me around'
    ];

    const startTime = Date.now();
    
    for (const message of messages) {
      await page.locator('[data-testid="text-input"]').fill(message);
      await page.locator('[data-testid="send-button"]').click();
      
      // Don't wait for AI response, just send next message
      await page.waitForTimeout(100);
    }

    // Wait for all messages to be sent
    await expect(page.locator('[data-testid="message"][data-type="user"]'))
      .toHaveCount(messages.length, { timeout: 10000 });

    const sendTime = Date.now() - startTime;
    console.log(`Sent ${messages.length} messages in ${sendTime}ms`);

    // All messages should be sent within reasonable time
    expect(sendTime).toBeLessThan(3000);
  });

  test('should handle memory usage during long conversations', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });

    // Send 20 messages to simulate long conversation
    for (let i = 1; i <= 20; i++) {
      await page.locator('[data-testid="text-input"]').fill(`Message ${i}: Tell me something interesting`);
      await page.locator('[data-testid="send-button"]').click();
      
      // Wait for AI response before sending next
      await page.waitForSelector(`[data-testid="message"][data-type="ai"]:nth-child(${i * 2 + 1})`, { timeout: 30000 });
      
      // Check memory every 5 messages
      if (i % 5 === 0) {
        const currentMemory = await page.evaluate(() => {
          return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });
        
        if (initialMemory > 0 && currentMemory > 0) {
          const memoryIncrease = currentMemory - initialMemory;
          console.log(`Memory usage after ${i} messages: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
          
          // Memory increase should be reasonable (less than 50MB for 20 messages)
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }
      }
    }

    // Verify all messages are present
    await expect(page.locator('[data-testid="message"][data-type="user"]')).toHaveCount(20);
    await expect(page.locator('[data-testid="message"][data-type="ai"]')).toHaveCount(21); // 20 responses + 1 initial
  });

  test('should handle audio processing performance', async ({ page }) => {
    // Enable TTS
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="settings-close"]').click();

    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Send message and measure TTS processing time
    const startTime = Date.now();
    
    await page.locator('[data-testid="text-input"]').fill('Tell me a short story');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for AI response
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 30000 });

    // Wait for audio player to appear
    await page.waitForSelector('[data-testid="audio-player"]:last-child', { timeout: 15000 });

    const totalTime = Date.now() - startTime;
    console.log(`Total time for AI response + TTS: ${totalTime}ms`);

    // Total processing should complete within reasonable time (45 seconds)
    expect(totalTime).toBeLessThan(45000);
  });

  test('should handle WebSocket connection performance', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Measure WebSocket message round-trip time
    const messageTimes: number[] = [];

    for (let i = 1; i <= 5; i++) {
      const startTime = Date.now();
      
      await page.locator('[data-testid="text-input"]').fill(`Quick message ${i}`);
      await page.locator('[data-testid="send-button"]').click();

      // Wait for user message to appear (WebSocket round-trip)
      await page.waitForSelector(`[data-testid="message"][data-type="user"]:nth-child(${i * 2})`, { timeout: 5000 });
      
      const roundTripTime = Date.now() - startTime;
      messageTimes.push(roundTripTime);
      
      console.log(`Message ${i} round-trip time: ${roundTripTime}ms`);
    }

    // Average round-trip time should be reasonable (less than 1 second)
    const averageTime = messageTimes.reduce((a, b) => a + b, 0) / messageTimes.length;
    expect(averageTime).toBeLessThan(1000);
    
    console.log(`Average WebSocket round-trip time: ${averageTime.toFixed(2)}ms`);
  });

  test('should handle concurrent user interactions', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Simulate concurrent interactions
    const interactions = [
      () => page.locator('[data-testid="settings-button"]').click(),
      () => page.locator('[data-testid="text-input"]').fill('Test message'),
      () => page.locator('[data-testid="voice-input-button"]').click(),
      () => page.locator('[data-testid="settings-close"]').click(),
    ];

    // Execute interactions concurrently
    const startTime = Date.now();
    await Promise.all(interactions.map(interaction => interaction().catch(() => {})));
    const concurrentTime = Date.now() - startTime;

    console.log(`Concurrent interactions completed in ${concurrentTime}ms`);

    // Should handle concurrent interactions without crashing
    expect(concurrentTime).toBeLessThan(5000);
    
    // Verify application is still responsive
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
  });

  test('should handle large story content efficiently', async ({ page }) => {
    // Mock a story with very large content
    await page.route('**/api/stories', async (route) => {
      const largeStory = {
        id: 'large-story',
        title: 'Epic Adventure',
        description: 'A very long story description that contains a lot of text to test performance with large content. '.repeat(100),
        genre: 'fantasy',
        initialPrompt: 'You are in a vast fantasy world with endless possibilities. '.repeat(50)
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([largeStory])
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();
    
    // Select the large story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface with large content
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 15000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`Large story loaded in ${loadTime}ms`);

    // Should handle large content efficiently (within 10 seconds)
    expect(loadTime).toBeLessThan(10000);

    // Verify the story content is displayed
    await expect(page.locator('[data-testid="message"][data-type="ai"]').first()).toBeVisible();
  });
});