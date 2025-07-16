import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import ChatInterface from '../ChatInterface';
import { Message } from '../../types';

const mockMessages: Message[] = [
  {
    id: '1',
    sessionId: 'test-session',
    type: 'ai',
    content: 'Welcome to the game!',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    metadata: {}
  },
  {
    id: '2',
    sessionId: 'test-session',
    type: 'user',
    content: 'Hello there!',
    timestamp: new Date('2024-01-01T12:01:00Z'),
    metadata: {}
  }
];

const mockOnSendMessage = vi.fn();

describe('ChatInterface Component', () => {
  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  it('renders chat interface with messages', () => {
    render(
      <ChatInterface
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    expect(screen.getByText('Game Chat')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the game!')).toBeInTheDocument();
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Start the conversation!')).toBeInTheDocument();
    expect(screen.getByText('0 messages')).toBeInTheDocument();
  });

  it('handles message input and submission', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    await user.type(textarea, 'Test message');
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('handles Enter key submission', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');

    await user.type(textarea, 'Test message{enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('allows Shift+Enter for new line without submission', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');

    // Type text and then simulate Shift+Enter
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Line 2');

    expect(mockOnSendMessage).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Line 1\nLine 2');
  });

  it('clears input after successful submission', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    await user.type(textarea, 'Test message');
    await user.click(sendButton);

    expect(textarea).toHaveValue('');
  });

  it('disables input and shows loading state when isLoading is true', () => {
    render(
      <ChatInterface
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        isLoading={true}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByRole('button');

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
    
    // Should show loading spinner in button
    expect(sendButton.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    render(
      <ChatInterface
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        isLoading={true}
      />
    );

    // Should show typing indicator with bouncing dots
    const loadingDots = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('animate-bounce')
    );
    expect(loadingDots).toHaveLength(3);
  });

  it('does not submit empty or whitespace-only messages', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    // Try submitting empty message
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();

    // Try submitting whitespace-only message
    await user.type(textarea, '   ');
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('trims whitespace from submitted messages', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    await user.type(textarea, '  Test message  ');
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('disables send button when input is empty', () => {
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has content', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInterface
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    const textarea = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByText('Send');

    await user.type(textarea, 'Test');

    expect(sendButton).not.toBeDisabled();
  });

  it('shows correct message count', () => {
    render(
      <ChatInterface
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    expect(screen.getByText('2 messages')).toBeInTheDocument();
  });

  it('shows singular message count for one message', () => {
    render(
      <ChatInterface
        messages={[mockMessages[0]]}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    expect(screen.getByText('1 message')).toBeInTheDocument();
  });
});