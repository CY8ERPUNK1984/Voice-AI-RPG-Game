import React, { useEffect, useRef, useState } from 'react';
import { AudioPlayerProps } from '@/types';
import { TTSIntegration } from '@/services/TTSIntegration';
import { LoadingSpinner } from './LoadingSpinner';

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  autoPlay = false,
  onPlaybackComplete
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTTSUrl, setIsTTSUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const ttsIntegrationRef = useRef<TTSIntegration | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(null);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setLoadingProgress(0);
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const buffered = audio.buffered.end(audio.buffered.length - 1);
        const progress = (buffered / audio.duration) * 100;
        setLoadingProgress(progress);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsPaused(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      onPlaybackComplete();
    };

    const handleError = () => {
      setError('Failed to load audio');
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onPlaybackComplete]);

  useEffect(() => {
    // Check if this is a TTS URL
    const isTTS = audioUrl.startsWith('tts:');
    setIsTTSUrl(isTTS);
    
    if (isTTS) {
      // Initialize TTS integration with default settings
      if (!ttsIntegrationRef.current) {
        ttsIntegrationRef.current = new TTSIntegration({
          ttsEnabled: true,
          ttsVolume: 1.0,
          asrSensitivity: 0.5,
          voiceSpeed: 1.0
        });
      }
    }

    if (autoPlay && audioUrl) {
      handlePlay();
    }
  }, [audioUrl, autoPlay]);

  const handlePlay = async () => {
    if (isTTSUrl && ttsIntegrationRef.current) {
      try {
        setIsLoading(true);
        setIsPlaying(true);
        setError(null);
        await ttsIntegrationRef.current.playFromUrl(audioUrl);
        setIsLoading(false);
        setIsPlaying(false);
        onPlaybackComplete();
      } catch (err) {
        setError('Failed to play TTS audio');
        setIsLoading(false);
        setIsPlaying(false);
        console.error('TTS play error:', err);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    try {
      await audio.play();
    } catch (err) {
      setError('Failed to play audio');
      console.error('Audio play error:', err);
    }
  };

  const handlePause = () => {
    if (isTTSUrl && ttsIntegrationRef.current) {
      ttsIntegrationRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
  };

  const handleStop = () => {
    if (isTTSUrl && ttsIntegrationRef.current) {
      ttsIntegrationRef.current.stop();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
      
      <div className="flex items-center space-x-4">
        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={!audioUrl}
          className="flex items-center justify-center w-12 h-12 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-full transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          disabled={!audioUrl || (!isPlaying && !isPaused)}
          className="flex items-center justify-center w-10 h-10 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Progress Bar */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || duration === 0}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      {isLoading && (
        <div className="mt-2 flex items-center text-sm text-blue-600">
          <LoadingSpinner size="sm" color="blue" className="mr-2" />
          <span>Loading audio...</span>
          {loadingProgress > 0 && (
            <span className="ml-2 text-xs">({Math.round(loadingProgress)}%)</span>
          )}
        </div>
      )}
      
      {isPlaying && !isLoading && (
        <div className="mt-2 flex items-center text-sm text-blue-600">
          <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
          Playing audio...
        </div>
      )}
    </div>
  );
};