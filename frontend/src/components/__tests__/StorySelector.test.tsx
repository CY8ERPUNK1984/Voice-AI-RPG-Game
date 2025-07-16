import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StorySelector from '../StorySelector';
import { Story } from '../../types';

// Mock stories data for testing
const mockStories: Story[] = [
  {
    id: 'fantasy-dragon-quest',
    title: 'Поиск Древнего Дракона',
    description: 'Вы - молодой авантюрист в мире магии и чудес.',
    genre: 'fantasy',
    initialPrompt: 'Test prompt',
    characterContext: 'Test context',
    gameRules: ['Rule 1'],
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z')
  },
  {
    id: 'scifi-space-station',
    title: 'Станция Новая Надежда',
    description: '2387 год. Вы - инженер на космической станции.',
    genre: 'sci-fi',
    initialPrompt: 'Test prompt',
    characterContext: 'Test context',
    gameRules: ['Rule 1'],
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z')
  },
  {
    id: 'mystery-mansion',
    title: 'Тайна Особняка Блэквуд',
    description: 'Вы - частный детектив в старинном особняке.',
    genre: 'mystery',
    initialPrompt: 'Test prompt',
    characterContext: 'Test context',
    gameRules: ['Rule 1'],
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z')
  }
];

describe('StorySelector', () => {
  const mockOnStorySelect = vi.fn();

  beforeEach(() => {
    mockOnStorySelect.mockClear();
  });

  it('renders story selector with title and description', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    expect(screen.getByText('Выберите историю для игры')).toBeInTheDocument();
    expect(screen.getByText('Погрузитесь в интерактивное приключение с голосовым управлением')).toBeInTheDocument();
  });

  it('displays all stories by default', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    expect(screen.getByText('Поиск Древнего Дракона')).toBeInTheDocument();
    expect(screen.getByText('Станция Новая Надежда')).toBeInTheDocument();
    expect(screen.getByText('Тайна Особняка Блэквуд')).toBeInTheDocument();
  });

  it('displays genre filters', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    expect(screen.getByText('Все жанры')).toBeInTheDocument();
    expect(screen.getAllByText('Фэнтези').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Научная фантастика').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Детектив').length).toBeGreaterThan(0);
  });

  it('filters stories by genre', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    // Click on fantasy genre filter button (first occurrence)
    const fantasyButton = screen.getAllByText('Фэнтези')[0];
    fireEvent.click(fantasyButton);
    
    await waitFor(() => {
      expect(screen.getByText('Поиск Древнего Дракона')).toBeInTheDocument();
      expect(screen.queryByText('Станция Новая Надежда')).not.toBeInTheDocument();
      expect(screen.queryByText('Тайна Особняка Блэквуд')).not.toBeInTheDocument();
    });
  });

  it('filters stories by search query', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    const searchInput = screen.getByPlaceholderText('Поиск по названию или описанию...');
    fireEvent.change(searchInput, { target: { value: 'дракон' } });
    
    await waitFor(() => {
      expect(screen.getByText('Поиск Древнего Дракона')).toBeInTheDocument();
      expect(screen.queryByText('Станция Новая Надежда')).not.toBeInTheDocument();
      expect(screen.queryByText('Тайна Особняка Блэквуд')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when no stories match filters', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    const searchInput = screen.getByPlaceholderText('Поиск по названию или описанию...');
    fireEvent.change(searchInput, { target: { value: 'несуществующая история' } });
    
    await waitFor(() => {
      expect(screen.getByText('Истории не найдены')).toBeInTheDocument();
      expect(screen.getByText('Попробуйте изменить фильтры или поисковый запрос')).toBeInTheDocument();
    });
  });

  it('calls onStorySelect when story card is clicked', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    const storyCard = screen.getByText('Поиск Древнего Дракона').closest('div');
    fireEvent.click(storyCard!);
    
    expect(mockOnStorySelect).toHaveBeenCalledWith(mockStories[0]);
  });

  it('calls onStorySelect when play button is clicked', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    const playButtons = screen.getAllByText('Начать игру');
    fireEvent.click(playButtons[0]);
    
    expect(mockOnStorySelect).toHaveBeenCalledWith(mockStories[0]);
  });

  it('displays story count', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    expect(screen.getByText('Показано 3 из 3 историй')).toBeInTheDocument();
  });

  it('updates story count when filtered', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    // Filter by fantasy genre (first occurrence is the button)
    const fantasyButton = screen.getAllByText('Фэнтези')[0];
    fireEvent.click(fantasyButton);
    
    await waitFor(() => {
      expect(screen.getByText('Показано 1 из 3 историй')).toBeInTheDocument();
    });
  });

  it('displays genre badges with correct colors', () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    const fantasyBadge = screen.getAllByText('Фэнтези')[1]; // Second one is the badge, first is filter
    const scifiBadges = screen.getAllByText('Научная фантастика');
    const scifiBadge = scifiBadges[1]; // Second one is the badge, first is filter
    const mysteryBadges = screen.getAllByText('Детектив');
    const mysteryBadge = mysteryBadges[1]; // Second one is the badge, first is filter
    
    expect(fantasyBadge).toHaveClass('bg-purple-100', 'text-purple-800');
    expect(scifiBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(mysteryBadge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('combines genre and search filters', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    // Filter by sci-fi genre (first occurrence is the button)
    const scifiButton = screen.getAllByText('Научная фантастика')[0];
    fireEvent.click(scifiButton);
    
    // Then search for "станция"
    const searchInput = screen.getByPlaceholderText('Поиск по названию или описанию...');
    fireEvent.change(searchInput, { target: { value: 'станция' } });
    
    await waitFor(() => {
      expect(screen.getByText('Станция Новая Надежда')).toBeInTheDocument();
      expect(screen.queryByText('Поиск Древнего Дракона')).not.toBeInTheDocument();
      expect(screen.queryByText('Тайна Особняка Блэквуд')).not.toBeInTheDocument();
      expect(screen.getByText('Показано 1 из 3 историй')).toBeInTheDocument();
    });
  });

  it('resets to all stories when "Все жанры" is selected', async () => {
    render(<StorySelector stories={mockStories} onStorySelect={mockOnStorySelect} />);
    
    // First filter by fantasy (first occurrence is the button)
    const fantasyButton = screen.getAllByText('Фэнтези')[0];
    fireEvent.click(fantasyButton);
    
    await waitFor(() => {
      expect(screen.getByText('Показано 1 из 3 историй')).toBeInTheDocument();
    });
    
    // Then select "Все жанры"
    fireEvent.click(screen.getByText('Все жанры'));
    
    await waitFor(() => {
      expect(screen.getByText('Показано 3 из 3 историй')).toBeInTheDocument();
      expect(screen.getByText('Поиск Древнего Дракона')).toBeInTheDocument();
      expect(screen.getByText('Станция Новая Надежда')).toBeInTheDocument();
      expect(screen.getByText('Тайна Особняка Блэквуд')).toBeInTheDocument();
    });
  });
});