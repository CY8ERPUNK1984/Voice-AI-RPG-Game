import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('renders with default text', () => {
    render(<TypingIndicator />);
    expect(screen.getByText('ИИ печатает')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<TypingIndicator text="Обработка..." />);
    expect(screen.getByText('Обработка...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<TypingIndicator className="custom-class" />);
    const container = screen.getByText('ИИ печатает').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('renders animated dots', () => {
    render(<TypingIndicator />);
    const container = screen.getByText('ИИ печатает').parentElement;
    const dots = container?.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  it('has correct structure', () => {
    render(<TypingIndicator />);
    const container = screen.getByText('ИИ печатает').parentElement;
    expect(container).toHaveClass('flex', 'items-center', 'space-x-2');
    
    const dotsContainer = container?.querySelector('.flex.space-x-1');
    expect(dotsContainer).toBeInTheDocument();
    
    const textElement = screen.getByText('ИИ печатает');
    expect(textElement).toHaveClass('text-sm', 'text-gray-500');
  });
});