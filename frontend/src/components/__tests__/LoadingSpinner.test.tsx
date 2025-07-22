import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-4', 'h-4');

    rerender(<LoadingSpinner size="md" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-6', 'h-6');

    rerender(<LoadingSpinner size="lg" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('applies correct color classes', () => {
    const { rerender } = render(<LoadingSpinner color="blue" />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('border-blue-500', 'border-t-transparent');

    rerender(<LoadingSpinner color="white" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('border-white', 'border-t-transparent');

    rerender(<LoadingSpinner color="gray" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('border-gray-500', 'border-t-transparent');

    rerender(<LoadingSpinner color="purple" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('border-purple-500', 'border-t-transparent');
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-class');
  });

  it('has animation class', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });
});