import { Story } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class StoryService {
  private stories: Story[];
  private dataPath: string;

  constructor() {
    // Use path relative to the current working directory when running tests
    this.dataPath = path.join(process.cwd(), 'src/data/stories.json');
    this.loadStories();
  }

  private loadStories(): void {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      const storiesData = JSON.parse(data);
      
      // Convert JSON data to Story objects with proper Date objects
      this.stories = storiesData.map((story: any) => ({
        ...story,
        createdAt: new Date(story.createdAt),
        updatedAt: new Date(story.updatedAt)
      }));
    } catch (error) {
      console.error('Error loading stories:', error);
      this.stories = [];
    }
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

  /**
   * Validate story data structure
   */
  private validateStory(story: any): story is Story {
    return (
      typeof story.id === 'string' &&
      typeof story.title === 'string' &&
      typeof story.description === 'string' &&
      ['fantasy', 'sci-fi', 'mystery', 'adventure', 'horror'].includes(story.genre) &&
      typeof story.initialPrompt === 'string' &&
      typeof story.characterContext === 'string' &&
      Array.isArray(story.gameRules) &&
      story.gameRules.every((rule: any) => typeof rule === 'string')
    );
  }

  /**
   * Reload stories from file (useful for development)
   */
  async reloadStories(): Promise<void> {
    this.loadStories();
  }
}

// Export a singleton instance
export const storyService = new StoryService();