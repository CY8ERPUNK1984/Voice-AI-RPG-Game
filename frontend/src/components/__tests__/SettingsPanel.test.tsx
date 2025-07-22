import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPanel } from '../SettingsPanel';
import { AudioSettings } from '@/types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockSettings: AudioSettings = {
  ttsEnabled: true,
  ttsVolume: 0.8,
  asrSensitivity: 0.7,
  voiceSpeed: 1.0,
};

const mockOnSettingsChange = vi.fn();

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings button', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    const settingsButton = screen.getByLabelText('Open audio settings');
    expect(settingsButton).toBeInTheDocument();
  });

  it('opens settings panel when button is clicked', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    const settingsButton = screen.getByLabelText('Open audio settings');
    fireEvent.click(settingsButton);

    expect(screen.getByText('Audio Settings')).toBeInTheDocument();
    expect(screen.getByText('Text-to-Speech')).toBeInTheDocument();
  });

  it('closes settings panel when close button is clicked', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    const settingsButton = screen.getByLabelText('Open audio settings');
    fireEvent.click(settingsButton);

    // Close panel
    const closeButton = screen.getByLabelText('Close settings');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Audio Settings')).not.toBeInTheDocument();
  });

  it('displays current settings values', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Check TTS toggle is enabled
    const ttsToggle = screen.getByRole('switch');
    expect(ttsToggle).toHaveAttribute('aria-checked', 'true');

    // Check volume display
    expect(screen.getByText('TTS Volume: 80%')).toBeInTheDocument();

    // Check sensitivity display
    expect(screen.getByText('Microphone Sensitivity: 70%')).toBeInTheDocument();

    // Check speed display
    expect(screen.getByText('Speech Speed: 1x')).toBeInTheDocument();
  });

  it('toggles TTS enabled state', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Toggle TTS
    const ttsToggle = screen.getByRole('switch');
    fireEvent.click(ttsToggle);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      ...mockSettings,
      ttsEnabled: false,
    });
  });

  it('updates TTS volume', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Change volume
    const volumeSlider = screen.getByLabelText(/TTS Volume/);
    fireEvent.change(volumeSlider, { target: { value: '0.5' } });

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      ...mockSettings,
      ttsVolume: 0.5,
    });
  });

  it('updates ASR sensitivity', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Change sensitivity
    const sensitivitySlider = screen.getByLabelText(/Microphone Sensitivity/);
    fireEvent.change(sensitivitySlider, { target: { value: '0.9' } });

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      ...mockSettings,
      asrSensitivity: 0.9,
    });
  });

  it('updates voice speed', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Change speed
    const speedSlider = screen.getByLabelText(/Speech Speed/);
    fireEvent.change(speedSlider, { target: { value: '1.5' } });

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      ...mockSettings,
      voiceSpeed: 1.5,
    });
  });

  it('disables TTS-related controls when TTS is disabled', () => {
    const disabledSettings = { ...mockSettings, ttsEnabled: false };
    
    render(
      <SettingsPanel
        settings={disabledSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Check that volume and speed sliders are disabled
    const volumeSlider = screen.getByLabelText(/TTS Volume/);
    const speedSlider = screen.getByLabelText(/Speech Speed/);

    expect(volumeSlider).toBeDisabled();
    expect(speedSlider).toBeDisabled();
  });

  it('resets settings to defaults', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Click reset button
    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    expect(mockOnSettingsChange).toHaveBeenCalledWith({
      ttsEnabled: true,
      ttsVolume: 0.8,
      asrSensitivity: 0.7,
      voiceSpeed: 1.0,
    });
  });

  it('loads settings from localStorage on mount', async () => {
    const storedSettings = {
      ttsEnabled: false,
      ttsVolume: 0.5,
      asrSensitivity: 0.9,
      voiceSpeed: 1.2,
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalledWith(storedSettings);
    });
  });

  it('saves settings to localStorage when changed', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Change a setting
    const ttsToggle = screen.getByRole('switch');
    fireEvent.click(ttsToggle);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'voice-ai-rpg-audio-settings',
      JSON.stringify({ ...mockSettings, ttsEnabled: false })
    );
  });

  it('handles localStorage errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load audio settings from localStorage:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('handles invalid JSON in localStorage', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorageMock.getItem.mockReturnValue('invalid json');

    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load audio settings from localStorage:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('handles localStorage save errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage save error');
    });

    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel and change a setting
    fireEvent.click(screen.getByLabelText('Open audio settings'));
    const ttsToggle = screen.getByRole('switch');
    fireEvent.click(ttsToggle);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to save audio settings to localStorage:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('updates display values when sliders change', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Change volume slider
    const volumeSlider = screen.getByLabelText(/TTS Volume/);
    fireEvent.change(volumeSlider, { target: { value: '0.3' } });

    // Check that display updates
    expect(screen.getByText('TTS Volume: 30%')).toBeInTheDocument();

    // Change speed slider
    const speedSlider = screen.getByLabelText(/Speech Speed/);
    fireEvent.change(speedSlider, { target: { value: '1.8' } });

    // Check that display updates
    expect(screen.getByText('Speech Speed: 1.8x')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <SettingsPanel
        settings={mockSettings}
        onSettingsChange={mockOnSettingsChange}
      />
    );

    // Open panel
    fireEvent.click(screen.getByLabelText('Open audio settings'));

    // Check TTS toggle has proper role and aria-checked
    const ttsToggle = screen.getByRole('switch');
    expect(ttsToggle).toHaveAttribute('aria-checked', 'true');

    // Check sliders have proper labels
    expect(screen.getByLabelText(/TTS Volume/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Microphone Sensitivity/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Speech Speed/)).toBeInTheDocument();
  });
});