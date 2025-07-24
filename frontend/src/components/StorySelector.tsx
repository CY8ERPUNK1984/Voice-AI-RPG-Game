import React, { useState, useEffect } from 'react';
import { Story, StorySelectorProps } from '../types';
import { SkeletonLoader } from './SkeletonLoader';

const StorySelector: React.FC<StorySelectorProps> = ({ stories, onStorySelect, isLoading = false }) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredStories, setFilteredStories] = useState<Story[]>(stories);

  // Get unique genres from stories
  const genres = ['all', ...Array.from(new Set(stories.map(story => story.genre)))];

  // Filter stories based on genre and search query
  useEffect(() => {
    let filtered = stories;

    // Filter by genre
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(story => story.genre === selectedGenre);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(story => 
        story.title.toLowerCase().includes(query) ||
        story.description.toLowerCase().includes(query)
      );
    }

    setFilteredStories(filtered);
  }, [stories, selectedGenre, searchQuery]);

  const getGenreColor = (genre: string): string => {
    const colors: Record<string, string> = {
      fantasy: 'bg-purple-100 text-purple-800',
      'sci-fi': 'bg-blue-100 text-blue-800',
      mystery: 'bg-gray-100 text-gray-800',
      adventure: 'bg-green-100 text-green-800',
      horror: 'bg-red-100 text-red-800'
    };
    return colors[genre] || 'bg-gray-100 text-gray-800';
  };

  const getGenreLabel = (genre: string): string => {
    const labels: Record<string, string> = {
      fantasy: 'Фэнтези',
      'sci-fi': 'Научная фантастика',
      mystery: 'Детектив',
      adventure: 'Приключения',
      horror: 'Хоррор',
      all: 'Все жанры'
    };
    return labels[genre] || genre;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Выберите историю для игры
        </h1>
        <p className="text-gray-600">
          Погрузитесь в интерактивное приключение с голосовым управлением
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Genre Filter */}
        <div className="flex flex-wrap gap-2">
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedGenre === genre
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getGenreLabel(genre)}
            </button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLoader key={index} variant="rectangular" height={200} className="rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map(story => (
          <div
            key={story.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
            onClick={() => onStorySelect(story)}
          >
            <div className="p-6">
              {/* Genre Badge */}
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getGenreColor(story.genre)}`}>
                  {getGenreLabel(story.genre)}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
                {story.title}
              </h3>

              {/* Description */}
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {story.description}
              </p>

              {/* Play Button */}
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Начать игру
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* No Results */}
      {filteredStories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Истории не найдены
          </h3>
          <p className="text-gray-600">
            Попробуйте изменить фильтры или поисковый запрос
          </p>
        </div>
      )}

      {/* Stories Count */}
      {filteredStories.length > 0 && (
        <div className="text-center mt-8 text-sm text-gray-500">
          Показано {filteredStories.length} из {stories.length} историй
        </div>
      )}
    </div>
  );
};

export default StorySelector;