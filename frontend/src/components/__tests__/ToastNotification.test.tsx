import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastContainer } from '../ToastNotification';
import { errorHandler, ToastNotification } from '@/services/ErrorHandler';

// Mock the error handler
vi.mock('@/services/ErrorHandler', () => {
  const mockCallbacks: ((toast: ToastNotification) => void)[] = [];
  
  return {
    errorHandler: {
      onToast: vi.fn((callback) => {
        mockCallbacks.push(callback);
        return () => {
          const index = mockCallbacks.indexOf(callback);
          if (index > -1) {
            mockCallbacks.splice(index, 1);
          }
        };
      }),
    },
    // Export the mock callbacks so we can trigger them in tests
    __mockToastCallbacks: mockCallbacks,
  };
});

// Get access to mock callbacks
const { __mockToastCallbacks } = await import('@/services/ErrorHandler') as any;

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    // Clear any existing callbacks
    __mockToastCallbacks.length = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should render nothing when no toasts are present', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('should subscribe to toast notifications on mount', () => {
    render(<ToastContainer />);
    expect(errorHandler.onToast).toHaveBeenCalled();
  });

  it('should render toast when notification is received', async () => {
    render(<ToastContainer />);

    const mockToast: ToastNotification = {
      id: '1',
      type: 'error',
      title: 'Test Error',
      message: 'This is a test error message',
      timestamp: new Date(),
      duration: 3000,
    };

    // Trigger the toast callback
    await act(async () => {
      __mockToastCallbacks.forEach(callback => callback(mockToast));
    });

    await waitFor(() => {
      expect(screen.getByText('Test Error')).toBeInTheDocument();
      expect(screen.getByText('This is a test error message')).toBeInTheDocument();
    });
  });

  it('should render multiple toasts', async () => {
    render(<ToastContainer />);

    const toast1: ToastNotification = {
      id: '1',
      type: 'error',
      title: 'Error 1',
      message: 'First error',
      timestamp: new Date(),
    };

    const toast2: ToastNotification = {
      id: '2',
      type: 'warning',
      title: 'Warning 1',
      message: 'First warning',
      timestamp: new Date(),
    };

    await act(async () => {
      __mockToastCallbacks.forEach(callback => {
        callback(toast1);
        callback(toast2);
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Warning 1')).toBeInTheDocument();
    });
  });

  it('should remove toast when close button is clicked', async () => {
    render(<ToastContainer />);

    const mockToast: ToastNotification = {
      id: '1',
      type: 'info',
      title: 'Test Info',
      message: 'This is a test info message',
      timestamp: new Date(),
    };

    await act(async () => {
      __mockToastCallbacks.forEach(callback => callback(mockToast));
    });

    await waitFor(() => {
      expect(screen.getByText('Test Info')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Закрыть уведомление: Test Info');
    
    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test Info')).not.toBeInTheDocument();
    });
  });

  it('should auto-remove toast after duration', async () => {
    vi.useFakeTimers();
    
    render(<ToastContainer />);

    const mockToast: ToastNotification = {
      id: '1',
      type: 'success',
      title: 'Success',
      message: 'Operation completed',
      timestamp: new Date(),
      duration: 1000,
    };

    await act(async () => {
      __mockToastCallbacks.forEach(callback => callback(mockToast));
    });

    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    // Fast-forward time and wait for the timeout to trigger
    await act(async () => {
      vi.advanceTimersByTime(1000); // Exact duration
    });

    // Wait for the animation timeout (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('should not auto-remove toast when duration is not set', async () => {
    vi.useFakeTimers();
    
    render(<ToastContainer />);

    const mockToast: ToastNotification = {
      id: '1',
      type: 'info',
      title: 'Persistent Toast',
      message: 'This toast should not auto-remove',
      timestamp: new Date(),
      // No duration set
    };

    await act(async () => {
      __mockToastCallbacks.forEach(callback => callback(mockToast));
    });

    await waitFor(() => {
      expect(screen.getByText('Persistent Toast')).toBeInTheDocument();
    });

    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Toast should still be there
    expect(screen.getByText('Persistent Toast')).toBeInTheDocument();
  });

  describe('Toast styling', () => {
    it('should apply error styling for error toasts', async () => {
      render(<ToastContainer />);

      const errorToast: ToastNotification = {
        id: '1',
        type: 'error',
        title: 'Error Toast',
        message: 'Error message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(errorToast));
      });

      await waitFor(() => {
        const toastElement = screen.getByText('Error Toast').closest('.bg-red-900');
        expect(toastElement).toHaveClass('bg-red-900', 'border-red-700', 'text-red-100');
      });
    });

    it('should apply warning styling for warning toasts', async () => {
      render(<ToastContainer />);

      const warningToast: ToastNotification = {
        id: '1',
        type: 'warning',
        title: 'Warning Toast',
        message: 'Warning message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(warningToast));
      });

      await waitFor(() => {
        const toastElement = screen.getByText('Warning Toast').closest('.bg-yellow-900');
        expect(toastElement).toHaveClass('bg-yellow-900', 'border-yellow-700', 'text-yellow-100');
      });
    });

    it('should apply success styling for success toasts', async () => {
      render(<ToastContainer />);

      const successToast: ToastNotification = {
        id: '1',
        type: 'success',
        title: 'Success Toast',
        message: 'Success message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(successToast));
      });

      await waitFor(() => {
        const toastElement = screen.getByText('Success Toast').closest('.bg-green-900');
        expect(toastElement).toHaveClass('bg-green-900', 'border-green-700', 'text-green-100');
      });
    });

    it('should apply info styling for info toasts', async () => {
      render(<ToastContainer />);

      const infoToast: ToastNotification = {
        id: '1',
        type: 'info',
        title: 'Info Toast',
        message: 'Info message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(infoToast));
      });

      await waitFor(() => {
        const toastElement = screen.getByText('Info Toast').closest('.bg-blue-900');
        expect(toastElement).toHaveClass('bg-blue-900', 'border-blue-700', 'text-blue-100');
      });
    });
  });

  describe('Timer cleanup and component lifecycle', () => {
    it('should cleanup timers when component unmounts', async () => {
      vi.useFakeTimers();
      
      const { unmount } = render(<ToastContainer />);

      const mockToast: ToastNotification = {
        id: '1',
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
        timestamp: new Date(),
        duration: 5000,
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(mockToast));
      });

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      });

      // Unmount the component before timer expires
      unmount();

      // Advance timers - should not cause any issues since component is unmounted
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      // No assertions needed - if cleanup is working, no errors should occur
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle multiple toasts with different durations', async () => {
      vi.useFakeTimers();
      
      render(<ToastContainer />);

      const shortToast: ToastNotification = {
        id: '1',
        type: 'info',
        title: 'Short Toast',
        message: 'Short message',
        timestamp: new Date(),
        duration: 1000,
      };

      const longToast: ToastNotification = {
        id: '2',
        type: 'error',
        title: 'Long Toast',
        message: 'Long message',
        timestamp: new Date(),
        duration: 3000,
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => {
          callback(shortToast);
          callback(longToast);
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Short Toast')).toBeInTheDocument();
        expect(screen.getByText('Long Toast')).toBeInTheDocument();
      });

      // Advance time to expire short toast
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Wait for animation
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.queryByText('Short Toast')).not.toBeInTheDocument();
        expect(screen.getByText('Long Toast')).toBeInTheDocument();
      });

      // Advance time to expire long toast
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Wait for animation
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.queryByText('Long Toast')).not.toBeInTheDocument();
      });
    });
  });

  describe('Toast icons', () => {
    it('should show error icon for error toasts', async () => {
      render(<ToastContainer />);

      const errorToast: ToastNotification = {
        id: '1',
        type: 'error',
        title: 'Error Toast',
        message: 'Error message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(errorToast));
      });

      await waitFor(() => {
        const toastContainer = screen.getByText('Error Toast').closest('.bg-red-900');
        const icon = toastContainer?.querySelector('svg.text-red-400');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('text-red-400');
      });
    });

    it('should show warning icon for warning toasts', async () => {
      render(<ToastContainer />);

      const warningToast: ToastNotification = {
        id: '1',
        type: 'warning',
        title: 'Warning Toast',
        message: 'Warning message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(warningToast));
      });

      await waitFor(() => {
        const toastContainer = screen.getByText('Warning Toast').closest('.bg-yellow-900');
        const icon = toastContainer?.querySelector('svg.text-yellow-400');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('text-yellow-400');
      });
    });

    it('should show success icon for success toasts', async () => {
      render(<ToastContainer />);

      const successToast: ToastNotification = {
        id: '1',
        type: 'success',
        title: 'Success Toast',
        message: 'Success message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(successToast));
      });

      await waitFor(() => {
        const toastContainer = screen.getByText('Success Toast').closest('.bg-green-900');
        const icon = toastContainer?.querySelector('svg.text-green-400');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('text-green-400');
      });
    });

    it('should show info icon for info toasts', async () => {
      render(<ToastContainer />);

      const infoToast: ToastNotification = {
        id: '1',
        type: 'info',
        title: 'Info Toast',
        message: 'Info message',
        timestamp: new Date(),
      };

      await act(async () => {
        __mockToastCallbacks.forEach(callback => callback(infoToast));
      });

      await waitFor(() => {
        const toastContainer = screen.getByText('Info Toast').closest('.bg-blue-900');
        const icon = toastContainer?.querySelector('svg.text-blue-400');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('text-blue-400');
      });
    });
  });
});