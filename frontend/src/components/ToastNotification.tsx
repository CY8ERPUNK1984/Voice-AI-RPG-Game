import React, { useState, useEffect, useRef } from 'react';
import { ToastNotification as ToastType, ToastAction } from '@/types';
import { errorHandler } from '@/services/ErrorHandler';
import { errorManager } from '@/services/ErrorManager';

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
  onDismiss: (id: string) => void;
  isPersistent?: boolean;
}

interface ToastQueueItem extends ToastType {
  priority: number;
  persistent: boolean;
  dismissed: boolean;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose, onDismiss, isPersistent = false }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Auto-dismiss timer (only if not persistent)
    if (!isPersistent && toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, toast.duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration, isPersistent]);

  // Accessibility: announce to screen readers
  useEffect(() => {
    if (toastRef.current) {
      toastRef.current.setAttribute('aria-live', toast.type === 'error' ? 'assertive' : 'polite');
      toastRef.current.setAttribute('aria-atomic', 'true');
    }
  }, [toast.type]);

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose(toast.id);
    }, 300); // Animation duration
  };

  const handleDismiss = () => {
    onDismiss(toast.id);
    handleClose();
  };

  const handleActionClick = async (action: ToastAction) => {
    setIsExecutingAction(true);
    try {
      await action.action();
      if (!action.keepToastOpen) {
        handleClose();
      }
    } catch (error) {
      console.error('Toast action failed:', error);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const resumeTimer = () => {
    if (!isPersistent && toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, toast.duration);
    }
  };

  if (!isVisible) return null;

  const getToastStyles = () => {
    const baseStyles = "flex items-start p-4 rounded-lg shadow-lg border transition-all duration-300 transform";
    const exitStyles = isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0";
    
    switch (toast.type) {
      case 'error':
        return `${baseStyles} ${exitStyles} bg-red-900 border-red-700 text-red-100`;
      case 'warning':
        return `${baseStyles} ${exitStyles} bg-yellow-900 border-yellow-700 text-yellow-100`;
      case 'success':
        return `${baseStyles} ${exitStyles} bg-green-900 border-green-700 text-green-100`;
      case 'info':
      default:
        return `${baseStyles} ${exitStyles} bg-blue-900 border-blue-700 text-blue-100`;
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div 
      ref={toastRef}
      className={getToastStyles()}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={resumeTimer}
      role="alert"
      tabIndex={-1}
    >
      {getIcon()}
      <div className="ml-3 flex-1">
        <h4 className="font-medium text-sm" id={`toast-title-${toast.id}`}>
          {toast.title}
        </h4>
        <p className="text-sm opacity-90 mt-1" id={`toast-message-${toast.id}`}>
          {toast.message}
        </p>
        
        {/* Action buttons */}
        {toast.actions && toast.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {toast.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action)}
                disabled={isExecutingAction}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                  action.primary
                    ? 'bg-white text-gray-900 hover:bg-gray-100 focus:ring-white disabled:bg-gray-300'
                    : 'bg-transparent border border-current hover:bg-white hover:bg-opacity-10 focus:ring-current disabled:opacity-50'
                }`}
                aria-describedby={`toast-message-${toast.id}`}
              >
                {isExecutingAction && action.primary ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Выполняется...
                  </>
                ) : (
                  action.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Close button */}
      <div className="ml-4 flex flex-col items-end">
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 rounded"
          aria-label={`Закрыть уведомление: ${toast.title}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Persistent indicator */}
        {isPersistent && (
          <div className="mt-2 flex items-center">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <button
              onClick={handleDismiss}
              className="ml-1 text-xs text-gray-400 hover:text-white underline focus:outline-none focus:ring-1 focus:ring-white"
              aria-label="Скрыть это уведомление навсегда"
            >
              Скрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toastQueue, setToastQueue] = useState<ToastQueueItem[]>([]);
  const [dismissedToasts, setDismissedToasts] = useState<Set<string>>(new Set());
  const maxToasts = 5; // Maximum number of toasts to show at once
  const persistenceKey = 'voice-ai-rpg-dismissed-toasts';

  // Load dismissed toasts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(persistenceKey);
      if (stored) {
        setDismissedToasts(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.warn('Failed to load dismissed toasts:', error);
    }
  }, []);

  // Save dismissed toasts to localStorage
  const saveDismissedToasts = (dismissed: Set<string>) => {
    try {
      localStorage.setItem(persistenceKey, JSON.stringify(Array.from(dismissed)));
    } catch (error) {
      console.warn('Failed to save dismissed toasts:', error);
    }
  };

  // Subscribe to toast notifications from both error systems
  useEffect(() => {
    const unsubscribeErrorHandler = errorHandler.onToast((toast) => {
      addToastToQueue(toast);
    });

    const unsubscribeErrorManager = errorManager.onToast((toast) => {
      addToastToQueue(toast);
    });

    return () => {
      unsubscribeErrorHandler();
      unsubscribeErrorManager();
    };
  }, []);

  const addToastToQueue = (toast: ToastType) => {
    // Check if this toast type has been dismissed
    const toastKey = `${toast.type}-${toast.title}`;
    if (dismissedToasts.has(toastKey)) {
      return;
    }

    const priority = getPriority(toast.type);
    const persistent = toast.type === 'error' && toast.title.includes('Критическая');
    
    const queueItem: ToastQueueItem = {
      ...toast,
      priority,
      persistent,
      dismissed: false
    };

    setToastQueue(prev => {
      // Remove duplicate toasts (same type and title)
      const filtered = prev.filter(item => 
        !(item.type === toast.type && item.title === toast.title)
      );
      
      // Add new toast and sort by priority
      const newQueue = [...filtered, queueItem].sort((a, b) => b.priority - a.priority);
      
      // Limit to max toasts, keeping highest priority ones
      return newQueue.slice(0, maxToasts);
    });
  };

  const getPriority = (type: ToastType['type']): number => {
    switch (type) {
      case 'error': return 4;
      case 'warning': return 3;
      case 'info': return 2;
      case 'success': return 1;
      default: return 0;
    }
  };

  const handleCloseToast = (id: string) => {
    setToastQueue(prev => prev.filter(toast => toast.id !== id));
  };

  const handleDismissToast = (id: string) => {
    const toast = toastQueue.find(t => t.id === id);
    if (toast) {
      const toastKey = `${toast.type}-${toast.title}`;
      const newDismissed = new Set(dismissedToasts).add(toastKey);
      setDismissedToasts(newDismissed);
      saveDismissedToasts(newDismissed);
    }
    handleCloseToast(id);
  };

  // Clear dismissed toasts (for development/testing)
  const clearDismissedToasts = () => {
    setDismissedToasts(new Set());
    localStorage.removeItem(persistenceKey);
  };

  // Expose clear function globally for debugging
  useEffect(() => {
    (window as any).clearDismissedToasts = clearDismissedToasts;
    return () => {
      delete (window as any).clearDismissedToasts;
    };
  }, []);

  if (toastQueue.length === 0) return null;

  return (
    <>
      {/* Main toast container */}
      <div 
        className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full"
        role="region"
        aria-label="Уведомления"
        aria-live="polite"
      >
        {toastQueue.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={handleCloseToast}
            onDismiss={handleDismissToast}
            isPersistent={toast.persistent}
          />
        ))}
      </div>

      {/* Toast counter for screen readers */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {toastQueue.length > 0 && `${toastQueue.length} активных уведомлений`}
      </div>

      {/* Keyboard shortcut hint (only show if there are toasts) */}
      {toastQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded opacity-50 hover:opacity-100 transition-opacity">
            ESC - закрыть все уведомления
          </div>
        </div>
      )}
    </>
  );
};

// Keyboard shortcut handler
export const useToastKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Clear all toasts
        const toastElements = document.querySelectorAll('[role="alert"]');
        toastElements.forEach(element => {
          const closeButton = element.querySelector('button[aria-label*="Закрыть"]') as HTMLButtonElement;
          if (closeButton) {
            closeButton.click();
          }
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};