import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioPlayer } from '../AudioPlayer';

// Mock HTMLAudioElement
const mockAudio = {
  play: vi.fn(),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  currentTime: 0,
  duration: 100,
  paused: true,
  ended: false,
  src: '',
  volume: 1
};

// Mock HTMLAudioElement constructor
Object.defineProperty(window, 'HTMLAudioElement', {
  value: vi.fn().mockImplementation(() => mockAudio),
  writable: true
});

// Mock useRef to return our mock audio element
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useRef: vi.fn(() => ({ current: mockAudio }))
  };
});

describe('AudioPlayer', () => {
  const defaultProps = {
    audioUrl: 'test-audio.mp3',
    autoPlay: false,
    onPlaybackComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudio.currentTime = 0;
    mockAudio.duration = 100;
    mockAudio.paused = true;
    mockAudio.ended = false;
    mockAudio.play.mockResolvedValue(undefined);
  });

  it('should render audio player with controls', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('should show play button when not playing', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button');
    expect(playButton).toBeInTheDocument();
    
    // Check for play icon (triangle)
    const playIcon = playButton.querySelector('svg');
    expect(playIcon).toBeInTheDocument();
  });

  it('should call audio.play when play button is clicked', async () => {
    render(<AudioPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button');
    fireEvent.click(playButton);
    
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('should call audio.pause when pause button is clicked while playing', async () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Simulate audio playing state
    mockAudio.paused = false;
    
    // First click to start playing
    const playButton = screen.getByRole('button');
    fireEvent.click(playButton);
    
    // Simulate play event
    const playHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'play'
    )?.[1];
    if (playHandler) playHandler();
    
    // Now click should pause
    fireEvent.click(playButton);
    
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('should handle stop button click', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    const buttons = screen.getAllByRole('button');
    const stopButton = buttons[1]; // Second button should be stop
    
    fireEvent.click(stopButton);
    
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.currentTime).toBe(0);
  });

  it('should update progress when audio time changes', async () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Simulate timeupdate event
    mockAudio.currentTime = 50;
    const timeUpdateHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'timeupdate'
    )?.[1];
    
    if (timeUpdateHandler) {
      timeUpdateHandler();
    }
    
    await waitFor(() => {
      expect(screen.getByText('0:50')).toBeInTheDocument();
    });
  });

  it('should handle seek when slider is changed', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    
    expect(mockAudio.currentTime).toBe(30);
  });

  it('should call onPlaybackComplete when audio ends', () => {
    const onPlaybackComplete = vi.fn();
    render(<AudioPlayer {...defaultProps} onPlaybackComplete={onPlaybackComplete} />);
    
    // Simulate ended event
    const endedHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'ended'
    )?.[1];
    
    if (endedHandler) {
      endedHandler();
    }
    
    expect(onPlaybackComplete).toHaveBeenCalled();
  });

  it('should auto-play when autoPlay is true', async () => {
    render(<AudioPlayer {...defaultProps} autoPlay={true} />);
    
    await waitFor(() => {
      expect(mockAudio.play).toHaveBeenCalled();
    });
  });

  it('should display error message when audio fails to load', async () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Simulate error event
    const errorHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'error'
    )?.[1];
    
    if (errorHandler) {
      errorHandler();
    }
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument();
    });
  });

  it('should handle play error gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAudio.play.mockRejectedValue(new Error('Play failed'));
    
    render(<AudioPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to play audio')).toBeInTheDocument();
    });
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should format time correctly', () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Simulate metadata loaded with duration
    mockAudio.duration = 125; // 2:05
    const metadataHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'loadedmetadata'
    )?.[1];
    
    if (metadataHandler) {
      metadataHandler();
    }
    
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should disable controls when no audioUrl is provided', () => {
    render(<AudioPlayer {...defaultProps} audioUrl="" />);
    
    const playButton = screen.getByRole('button');
    const slider = screen.getByRole('slider');
    
    expect(playButton).toBeDisabled();
    expect(slider).toBeDisabled();
  });

  it('should show playing indicator when audio is playing', async () => {
    render(<AudioPlayer {...defaultProps} />);
    
    // Simulate play event
    const playHandler = mockAudio.addEventListener.mock.calls.find(
      call => call[0] === 'play'
    )?.[1];
    
    if (playHandler) {
      playHandler();
    }
    
    await waitFor(() => {
      expect(screen.getByText('Playing audio...')).toBeInTheDocument();
    });
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = render(<AudioPlayer {...defaultProps} />);
    
    const addEventListenerCalls = mockAudio.addEventListener.mock.calls.length;
    
    unmount();
    
    expect(mockAudio.removeEventListener).toHaveBeenCalledTimes(addEventListenerCalls);
  });
});