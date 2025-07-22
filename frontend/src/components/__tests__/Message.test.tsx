import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from '../Message';
import { Message as MessageType } from '../../types';

const mockUserMessage: MessageType = {
  id: '1',
  sessionId: 'test-session',
  type: 'user',
  content: 'Hello, this is a user message',
  timestamp: new Date('2024-01-01T12:00:00Z'),
  metadata: {}
};

const mockAIMessage: MessageType = {
  id: '2',
  sessionId: 'test-session',
  type: 'ai',
  content: 'Hello, this is an AI response',
  timestamp: new Date('2024-01-01T12:01:00Z'),
  metadata: {
    confidence: 0.95,
    processingTime: 1500
  }
};

const mockAIMessageWithAudio: MessageType = {
  id: '3',
  sessionId: 'test-session',
  type: 'ai',
  content: 'This message has audio',
  audioUrl: 'https://example.com/audio.mp3',
  timestamp: new Date('2024-01-01T12:02:00Z'),
  metadata: {}
};

describe('Message Component', () => {
  it('renders user message correctly', () => {
    render(<Message message={mockUserMessage} />);
    
    expect(screen.getByText('Hello, this is a user message')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument(); // User avatar
    // Check that some time is displayed (format may vary by locale)
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
  });

  it('renders AI message correctly', () => {
    render(<Message message={mockAIMessage} />);
    
    expect(screen.getByText('Hello, this is an AI response')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument(); // AI avatar
    // Check that some time is displayed (format may vary by locale)
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
  });

  it('displays confidence score for AI messages when available', () => {
    render(<Message message={mockAIMessage} />);
    
    expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
  });

  it('shows audio button when audioUrl is present', () => {
    render(<Message message={mockAIMessageWithAudio} />);
    
    const audioButton = screen.getByTitle('Show audio player');
    expect(audioButton).toBeInTheDocument();
    expect(audioButton).toHaveTextContent('🔊');
  });

  it('applies correct styling for user messages', () => {
    const { container } = render(<Message message={mockUserMessage} />);
    
    const messageContainer = container.querySelector('.justify-end');
    expect(messageContainer).toBeInTheDocument();
    
    const messageContent = container.querySelector('.bg-blue-600');
    expect(messageContent).toBeInTheDocument();
  });

  it('applies correct styling for AI messages', () => {
    const { container } = render(<Message message={mockAIMessage} />);
    
    const messageContainer = container.querySelector('.justify-start');
    expect(messageContainer).toBeInTheDocument();
    
    const messageContent = container.querySelector('.bg-gray-700');
    expect(messageContent).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    render(<Message message={mockUserMessage} />);
    
    // Check that some time is displayed (format may vary by locale)
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
  });

  it('does not show confidence for user messages', () => {
    render(<Message message={mockUserMessage} />);
    
    expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
  });

  it('does not show audio button when audioUrl is not present', () => {
    render(<Message message={mockUserMessage} />);
    
    expect(screen.queryByTitle('Show audio player')).not.toBeInTheDocument();
  });
});