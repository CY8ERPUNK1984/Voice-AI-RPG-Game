import React, { useEffect, useState } from 'react';
import { AudioSettings, SettingsPanelProps } from '@/types';

const STORAGE_KEY = 'voice-ai-rpg-audio-settings';

const DEFAULT_SETTINGS: AudioSettings = {
  ttsEnabled: true,
  ttsVolume: 0.8,
  asrSensitivity: 0.7,
  voiceSpeed: 1.0,
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const [localSettings, setLocalSettings] = useState<AudioSettings>(settings);
  const [isOpen, setIsOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = loadSettingsFromStorage();
    if (savedSettings) {
      setLocalSettings(savedSettings);
      onSettingsChange(savedSettings);
    }
  }, [onSettingsChange]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveSettingsToStorage(localSettings);
  }, [localSettings]);

  const handleSettingChange = (key: keyof AudioSettings, value: boolean | number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    onSettingsChange(DEFAULT_SETTINGS);
  };

  return (
    <div className="relative">
      {/* Settings Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        aria-label="Open audio settings"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Audio Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* TTS Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="tts-enabled" className="text-sm font-medium text-gray-700">
                Text-to-Speech
              </label>
              <button
                id="tts-enabled"
                onClick={() => handleSettingChange('ttsEnabled', !localSettings.ttsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.ttsEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={localSettings.ttsEnabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.ttsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* TTS Volume */}
            <div className="space-y-2">
              <label htmlFor="tts-volume" className="text-sm font-medium text-gray-700">
                TTS Volume: {Math.round(localSettings.ttsVolume * 100)}%
              </label>
              <input
                id="tts-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localSettings.ttsVolume}
                onChange={(e) => handleSettingChange('ttsVolume', parseFloat(e.target.value))}
                disabled={!localSettings.ttsEnabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* ASR Sensitivity */}
            <div className="space-y-2">
              <label htmlFor="asr-sensitivity" className="text-sm font-medium text-gray-700">
                Microphone Sensitivity: {Math.round(localSettings.asrSensitivity * 100)}%
              </label>
              <input
                id="asr-sensitivity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localSettings.asrSensitivity}
                onChange={(e) => handleSettingChange('asrSensitivity', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Voice Speed */}
            <div className="space-y-2">
              <label htmlFor="voice-speed" className="text-sm font-medium text-gray-700">
                Speech Speed: {localSettings.voiceSpeed}x
              </label>
              <input
                id="voice-speed"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={localSettings.voiceSpeed}
                onChange={(e) => handleSettingChange('voiceSpeed', parseFloat(e.target.value))}
                disabled={!localSettings.ttsEnabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={resetToDefaults}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions for localStorage
function loadSettingsFromStorage(): AudioSettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load audio settings from localStorage:', error);
  }
  return null;
}

function saveSettingsToStorage(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save audio settings to localStorage:', error);
  }
}

export default SettingsPanel;