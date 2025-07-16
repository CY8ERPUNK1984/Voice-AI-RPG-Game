import { describe, it, expect, beforeEach } from 'vitest';
import { StoryService } from '../StoryService';
import { Story } from '../../types';

describe('Backend StoryService', () => {
  let storyService: StoryService;

  beforeEach(() => {
    storyService = new StoryService();
  });

  describe('getAllStories', () => {
    it('should return all stories', async () => {
      const stories = await storyService.getAllStories();
      
      expect(stories).toHaveLength(5);
      expect(stories[0]).toHaveProperty('id');
      expect(stories[0]).toHaveProperty('title');
      expect(stories[0]).toHaveProperty('description');
      expect(stories[0]).toHaveProperty('genre');
      expect(stories[0]).toHaveProperty('initialPrompt');
    });

    it('should return stories with proper Date objects', async () => {
      const stories = await storyService.getAllStories();
      
      expect(stories[0].createdAt).toBeInstanceOf(Date);
      expect(stories[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should return a copy of stories array', async () => {
      const stories1 = await storyService.getAllStories();
      const stories2 = await storyService.getAllStories();
      
      expect(stories1).not.toBe(stories2);
      expect(stories1).toEqual(stories2);
    });
  });

  describe('getStoryById', () => {
    it('should return a story when valid ID is provided', async () => {
      const story = await storyService.getStoryById('fantasy-dragon-quest');
      
      expect(story).not.toBeNull();
      expect(story?.id).toBe('fantasy-dragon-quest');
      expect(story?.title).toBe('Поиск Древнего Дракона');
      expect(story?.genre).toBe('fantasy');
    });

    it('should return null when invalid ID is provided', async () => {
      const story = await storyService.getStoryById('non-existent-id');
      
      expect(story).toBeNull();
    });

    it('should return a copy of the story object', async () => {
      const story1 = await storyService.getStoryById('fantasy-dragon-quest');
      const story2 = await storyService.getStoryById('fantasy-dragon-quest');
      
      expect(story1).not.toBe(story2);
      expect(story1).toEqual(story2);
    });
  });

  describe('getStoriesByGenre', () => {
    it('should return stories of specified genre', async () => {
      const fantasyStories = await storyService.getStoriesByGenre('fantasy');
      
      expect(fantasyStories).toHaveLength(1);
      expect(fantasyStories[0].genre).toBe('fantasy');
      expect(fantasyStories[0].id).toBe('fantasy-dragon-quest');
    });

    it('should return stories for each genre', async () => {
      const sciFiStories = await storyService.getStoriesByGenre('sci-fi');
      expect(sciFiStories).toHaveLength(1);
      expect(sciFiStories[0].genre).toBe('sci-fi');

      const mysteryStories = await storyService.getStoriesByGenre('mystery');
      expect(mysteryStories).toHaveLength(1);
      expect(mysteryStories[0].genre).toBe('mystery');

      const adventureStories = await storyService.getStoriesByGenre('adventure');
      expect(adventureStories).toHaveLength(1);
      expect(adventureStories[0].genre).toBe('adventure');

      const horrorStories = await storyService.getStoriesByGenre('horror');
      expect(horrorStories).toHaveLength(1);
      expect(horrorStories[0].genre).toBe('horror');
    });
  });

  describe('getAvailableGenres', () => {
    it('should return all unique genres', async () => {
      const genres = await storyService.getAvailableGenres();
      
      expect(genres).toHaveLength(5);
      expect(genres).toContain('fantasy');
      expect(genres).toContain('sci-fi');
      expect(genres).toContain('mystery');
      expect(genres).toContain('adventure');
      expect(genres).toContain('horror');
    });

    it('should return unique genres only', async () => {
      const genres = await storyService.getAvailableGenres();
      const uniqueGenres = [...new Set(genres)];
      
      expect(genres).toHaveLength(uniqueGenres.length);
    });
  });

  describe('searchStories', () => {
    it('should find stories by title', async () => {
      const results = await storyService.searchStories('Дракон');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Дракон');
    });

    it('should find stories by description', async () => {
      const results = await storyService.searchStories('космической станции');
      
      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('космической станции');
    });

    it('should be case insensitive', async () => {
      const results = await storyService.searchStories('ДРАКОН');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Дракон');
    });

    it('should return empty array when no matches found', async () => {
      const results = await storyService.searchStories('nonexistent');
      
      expect(results).toHaveLength(0);
    });

    it('should return multiple results when multiple stories match', async () => {
      const results = await storyService.searchStories('вы');
      
      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe('getRandomStory', () => {
    it('should return a story', async () => {
      const story = await storyService.getRandomStory();
      
      expect(story).not.toBeNull();
      expect(story).toHaveProperty('id');
      expect(story).toHaveProperty('title');
    });

    it('should return different stories on multiple calls (probabilistic)', async () => {
      const stories = [];
      for (let i = 0; i < 10; i++) {
        const story = await storyService.getRandomStory();
        stories.push(story?.id);
      }
      
      // With 5 stories and 10 calls, we should get some variety
      const uniqueIds = new Set(stories);
      expect(uniqueIds.size).toBeGreaterThan(1);
    });
  });

  describe('storyExists', () => {
    it('should return true for existing story', async () => {
      const exists = await storyService.storyExists('fantasy-dragon-quest');
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existing story', async () => {
      const exists = await storyService.storyExists('non-existent-id');
      
      expect(exists).toBe(false);
    });
  });

  describe('getStoriesCount', () => {
    it('should return correct number of stories', () => {
      const count = storyService.getStoriesCount();
      
      expect(count).toBe(5);
    });
  });

  describe('reloadStories', () => {
    it('should reload stories without error', async () => {
      await expect(storyService.reloadStories()).resolves.not.toThrow();
      
      const count = storyService.getStoriesCount();
      expect(count).toBe(5);
    });
  });

  describe('Story data validation', () => {
    it('should have all required fields for each story', async () => {
      const stories = await storyService.getAllStories();
      
      stories.forEach((story: Story) => {
        expect(story.id).toBeTruthy();
        expect(story.title).toBeTruthy();
        expect(story.description).toBeTruthy();
        expect(story.genre).toBeTruthy();
        expect(story.initialPrompt).toBeTruthy();
        expect(story.characterContext).toBeTruthy();
        expect(Array.isArray(story.gameRules)).toBe(true);
        expect(story.gameRules.length).toBeGreaterThan(0);
        expect(story.createdAt).toBeInstanceOf(Date);
        expect(story.updatedAt).toBeInstanceOf(Date);
      });
    });

    it('should have valid genre values', async () => {
      const stories = await storyService.getAllStories();
      const validGenres: Story['genre'][] = ['fantasy', 'sci-fi', 'mystery', 'adventure', 'horror'];
      
      stories.forEach((story: Story) => {
        expect(validGenres).toContain(story.genre);
      });
    });

    it('should have unique story IDs', async () => {
      const stories = await storyService.getAllStories();
      const ids = stories.map(story => story.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});