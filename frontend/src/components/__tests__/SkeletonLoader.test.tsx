import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders text variant by default', () => {
    const { container } = render(<SkeletonLoader />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('bg-gray-700', 'animate-pulse', 'rounded', 'h-4');
  });

  it('renders circular variant correctly', () => {
    const { container } = render(<SkeletonLoader variant="circular" />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('rounded-full');
  });

  it('renders rectangular variant correctly', () => {
    const { container } = render(<SkeletonLoader variant="rectangular" />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('rounded-md');
  });

  it('renders message variant with avatar and text lines', () => {
    const { container } = render(<SkeletonLoader variant="message" />);
    
    // Should have avatar skeleton
    const avatar = container.querySelector('.w-8.h-8.rounded-full');
    expect(avatar).toBeInTheDocument();
    
    // Should have text line skeletons
    const textLines = container.querySelectorAll('.h-4.rounded');
    expect(textLines).toHaveLength(2);
  });

  it('renders multiple lines when specified', () => {
    const { container } = render(<SkeletonLoader lines={3} />);
    
    const skeletons = container.querySelectorAll('.bg-gray-700');
    expect(skeletons).toHaveLength(3);
  });

  it('applies custom width and height', () => {
    const { container } = render(
      <SkeletonLoader width="200px" height="50px" />
    );
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle({
      width: '200px',
      height: '50px'
    });
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonLoader className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('can disable animation', () => {
    const { container } = render(<SkeletonLoader animated={false} />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).not.toHaveClass('animate-pulse');
  });

  it('makes last line shorter in multi-line mode', () => {
    const { container } = render(<SkeletonLoader lines={3} />);
    
    const skeletons = container.querySelectorAll('.bg-gray-700');
    const lastSkeleton = skeletons[skeletons.length - 1] as HTMLElement;
    
    expect(lastSkeleton).toHaveStyle({ width: '75%' });
  });
});