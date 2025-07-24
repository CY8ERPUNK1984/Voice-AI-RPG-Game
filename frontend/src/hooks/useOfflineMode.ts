import { useEffect } from 'react';
import { errorHandler } from '../services/ErrorHandler';
import { useApp } from '../contexts/AppContext';
import { useConnection } from '../contexts/ConnectionContext';

export function useOfflineMode() {
  const { state, setOfflineMode } = useApp();
  const { connectionManager, connectionState } = useConnection();

  useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false);
      errorHandler.showToast({
        type: 'success',
        title: 'Соединение восстановлено',
        message: 'Интернет-соединение восстановлено'
      });
      
      // Attempt to reconnect if we have a connection manager
      if (connectionManager && connectionState.status === 'disconnected') {
        connectionManager.connect().catch(error => {
          console.error('Failed to reconnect after coming online:', error);
          errorHandler.handleConnectionError(error);
        });
      }
    };

    const handleOffline = () => {
      setOfflineMode(true);
      errorHandler.showToast({
        type: 'warning',
        title: 'Нет соединения',
        message: 'Переход в автономный режим. Некоторые функции недоступны.'
      });
      
      // Disconnect connection manager when going offline
      if (connectionManager) {
        connectionManager.disconnect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionManager, connectionState.status, setOfflineMode]);

  return state.offlineMode;
}