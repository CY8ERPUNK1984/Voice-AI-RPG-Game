import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders with correct progress value', () => {
    render(<ProgressBar progress={50} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('shows percentage when enabled', () => {
    render(<ProgressBar progress={75} showPercentage={true} />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('displays label when provided', () => {
    render(<ProgressBar progress={30} label="Loading..." />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('clamps progress values correctly', () => {
    const { rerender } = render(<ProgressBar progress={150} />);
    
    let progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    expect(progressBar).toHaveStyle({ width: '100%' });

    rerender(<ProgressBar progress={-10} />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<ProgressBar progress={50} size="sm" />);
    
    let progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('h-1');

    rerender(<ProgressBar progress={50} size="md" />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('h-2');

    rerender(<ProgressBar progress={50} size="lg" />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('h-3');
  });

  it('applies correct color classes', () => {
    const { rerender } = render(<ProgressBar progress={50} color="blue" />);
    
    let progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-blue-500');

    rerender(<ProgressBar progress={50} color="green" />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-green-500');

    rerender(<ProgressBar progress={50} color="red" />);
    progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-red-500');
  });

  it('applies custom className', () => {
    const { container } = render(<ProgressBar progress={50} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<ProgressBar progress={60} label="File upload" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'File upload');
  });
});