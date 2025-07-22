import { test, expect } from '@playwright/test';

test.describe('Voice Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);
  });

  test('should handle voice input with Web Speech API', async ({ page, browserName }) => {
    // Skip on browsers that don't support Web Speech API
    const speechSupport = await page.evaluate(() => {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    });
    
    if (!speechSupport) {
      test.skip(`Web Speech API not supported in ${browserName}`);
    }

    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Mock speech recognition to simulate voice input
    await page.addInitScript(() => {
      if (window.webkitSpeechRecognition) {
        const OriginalSpeechRecognition = window.webkitSpeechRecognition;
        window.webkitSpeechRecognition = function() {
          const recognition = new OriginalSpeechRecognition();
          const originalStart = recognition.start;
          
          recognition.start = function() {
            // Simulate successful speech recognition
            setTimeout(() => {
              const event = {
                results: [{
                  0: { transcript: 'I want to explore the mysterious forest' },
                  isFinal: true
                }],
                resultIndex: 0
              };
              if (recognition.onresult) {
                recognition.onresult(event);
              }
            }, 1000);
          };
          
          return recognition;
        };
      }
    });

    // Click voice input button
    const voiceButton = page.locator('[data-testid="voice-input-button"]');
    await voiceButton.click();

    // Verify recording state
    await expect(voiceButton).toHaveAttribute('data-recording', 'true');

    // Wait for speech recognition to complete
    await page.waitForTimeout(2000);

    // Verify the transcribed text appears
    await expect(page.locator('[data-testid="message"][data-type="user"]').last())
      .toContainText('I want to explore the mysterious forest', { timeout: 10000 });

    // Verify AI response
    await expect(page.locator('[data-testid="message"][data-type="ai"]').last())
      .toBeVisible({ timeout: 30000 });
  });

  test('should handle TTS playback', async ({ page, browserName }) => {
    // Check TTS support
    const ttsSupport = await page.evaluate(() => {
      return !!window.speechSynthesis;
    });
    
    if (!ttsSupport) {
      test.skip(`Speech Synthesis not supported in ${browserName}`);
    }

    // Enable TTS in settings
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="settings-close"]').click();

    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Send a text message
    await page.locator('[data-testid="text-input"]').fill('Tell me about this place');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for AI response
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 30000 });

    // Verify audio player is present
    await expect(page.locator('[data-testid="audio-player"]').last()).toBeVisible();

    // Check if audio controls are functional
    const playButton = page.locator('[data-testid="audio-play-button"]').last();
    const pauseButton = page.locator('[data-testid="audio-pause-button"]').last();
    
    if (await playButton.isVisible()) {
      await playButton.click();
      // Verify pause button appears
      await expect(pauseButton).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle voice input fallback to Whisper API', async ({ page }) => {
    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Mock Web Speech API to fail and trigger Whisper fallback
    await page.addInitScript(() => {
      if (window.webkitSpeechRecognition) {
        window.webkitSpeechRecognition = function() {
          return {
            start: function() {
              setTimeout(() => {
                if (this.onerror) {
                  this.onerror({ error: 'network' });
                }
              }, 100);
            },
            stop: function() {},
            abort: function() {}
          };
        };
      }
    });

    // Mock successful Whisper API response
    await page.route('**/api/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          transcript: 'This is a Whisper API transcription result' 
        })
      });
    });

    // Try voice input
    await page.locator('[data-testid="voice-input-button"]').click();
    
    // Should show fallback to Whisper
    await expect(page.locator('[data-testid="whisper-fallback-indicator"]'))
      .toBeVisible({ timeout: 5000 });

    // Verify transcription result
    await expect(page.locator('[data-testid="message"][data-type="user"]').last())
      .toContainText('This is a Whisper API transcription result', { timeout: 15000 });
  });

  test('should handle audio settings persistence', async ({ page }) => {
    // Open settings
    await page.locator('[data-testid="settings-button"]').click();

    // Change audio settings
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="volume-slider"]').fill('0.8');
    await page.locator('[data-testid="speed-slider"]').fill('1.2');

    // Close settings
    await page.locator('[data-testid="settings-close"]').click();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open settings again
    await page.locator('[data-testid="settings-button"]').click();

    // Verify settings are persisted
    await expect(page.locator('[data-testid="tts-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="volume-slider"]')).toHaveValue('0.8');
    await expect(page.locator('[data-testid="speed-slider"]')).toHaveValue('1.2');
  });

  test('should handle microphone permission denied', async ({ page }) => {
    // Deny microphone permissions
    await page.context().clearPermissions();

    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Try to use voice input
    await page.locator('[data-testid="voice-input-button"]').click();

    // Should show permission error
    await expect(page.locator('[data-testid="microphone-permission-error"]'))
      .toBeVisible({ timeout: 5000 });
    
    // Should suggest text input as alternative
    await expect(page.locator('[data-testid="text-input-suggestion"]'))
      .toBeVisible({ timeout: 5000 });
  });

  test('should handle audio quality optimization', async ({ page }) => {
    // Enable TTS
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('[data-testid="tts-toggle"]').check();
    await page.locator('[data-testid="settings-close"]').click();

    // Select a story
    await page.waitForSelector('[data-testid="story-card"]', { timeout: 10000 });
    await page.locator('[data-testid="story-card"]').first().click();
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });

    // Send a long message to test audio streaming
    const longMessage = 'Tell me a very detailed story about the ancient castle, including its history, the people who lived there, the battles that were fought, and the mysteries that remain unsolved to this day.';
    
    await page.locator('[data-testid="text-input"]').fill(longMessage);
    await page.locator('[data-testid="send-button"]').click();

    // Wait for AI response
    await page.waitForSelector('[data-testid="message"][data-type="ai"]:last-child', { timeout: 45000 });

    // Check for audio optimization indicators
    const audioPlayer = page.locator('[data-testid="audio-player"]').last();
    await expect(audioPlayer).toBeVisible();

    // Verify streaming indicator if response is long enough
    const streamingIndicator = page.locator('[data-testid="audio-streaming-indicator"]');
    if (await streamingIndicator.isVisible()) {
      await expect(streamingIndicator).toContainText(/streaming|loading/i);
    }
  });
});