import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'message' | 'chat' | 'response';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
  animated?: boolean;
  shimmer?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className = '',
  animated = true,
  shimmer = true
}) => {
  const shimmerClasses = shimmer && animated ? 'relative overflow-hidden' : '';
  const baseClasses = `bg-gray-700 ${animated ? 'animate-pulse' : ''} ${shimmerClasses}`;

  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      case 'text':
        return 'rounded h-4';
      case 'message':
        return 'rounded-lg';
      case 'chat':
        return 'rounded-lg h-16';
      case 'response':
        return 'rounded h-3';
      default:
        return 'rounded';
    }
  };

  const renderShimmer = () => {
    if (!shimmer || !animated) return null;
    
    return (
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    );
  };

  const getStyle = () => {
    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;
    return style;
  };

  if (variant === 'message') {
    return (
      <div className={`flex space-x-3 ${className}`}>
        <div className={`${baseClasses} w-8 h-8 rounded-full flex-shrink-0`}>
          {renderShimmer()}
        </div>
        <div className="flex-1 space-y-2">
          <div className={`${baseClasses} h-4 rounded w-3/4`}>
            {renderShimmer()}
          </div>
          <div className={`${baseClasses} h-4 rounded w-1/2`}>
            {renderShimmer()}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'chat') {
    return (
      <div className={`${className}`}>
        <div className={`${baseClasses} ${getVariantClasses()} mb-3`} style={getStyle()}>
          {renderShimmer()}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className={`${baseClasses} h-3 rounded`}
              style={{ width: index === 1 ? '60%' : '85%' }}
            >
              {renderShimmer()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'response') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              ...getStyle(),
              width: index === lines - 1 ? '65%' : index === 0 ? '90%' : '80%'
            }}
          >
            {renderShimmer()}
          </div>
        ))}
      </div>
    );
  }

  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              ...getStyle(),
              width: index === lines - 1 ? '75%' : '100%'
            }}
          >
            {renderShimmer()}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={getStyle()}
    >
      {renderShimmer()}
    </div>
  );
};

export default SkeletonLoader;