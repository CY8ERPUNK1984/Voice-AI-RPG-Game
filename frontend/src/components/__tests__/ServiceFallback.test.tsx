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

    expect(screen.getByText('Test Service недоступен')).toBeInTheDocument();
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
        showRecoveryActions={false}
      />
    );

    fireEvent.click(screen.getByText('Попробовать снова'));
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

    expect(screen.getByText('Голосовой ввод недоступен')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Введите ваше сообщение здесь...')).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText('Введите ваше сообщение здесь...');
    const sendButton = screen.getByText('Отправить');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(onTextInput).toHaveBeenCalledWith('Test message');
  });

  it('should clear input after sending message', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Введите ваше сообщение здесь...') as HTMLInputElement;
    const sendButton = screen.getByText('Отправить');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(input.value).toBe('');
  });

  it('should disable send button when input is empty', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const sendButton = screen.getByText('Отправить');
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has text', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Введите ваше сообщение здесь...');
    const sendButton = screen.getByText('Отправить');

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

    fireEvent.click(screen.getByText('Попробовать голосовой ввод снова'));
    expect(onRetryVoice).toHaveBeenCalled();
  });

  it('should not render retry voice button when onRetryVoice is not provided', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    expect(screen.queryByText('Попробовать голосовой ввод снова')).not.toBeInTheDocument();
  });

  it('should submit form on Enter key press', () => {
    const onTextInput = vi.fn();
    render(<VoiceInputFallback onTextInput={onTextInput} />);

    const input = screen.getByPlaceholderText('Введите ваше сообщение здесь...');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.submit(input.closest('form')!);

    expect(onTextInput).toHaveBeenCalledWith('Test message');
  });
});

describe('TTSFallback', () => {
  it('should render TTS fallback with text', () => {
    render(<TTSFallback text="Hello world" />);

    expect(screen.getByText('Аудио недоступно - только текст')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Повторить аудио'));
    expect(onRetryTTS).toHaveBeenCalled();
  });

  it('should not render retry button when onRetryTTS is not provided', () => {
    render(<TTSFallback text="Hello world" />);

    expect(screen.queryByText('Повторить аудио')).not.toBeInTheDocument();
  });
});

describe('ConnectionFallback', () => {
  it('should render connection error UI', () => {
    render(<ConnectionFallback />);

    expect(screen.getByText('Соединение потеряно')).toBeInTheDocument();
    expect(screen.getByText(/Не удается подключиться к игровому серверу/)).toBeInTheDocument();
  });

  it('should call onRetry when reconnect button is clicked', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Переподключиться'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show reconnecting state when isRetrying is true', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} isRetrying={true} />);

    expect(screen.getByText('Переподключение...')).toBeInTheDocument();
    expect(screen.getByText('Переподключение...').closest('button')).toBeDisabled();
  });

  it('should show reconnect button when not retrying', () => {
    const onRetry = vi.fn();
    render(<ConnectionFallback onRetry={onRetry} isRetrying={false} />);

    expect(screen.getByText('Переподключиться')).toBeInTheDocument();
    expect(screen.getByText('Переподключиться').closest('button')).not.toBeDisabled();
  });

  it('should not render reconnect button when onRetry is not provided', () => {
    render(<ConnectionFallback />);

    expect(screen.queryByText('Переподключиться')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
  });
});