import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AudioSettings } from '../types';
import { useConnection } from './ConnectionContext';
import { errorHandler } from '../services/ErrorHandler';

// Settings Context Types
interface SettingsContextValue {
  audioSettings: AudioSettings;
  updateSettings: (newSettings: AudioSettings) => Promise<void>;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Default settings
const defaultAudioSettings: AudioSettings = {
  ttsEnabled: true,
  ttsVolume: 0.8,
  asrSensitivity: 0.7,
  voiceSpeed: 1.0,
};

// Provider Component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { sendMessage, isConnected } = useConnection();
  
  // Load settings from localStorage on initialization
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    const saved = localStorage.getItem('audioSettings');
    return saved ? JSON.parse(saved) : defaultAudioSettings;
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
  }, [audioSettings]);

  const updateSettings = async (newSettings: AudioSettings) => {
    setAudioSettings(newSettings);

    // Update session settings if connected
    if (isConnected) {
      try {
        await sendMessage('update-settings', newSettings);
      } catch (error) {
        console.error('Failed to update settings on server:', error);
        errorHandler.showToast({
          type: 'warning',
          title: 'Настройки',
          message: 'Не удалось обновить настройки на сервере'
        });
      }
    }
  };

  const resetSettings = () => {
    setAudioSettings(defaultAudioSettings);
    errorHandler.showToast({
      type: 'info',
      title: 'Настройки',
      message: 'Настройки сброшены к значениям по умолчанию'
    });
  };

  const value: SettingsContextValue = {
    audioSettings,
    updateSettings,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook to use the context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}