import { test, expect } from '@playwright/test';

test.describe('Voice AI RPG Game - Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });

  test('should display story selector on initial load', async ({ page }) => {
    // Check that story selector is visible
    await expect(page.locator('[data-testid="story-selector"]')).toBeVisible();
    
    // Check that stories are loaded
    await expect(page.locator('[data-testid="story-card"]')).toHaveCount(3, { timeout: 10000 });
    
    // Verify story titles are displayed
    await expect(page.locator('[data-testid="story-title"]').first()).toBeVisible();
  });

  test('should select a story and start game session', async ({ page }) => {
    // Wait for stories to load
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    
    // Select the first story
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface to appear
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 10000 });
    
    // Check that initial AI message is displayed
    await expect(page.locator('[data-testid="message"][data-type="ai"]')).toBeVisible({ timeout: 15000 });
    
    // Verify voice input button is available
    await expect(page.locator('[data-testid="voice-input-button"]')).toBeVisible();
  });

  test('should handle text input and receive AI response', async ({ page }) => {
    // Select a story first
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Type a message in the text input
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Hello, I want to explore the castle.');
    
    // Send the message
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify user message appears
    await expect(page.locator('[data-testid="message"][data-type="user"]').last()).toContainText('Hello, I want to explore the castle.');
    
    // Wait for AI response
    await expect(page.locator('[data-testid="message"][data-type="ai"]').last()).toBeVisible({ timeout: 30000 });
    
    // Verify AI response contains text
    const aiResponse = page.locator('[data-testid="message"][data-type="ai"]').last();
    await expect(aiResponse).not.toBeEmpty();
  });

  test('should show loading indicators during AI processing', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Send a message
    await page.locator('[data-testid="text-input"]').fill('Tell me about this place.');
    await page.locator('[data-testid="send-button"]').click();
    
    // Check for loading indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
    
    // Wait for response and verify loading indicator disappears
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 30000 });
    await expect(page.locator('[data-testid="typing-indicator"]')).not.toBeVisible();
  });

  test('should open and interact with settings panel', async ({ page }) => {
    // Open settings panel
    await page.locator('[data-testid="settings-button"]').click();
    
    // Verify settings panel is visible
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    
    // Test TTS toggle
    const ttsToggle = page.locator('[data-testid="tts-toggle"]');
    await expect(ttsToggle).toBeVisible();
    await ttsToggle.click();
    
    // Test volume slider
    const volumeSlider = page.locator('[data-testid="volume-slider"]');
    await expect(volumeSlider).toBeVisible();
    await volumeSlider.fill('0.7');
    
    // Close settings panel
    await page.locator('[data-testid="settings-close"]').click();
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
  });

  test('should handle voice input button interaction', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Click voice input button
    const voiceButton = page.locator('[data-testid="voice-input-button"]');
    await voiceButton.click();
    
    // Check if recording state is indicated (button should change appearance)
    await expect(voiceButton).toHaveAttribute('data-recording', 'true');
    
    // Click again to stop recording
    await voiceButton.click();
    await expect(voiceButton).toHaveAttribute('data-recording', 'false');
  });

  test('should display audio player for AI responses when TTS is enabled', async ({ page }) => {
    // Enable TTS in settings first
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="settings-close"]').click();
    
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for initial AI message
    await page.waitForSelector('[data-testid="message"][data-type="ai"]', { timeout: 15000 });
    
    // Check if audio player is present for AI messages
    await expect(page.locator('[data-testid="audio-player"]')).toBeVisible();
  });

  test('should handle chat scroll and message history', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    
    // Wait for chat interface
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    
    // Send multiple messages to test scrolling
    for (let i = 1; i <= 3; i++) {
      await page.locator('[data-testid="text-input"]').fill(`Message ${i}`);
      await page.locator('[data-testid="send-button"]').click();
      
      // Wait for AI response
      await page.waitForSelector(`[data-testid="message"][data-type="ai"]:nth-child(${i * 2 + 1})`, { timeout: 30000 });
    }
    
    // Verify all messages are present
    await expect(page.locator('[data-testid="message"][data-type="user"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="message"][data-type="ai"]')).toHaveCount(4); // 3 responses + 1 initial
    
    // Check that chat scrolls to bottom
    const chatContainer = page.locator('[data-testid="chat-messages"]');
    const isScrolledToBottom = await chatContainer.evaluate((el) => {
      return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 1;
    });
    expect(isScrolledToBottom).toBe(true);
  });
});