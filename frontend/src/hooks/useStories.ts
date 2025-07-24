import { useEffect } from 'react';
import { StoryService } from '../services/StoryService';
import { errorHandler } from '../services/ErrorHandler';
import { useApp } from '../contexts/AppContext';

export function useStories() {
  const { state, setStories, setStoriesLoading } = useApp();

  useEffect(() => {
    const loadStories = async () => {
      try {
        setStoriesLoading(true);
        const storyService = new StoryService();
        const loadedStories = await storyService.getAllStories();
        setStories(loadedStories);
      } catch (error) {
        console.error('Failed to load stories:', error);
        errorHandler.handleConnectionError(new Error('Failed to load stories'));
        
        // In offline mode, show a more helpful message
        if (!navigator.onLine) {
          errorHandler.showToast({
            type: 'warning',
            title: 'Автономный режим',
            message: 'Истории недоступны без интернет-соединения'
          });
        }
      } finally {
        setStoriesLoading(false);
      }
    };

    loadStories();
  }, [setStories, setStoriesLoading]);

  return {
    stories: state.stories,
    storiesLoading: state.storiesLoading,
  };
}