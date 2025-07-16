import { Story } from '../types';
import storiesData from '../data/stories.json';

export class StoryService {
  private stories: Story[];

  constructor() {
    // Convert JSON data to Story objects with proper Date objects
    this.stories = storiesData.map(story => ({
      ...story,
      createdAt: new Date(story.createdAt),
      updatedAt: new Date(story.updatedAt)
    }));
  }

  /**
   * Get all available stories
   */
  async getAllStories(): Promise<Story[]> {
    return [...this.stories];
  }

  /**
   * Get a story by its ID
   */
  async getStoryById(id: string): Promise<Story | null> {
    const story = this.stories.find(s => s.id === id);
    return story ? { ...story } : null;
  }

  /**
   * Get stories filtered by genre
   */
  async getStoriesByGenre(genre: Story['genre']): Promise<Story[]> {
    return this.stories.filter(story => story.genre === genre);
  }

  /**
   * Get all available genres
   */
  async getAvailableGenres(): Promise<Story['genre'][]> {
    const genres = new Set(this.stories.map(story => story.genre));
    return Array.from(genres);
  }

  /**
   * Search stories by title or description
   */
  async searchStories(query: string): Promise<Story[]> {
    const lowercaseQuery = query.toLowerCase();
    return this.stories.filter(story => 
      story.title.toLowerCase().includes(lowercaseQuery) ||
      story.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get a random story
   */
  async getRandomStory(): Promise<Story | null> {
    if (this.stories.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.stories.length);
    return { ...this.stories[randomIndex] };
  }

  /**
   * Check if a story exists
   */
  async storyExists(id: string): Promise<boolean> {
    return this.stories.some(story => story.id === id);
  }

  /**
   * Get stories count
   */
  getStoriesCount(): number {
    return this.stories.length;
  }
}

// Export a singleton instance
export const storyService = new StoryService();