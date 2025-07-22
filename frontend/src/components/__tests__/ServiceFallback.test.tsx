import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  ServiceFallback, 
  VoiceInputFallback, 
  TTSFallback, 
  ConnectionFallback 
} from '../ServiceFallback';

describe('ServiceFallback', () => {
  it('should render service name and basic fallback UI', () => {
    render(<ServiceFallback serviceName="Test Service" />);

    expect(screen.getByText('Test Service Unavailable')).toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    render(
      <ServiceFallback 
        serviceName="Test Service" 
        error="Service is temporarily down" 
      />
    );

    expect(screen.getByText('Service is temporarily down')).toBeInTheDocument();
  });

  it('should render children when provided', () => {
    render(
      <ServiceFallback serviceName="Test Service">
        <div>Custom content</div>
      </ServiceFallback>
    );

    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <ServiceFallback 
        serviceName="Test Service" 
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ServiceFallback serviceName="Test Service" />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });
});

describe('VoiceInputFallback', () => {
  it('should render voice input fallback UI', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    expect(screen.getByText('Voice input unavailable')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message here...')).toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    const onTextInput = vi.fn();
    render(
      <VoiceInputFallback 
        onTextInput={onTextInput} 
        error="Microphone not available" 
      />
    );

    expect(screen.getByText('Microphone not available')).toBeInTheDocument();
  });

  it('should call onTextInput when form is submitted', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(onTextInput).toHaveBeenCalledWith('Test message');
  });

  it('should clear input after sending message', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Type your message here...') as HTMLInputElement;
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(input.value).toBe('');
  });

  it('should disable send button when input is empty', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has text', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Test' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('should call onRetryVoice when retry voice button is clicked', () => {
    const onTextInput = vi.fn();
    const onRetryVoice = vi.fn();
    render(
      <VoiceInputFallback 
        onTextInput={onTextInput} 
        onRetryVoice={onRetryVoice}
      />
    );

    fireEvent.click(screen.getByText('Try Voice Input Again'));
    expect(onRetryVoice).toHaveBeenCalled();
  });

  it('should not render retry voice button when onRetryVoice is not provided', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    expect(screen.queryByText('Try Voice Input Again')).not.toBeInTheDocument();
  });

  it('should submit form on Enter key press', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Type your message here...');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.submit(input.closest('form')!);

    expect(onTextInput).toHaveBeenCalledWith('Test message');
  });
});

describe('TTSFallback', () => {
  it('should render TTS fallback with text', () => {
    render(<TTSFallback text="Hello world" />);

    expect(screen.getByText('Audio unavailable - Text only')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should call onRetryTTS when retry button is clicked', () => {
    const onRetryTTS = vi.fn();
    render(
      <TTSFallback 
        text="Hello world" 
        onRetryTTS={onRetryTTS}
      />
    );

    fireEvent.click(screen.getByText('Retry Audio'));
    expect(onRetryTTS).toHaveBeenCalled();
  });

  it('should not render retry button when onRetryTTS is not provided', () => {
    render(<TTSFallback text="Hello world" />);

    expect(screen.queryByText('Retry Audio')).not.toBeInTheDocument();
  });
});

describe('ConnectionFallback', () => {
  it('should render connection error UI', () => {
    render(<ConnectionFallback />);

    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to the game server/)).toBeInTheDocument();
  });

  it('should call onRetry when reconnect button is clicked', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Reconnect'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show reconnecting state when isRetrying is true', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} isRetrying={true} />);

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.getByText('Reconnecting...').closest('button')).toBeDisabled();
  });

  it('should show reconnect button when not retrying', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} isRetrying={false} />);

    expect(screen.getByText('Reconnect')).toBeInTheDocument();
    expect(screen.getByText('Reconnect').closest('button')).not.toBeDisabled();
  });

  it('should not render reconnect button when onRetry is not provided', () => {
    render(<ConnectionFallback />);

    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
  });
});