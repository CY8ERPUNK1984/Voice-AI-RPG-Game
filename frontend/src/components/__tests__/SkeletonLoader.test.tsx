import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonLoader, StorySkeleton } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders with default props', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
  });

  it('applies default classes', () => {
    render(<SkeletonLoader />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('w-full', 'h-4', 'bg-gray-200', 'rounded', 'animate-pulse');
  });

  it('applies custom width and height', () => {
    render(<SkeletonLoader width="w-1/2" height="h-8" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('w-1/2', 'h-8');
  });

  it('applies custom className', () => {
    render(<SkeletonLoader className="custom-class" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('custom-class');
  });
});

describe('StorySkeleton', () => {
  it('renders default number of skeleton cards', () => {
    const { container } = render(<StorySkeleton />);
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6');
    
    const cards = gridContainer?.children;
    expect(cards).toHaveLength(6); // Default count
  });

  it('renders custom number of skeleton cards', () => {
    const { container } = render(<StorySkeleton count={3} />);
    const gridContainer = container.querySelector('.grid');
    const cards = gridContainer?.children;
    expect(cards).toHaveLength(3);
  });

  it('renders skeleton elements in correct structure', () => {
    const { container } = render(<StorySkeleton count={1} />);
    const card = container.querySelector('.bg-white');
    
    // Check card structure
    expect(card).toHaveClass('bg-white', 'rounded-lg', 'shadow-md', 'border', 'border-gray-200', 'p-6');
    
    // Should have multiple skeleton elements for different parts
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(1); // Genre, title, description, button
  });
});