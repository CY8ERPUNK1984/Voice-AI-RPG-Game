import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceInput } from '../VoiceInput';
import { HybridASR } from '@/services/HybridASR';

// Mock the HybridASR service
vi.mock('@/services/HybridASR', () => ({
  HybridASR: vi.fn()
}));

describe('VoiceInput', () => {
  let mockAsrService: {
    isAvailable: vi.Mock<[], boolean>;
    startRecording: vi.Mock<[], Promise<void>>;
    stopRecording: vi.Mock<[], Promise<string>>;
    getAvailableMethods: vi.Mock<[], { webSpeech: boolean; whisper: boolean }>;
    onResult?: (result: string) => void;
    onError?: (error: Error) => void;
  };
  
  let mockProps: {
    onVoiceInput: ReturnType<typeof vi.fn>;
    isRecording: boolean;
    onRecordingStateChange: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAsrService = {
      isAvailable: vi.fn(() => true),
      startRecording: vi.fn(() => Promise.resolve()),
      stopRecording: vi.fn(() => Promise.resolve('test result')),
      getAvailableMethods: vi.fn(() => ({ webSpeech: true, whisper: false })),
    };

    vi.mocked(HybridASR).mockImplementation(() => mockAsrService as any);

    mockProps = {
      onVoiceInput: vi.fn(),
      isRecording: false,
      onRecordingStateChange: vi.fn(),
    };
  });

  it('should render start recording button when not recording', () => {
    render(<VoiceInput {...mockProps} />);
    
    expect(screen.getByRole('button', { name: /начать запись/i })).toBeInTheDocument();
  });

  it('should render stop recording button when recording', () => {
    render(<VoiceInput {...mockProps} isRecording={true} />);
    
    expect(screen.getByRole('button', { name: /остановить запись/i })).toBeInTheDocument();
  });

  it('should show recording indicator when recording', () => {
    render(<VoiceInput {...mockProps} isRecording={true} />);
    
    expect(screen.getByText('Запись...')).toBeInTheDocument();
  });

  it('should start recording when start button is clicked', async () => {
    render(<VoiceInput {...mockProps} />);
    
    const startButton = screen.getByRole('button', { name: /начать запись/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockAsrService.startRecording).toHaveBeenCalledOnce();
      expect(mockProps.onRecordingStateChange).toHaveBeenCalledWith(true);
    });
  });

  it('should stop recording when stop button is clicked', async () => {
    render(<VoiceInput {...mockProps} isRecording={true} />);
    
    const stopButton = screen.getByRole('button', { name: /остановить запись/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockAsrService.stopRecording).toHaveBeenCalledOnce();
    });
  });

  it('should handle successful voice input', async () => {
    render(<VoiceInput {...mockProps} />);
    
    // Simulate successful result
    if (mockAsrService.onResult) {
      mockAsrService.onResult('Hello world');
    }

    await waitFor(() => {
      expect(mockProps.onVoiceInput).toHaveBeenCalledWith('Hello world');
      expect(mockProps.onRecordingStateChange).toHaveBeenCalledWith(false);
    });
  });

  it('should handle ASR errors', async () => {
    render(<VoiceInput {...mockProps} />);
    
    // Simulate error
    const testError = new Error('Test error');
    if (mockAsrService.onError) {
      mockAsrService.onError(testError);
    }

    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
      expect(mockProps.onRecordingStateChange).toHaveBeenCalledWith(false);
    });
  });

  it('should show unsupported browser warning when ASR is not available', () => {
    mockAsrService.isAvailable.mockReturnValue(false);
    
    render(<VoiceInput {...mockProps} />);
    
    expect(screen.getByText('Голосовой ввод недоступен')).toBeInTheDocument();
    expect(screen.getByText(/ваш браузер не поддерживает/i)).toBeInTheDocument();
  });

  it('should disable button when ASR is not supported', () => {
    mockAsrService.isAvailable.mockReturnValue(false);
    
    render(<VoiceInput {...mockProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('should show processing state', async () => {
    render(<VoiceInput {...mockProps} />);
    
    const startButton = screen.getByRole('button', { name: /начать запись/i });
    fireEvent.click(startButton);

    // Should show processing state immediately
    expect(screen.getByText('Обработка...')).toBeInTheDocument();
  });

  it('should handle start recording error', async () => {
    const errorMessage = 'Failed to start recording';
    mockAsrService.startRecording.mockRejectedValue(new Error(errorMessage));
    
    render(<VoiceInput {...mockProps} />);
    
    const startButton = screen.getByRole('button', { name: /начать запись/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(mockProps.onRecordingStateChange).toHaveBeenCalledWith(false);
    });
  });

  it('should handle stop recording error', async () => {
    const errorMessage = 'Failed to stop recording';
    mockAsrService.stopRecording.mockRejectedValue(new Error(errorMessage));
    
    render(<VoiceInput {...mockProps} isRecording={true} />);
    
    const stopButton = screen.getByRole('button', { name: /остановить запись/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(mockProps.onRecordingStateChange).toHaveBeenCalledWith(false);
    });
  });

  it('should show processing indicator when not recording but processing', async () => {
    render(<VoiceInput {...mockProps} />);
    
    const startButton = screen.getByRole('button', { name: /начать запись/i });
    fireEvent.click(startButton);

    // Simulate processing state after recording stops
    if (mockAsrService.onResult) {
      // Don't call onResult immediately to keep processing state
    }

    await waitFor(() => {
      expect(screen.getByText('Обработка речи...')).toBeInTheDocument();
    });
  });

  it('should have proper accessibility attributes', () => {
    render(<VoiceInput {...mockProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Начать запись');
  });

  it('should apply correct CSS classes based on state', () => {
    const { rerender } = render(<VoiceInput {...mockProps} />);
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-500', 'hover:bg-blue-600');

    // Recording state
    rerender(<VoiceInput {...mockProps} isRecording={true} />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-500', 'hover:bg-red-600', 'animate-pulse');
  });
});