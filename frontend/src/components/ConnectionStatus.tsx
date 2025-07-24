import React from 'react';
import { ConnectionState, ConnectionHealth } from '../services/ConnectionManager';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  connectionHealth?: ConnectionHealth;
  onManualReconnect?: () => void;
  isOffline?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  connectionHealth,
  onManualReconnect,
  isOffline = false,
  className = ''
}) => {
  const getStatusColor = (status: ConnectionState['status']) => {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-blue-400';
      case 'reconnecting':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      case 'disconnected':
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: ConnectionState['status']) => {
    const baseClasses = 'w-2 h-2 rounded-full';
    
    switch (status) {
      case 'connected':
        return `${baseClasses} bg-green-400`;
      case 'connecting':
        return `${baseClasses} bg-blue-400 animate-pulse`;
      case 'reconnecting':
        return `${baseClasses} bg-yellow-400 animate-pulse`;
      case 'failed':
        return `${baseClasses} bg-red-400`;
      case 'disconnected':
      default:
        return `${baseClasses} bg-gray-400`;
    }
  };

  const getStatusText = (status: ConnectionState['status']) => {
    switch (status) {
      case 'connected':
        return 'Подключено';
      case 'connecting':
        return 'Подключение...';
      case 'reconnecting':
        return `Переподключение (${connectionState.reconnectAttempts})`;
      case 'failed':
        return 'Ошибка подключения';
      case 'disconnected':
      default:
        return 'Отключено';
    }
  };

  const getQualityColor = (quality: ConnectionState['quality']) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-blue-400';
      case 'poor':
        return 'text-yellow-400';
      case 'critical':
      default:
        return 'text-red-400';
    }
  };

  const getQualityText = (quality: ConnectionState['quality']) => {
    switch (quality) {
      case 'excellent':
        return 'Отлично';
      case 'good':
        return 'Хорошо';
      case 'poor':
        return 'Плохо';
      case 'critical':
      default:
        return 'Критично';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-400';
    if (latency < 300) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    } else if (minutes > 0) {
      return `${minutes}м ${seconds % 60}с`;
    } else {
      return `${seconds}с`;
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        <span className="mr-2">Соединение</span>
        <div className={getStatusIcon(connectionState.status)}></div>
      </h3>

      <div className="space-y-3">
        {/* Main Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Статус:</span>
          <div className="flex items-center space-x-2">
            <div className={getStatusIcon(connectionState.status)}></div>
            <span className={`text-sm ${getStatusColor(connectionState.status)}`}>
              {getStatusText(connectionState.status)}
            </span>
          </div>
        </div>

        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Сеть:</span>
          <span className={`text-sm ${isOffline ? 'text-red-400' : 'text-green-400'}`}>
            {isOffline ? 'Офлайн' : 'Онлайн'}
          </span>
        </div>

        {/* Connection Quality */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Качество:</span>
          <span className={`text-sm ${getQualityColor(connectionState.quality)}`}>
            {getQualityText(connectionState.quality)}
          </span>
        </div>

        {/* Latency (only when connected) */}
        {connectionState.status === 'connected' && connectionState.latency !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Задержка:</span>
            <span className={`text-sm ${getLatencyColor(connectionState.latency)}`}>
              {connectionState.latency}мс
            </span>
          </div>
        )}

        {/* Last Connected Time */}
        {connectionState.lastConnected && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Подключен:</span>
            <span className="text-sm text-gray-300">
              {connectionState.lastConnected.toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Connection Uptime */}
        {connectionHealth && connectionHealth.isConnected && connectionHealth.uptime > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Время работы:</span>
            <span className="text-sm text-gray-300">
              {formatUptime(connectionHealth.uptime)}
            </span>
          </div>
        )}

        {/* Reconnection Progress */}
        {connectionState.status === 'reconnecting' && (
          <div className="mt-3 p-2 bg-yellow-900/30 rounded border border-yellow-600/30">
            <div className="flex items-center space-x-2 text-yellow-400 text-sm">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
              <span>Переподключение... (попытка {connectionState.reconnectAttempts})</span>
            </div>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
              <div 
                className="bg-yellow-400 h-1 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((connectionState.reconnectAttempts / 10) * 100, 100)}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Connecting Progress */}
        {connectionState.status === 'connecting' && (
          <div className="mt-3 p-2 bg-blue-900/30 rounded border border-blue-600/30">
            <div className="flex items-center space-x-2 text-blue-400 text-sm">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
              <span>Подключение к серверу...</span>
            </div>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
              <div className="bg-blue-400 h-1 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Connection Failed State */}
        {connectionState.status === 'failed' && (
          <div className="mt-3 p-2 bg-red-900/30 rounded border border-red-600/30">
            <div className="text-red-400 text-sm mb-2">
              Не удалось подключиться после {connectionState.reconnectAttempts} попыток
            </div>
            <div className="text-xs text-red-300">
              Проверьте соединение или попробуйте позже
            </div>
          </div>
        )}

        {/* Manual Reconnect Button */}
        {(connectionState.status === 'failed' || connectionState.status === 'disconnected') && 
         !isOffline && onManualReconnect && (
          <button
            onClick={onManualReconnect}
            className="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Переподключиться к серверу"
          >
            Переподключиться
          </button>
        )}

        {/* Offline Mode Indicator */}
        {isOffline && (
          <div className="mt-3 p-2 bg-gray-700 rounded border border-gray-600">
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0 0L5.636 18.364m12.728-12.728L18.364 18.364M12 12l-7.07-7.07m14.14 14.14L12 12" />
              </svg>
              <span>Автономный режим</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Некоторые функции недоступны
            </div>
          </div>
        )}

        {/* Connection Statistics (if available) */}
        {connectionHealth && connectionHealth.reconnectCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Переподключений:</span>
                <span>{connectionHealth.reconnectCount}</span>
              </div>
              {connectionHealth.errorCount > 0 && (
                <div className="flex justify-between">
                  <span>Ошибок:</span>
                  <span className="text-yellow-400">{connectionHealth.errorCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;