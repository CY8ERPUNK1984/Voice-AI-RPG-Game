import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  width?: string;
  height?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  width = 'w-full',
  height = 'h-4'
}) => {
  return (
    <div
      className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`}
      role="status"
      aria-label="Loading content"
    />
  );
};

interface StorySkeletonProps {
  count?: number;
}

export const StorySkeleton: React.FC<StorySkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
        >
          {/* Genre Badge Skeleton */}
          <div className="mb-3">
            <SkeletonLoader width="w-20" height="h-6" className="rounded-full" />
          </div>

          {/* Title Skeleton */}
          <div className="mb-3 space-y-2">
            <SkeletonLoader height="h-6" />
            <SkeletonLoader width="w-3/4" height="h-6" />
          </div>

          {/* Description Skeleton */}
          <div className="mb-4 space-y-2">
            <SkeletonLoader height="h-4" />
            <SkeletonLoader height="h-4" />
            <SkeletonLoader width="w-2/3" height="h-4" />
          </div>

          {/* Button Skeleton */}
          <SkeletonLoader height="h-10" className="rounded-lg" />
        </div>
      ))}
    </div>
  );
};