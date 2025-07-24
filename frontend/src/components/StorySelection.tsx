import React from 'react';
import { Story } from '../types';
import StorySelector from './StorySelector';

interface StorySelectionProps {
  stories: Story[];
  storiesLoading: boolean;
  onStorySelect: (story: Story) => void;
}

export function StorySelection({ stories, storiesLoading, onStorySelect }: StorySelectionProps) {
  return (
    <section 
      className="space-y-6"
      role="region"
      aria-labelledby="story-selection-title"
    >
      <div className="text-center">
        <h2 
          id="story-selection-title"
          className="text-2xl font-bold mb-4"
        >
          Choose Your Adventure
        </h2>
        <p 
          className="text-gray-400"
          aria-describedby="story-selection-title"
        >
          Select a story to begin your voice-controlled RPG experience
        </p>
      </div>

      <StorySelector
        stories={stories}
        onStorySelect={onStorySelect}
        isLoading={storiesLoading}
      />
    </section>
  );
}