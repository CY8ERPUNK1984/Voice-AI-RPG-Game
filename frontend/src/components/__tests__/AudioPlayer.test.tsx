import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPlayer } from '../AudioPlayer';
import { TTSIntegration } from '@/services/TTSIntegration';

// Mock TTSIntegration
vi.mock('@/services/TTSIntegration', () => ({
  TTSIntegration: vi.fn().mockImplementation(() => ({
    playFromUrl: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn()
  }))
}));

// Mock LoadingSpinner
vi.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ className, size, color }: { className?: string, size?: string, color?: string }) => (
    <div data-testid="loading-spinner" className={className}>Loading...</div>
  )
}));

describe('AudioPlayer', () => {
  const defaultProps = {
    audioUrl: 'test-audio.mp3',
    autoPlay: false,
    onPlaybackComplete: vi.fn()
  };

  // Create a mock for the audio element
  let audioElement: HTMLAudioElement;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a mock audio element
    audioElement = document.createElement('audio');
    
    // Mock audio methods
    audioElement.play = vi.fn().mockResolvedValue(undefined);
    audioElement.pause = vi.fn();
    audioElement.load = vi.fn();
    audioElement.addEventListener = vi.fn();
    audioElement.removeEventListener = vi.fn();
    
    // Mock audio properties
    Object.defineProperty(audioElement, 'duration', { value: 100, writable: true });
    Object.defineProperty(audioElement, 'currentTime', { value: 0, writable: true });
    Object.defineProperty(audioElement, 'paused', { value: true, writable: true });
    Object.defineProperty(audioElement, 'ended', { value: false, writable: true });
    Object.defineProperty(audioElement, 'buffered', { 
      value: {
        length: 1,
        start: () => 0,
        end: () => 50
      }
    });
    
    // Mock querySelector to return our mock audio element
    document.querySelector = vi.fn().mockImplementation((selector) => {
      if (selector === 'audio') {
        return audioElement;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render audio player with controls', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Check for play button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Check for slider
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('should disable controls when no audioUrl is provided', () => {
    render(<AudioPlayer {...defaultProps} audioUrl="" />);
    
    const buttons = screen.getAllByRole('button');
    const playButton = buttons[0];
    const slider = screen.getByRole('slider');
    
    expect(playButton).toBeDisabled();
    expect(slider).toBeDisabled();
  });

  it('should clean up event listeners on unmount', () => {
    // Mock createElement to return our mock audio element
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'audio') {
        return audioElement;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Mock useRef to return our mock audio element
    const mockAudioRef = { current: audioElement };
    const mockTTSRef = { current: null };
    vi.spyOn(React, 'useRef')
      .mockReturnValueOnce(mockAudioRef)
      .mockReturnValueOnce(mockTTSRef);
    
    const { unmount } = render(<AudioPlayer {...defaultProps} />);
    
    // Verify that addEventListener was called during mount
    expect(audioElement.addEventListener).toHaveBeenCalledWith('loadstart', expect.any(Function));
    expect(audioElement.addEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    
    // Clear only the addEventListener mock calls, not removeEventListener
    (audioElement.addEventListener as any).mockClear();
    
    // Trigger the cleanup by unmounting
    unmount();
    
    // The cleanup function should be called when the component unmounts
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('loadstart', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(audioElement.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));

    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  it('should handle TTS playback errors', async () => {
    // Create a mock TTSIntegration instance that throws an error
    const mockTTSIntegration = {
      playFromUrl: vi.fn().mockRejectedValue(new Error('TTS error')),
      pause: vi.fn(),
      stop: vi.fn()
    };
    
    // Override the useRef mock for this test
    const mockAudioRef = { current: audioElement };
    const mockTTSRef = { current: mockTTSIntegration };
    vi.spyOn(React, 'useRef')
      .mockReturnValueOnce(mockAudioRef) // First useRef call (audioRef)
      .mockReturnValueOnce(mockTTSRef); // Second useRef call (ttsIntegrationRef)
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<AudioPlayer {...defaultProps} audioUrl="tts:Hello%20world" />);
    
    // Verify TTSIntegration was initialized
    expect(TTSIntegration).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
});