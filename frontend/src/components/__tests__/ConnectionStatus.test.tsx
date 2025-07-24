import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectionStatus } from '../ConnectionStatus';
import { ConnectionState, ConnectionHealth } from '../../services/ConnectionManager';

describe('ConnectionStatus', () => {
  const mockConnectionState: ConnectionState = {
    status: 'connected',
    lastConnected: new Date('2024-01-01T12:00:00Z'),
    reconnectAttempts: 0,
    latency: 50,
    quality: 'excellent'
  };

  const mockConnectionHealth: ConnectionHealth = {
    isConnected: true,
    lastPing: new Date('2024-01-01T12:00:00Z'),
    latency: 50,
    reconnectCount: 2,
    errorCount: 1,
    uptime: 300000, // 5 minutes
    quality: 'excellent'
  };

  it('renders connection status correctly', () => {
    render(<ConnectionStatus connectionState={mockConnectionState} />);
    
    expect(screen.getByText('Соединение')).toBeInTheDocument();
    expect(screen.getByText('Подключено')).toBeInTheDocument();
    expect(screen.getByText('Отлично')).toBeInTheDocument();
  });

  it('displays latency when connected', () => {
    render(<ConnectionStatus connectionState={mockConnectionState} />);
    
    expect(screen.getByText('50мс')).toBeInTheDocument();
  });

  it('shows reconnection progress when reconnecting', () => {
    const reconnectingState: ConnectionState = {
      ...mockConnectionState,
      status: 'reconnecting',
      reconnectAttempts: 3
    };

    render(<ConnectionStatus connectionState={reconnectingState} />);
    
    expect(screen.getByText('Переподключение (3)')).toBeInTheDocument();
    expect(screen.getByText('Переподключение... (попытка 3)')).toBeInTheDocument();
  });

  it('shows connecting progress when connecting', () => {
    const connectingState: ConnectionState = {
      ...mockConnectionState,
      status: 'connecting'
    };

    render(<ConnectionStatus connectionState={connectingState} />);
    
    expect(screen.getByText('Подключение...')).toBeInTheDocument();
    expect(screen.getByText('Подключение к серверу...')).toBeInTheDocument();
  });

  it('displays failed connection state with error message', () => {
    const failedState: ConnectionState = {
      ...mockConnectionState,
      status: 'failed',
      reconnectAttempts: 5
    };

    render(<ConnectionStatus connectionState={failedState} />);
    
    expect(screen.getByText('Ошибка подключения')).toBeInTheDocument();
    expect(screen.getByText('Не удалось подключиться после 5 попыток')).toBeInTheDocument();
  });

  it('shows manual reconnect button when disconnected', () => {
    const disconnectedState: ConnectionState = {
      ...mockConnectionState,
      status: 'disconnected'
    };

    const mockReconnect = vi.fn();
    render(
      <ConnectionStatus 
        connectionState={disconnectedState} 
        onManualReconnect={mockReconnect}
      />
    );
    
    const reconnectButton = screen.getByRole('button', { name: /переподключиться/i });
    expect(reconnectButton).toBeInTheDocument();
    
    fireEvent.click(reconnectButton);
    expect(mockReconnect).toHaveBeenCalledOnce();
  });

  it('displays offline mode indicator', () => {
    render(
      <ConnectionStatus 
        connectionState={mockConnectionState} 
        isOffline={true}
      />
    );
    
    expect(screen.getByText('Офлайн')).toBeInTheDocument();
    expect(screen.getByText('Автономный режим')).toBeInTheDocument();
    expect(screen.getByText('Некоторые функции недоступны')).toBeInTheDocument();
  });

  it('shows connection health statistics', () => {
    render(
      <ConnectionStatus 
        connectionState={mockConnectionState}
        connectionHealth={mockConnectionHealth}
      />
    );
    
    expect(screen.getByText('5м 0с')).toBeInTheDocument(); // uptime
    expect(screen.getByText('2')).toBeInTheDocument(); // reconnect count
    expect(screen.getByText('1')).toBeInTheDocument(); // error count
  });

  it('applies correct color classes for different connection qualities', () => {
    const { rerender } = render(<ConnectionStatus connectionState={mockConnectionState} />);
    
    // Excellent quality
    expect(screen.getByText('Отлично')).toHaveClass('text-green-400');
    
    // Good quality
    rerender(<ConnectionStatus connectionState={{...mockConnectionState, quality: 'good'}} />);
    expect(screen.getByText('Хорошо')).toHaveClass('text-blue-400');
    
    // Poor quality
    rerender(<ConnectionStatus connectionState={{...mockConnectionState, quality: 'poor'}} />);
    expect(screen.getByText('Плохо')).toHaveClass('text-yellow-400');
    
    // Critical quality
    rerender(<ConnectionStatus connectionState={{...mockConnectionState, quality: 'critical'}} />);
    expect(screen.getByText('Критично')).toHaveClass('text-red-400');
  });

  it('applies correct color classes for different latencies', () => {
    // Low latency (green)
    const lowLatencyState = { ...mockConnectionState, latency: 50 };
    const { rerender } = render(<ConnectionStatus connectionState={lowLatencyState} />);
    expect(screen.getByText('50мс')).toHaveClass('text-green-400');
    
    // Medium latency (yellow)
    const mediumLatencyState = { ...mockConnectionState, latency: 200 };
    rerender(<ConnectionStatus connectionState={mediumLatencyState} />);
    expect(screen.getByText('200мс')).toHaveClass('text-yellow-400');
    
    // High latency (red)
    const highLatencyState = { ...mockConnectionState, latency: 500 };
    rerender(<ConnectionStatus connectionState={highLatencyState} />);
    expect(screen.getByText('500мс')).toHaveClass('text-red-400');
  });

  it('formats uptime correctly', () => {
    const healthWithDifferentUptimes = [
      { ...mockConnectionHealth, uptime: 30000 }, // 30 seconds
      { ...mockConnectionHealth, uptime: 90000 }, // 1.5 minutes
      { ...mockConnectionHealth, uptime: 3900000 }, // 1 hour 5 minutes
    ];

    healthWithDifferentUptimes.forEach((health, index) => {
      const { rerender } = render(
        <ConnectionStatus 
          connectionState={mockConnectionState}
          connectionHealth={health}
        />
      );
      
      if (index === 0) {
        expect(screen.getByText('30с')).toBeInTheDocument();
      } else if (index === 1) {
        expect(screen.getByText('1м 30с')).toBeInTheDocument();
      } else {
        expect(screen.getByText('1ч 5м')).toBeInTheDocument();
      }
      
      if (index < healthWithDifferentUptimes.length - 1) {
        rerender(<div />); // Clear for next test
      }
    });
  });

  it('does not show reconnect button when offline', () => {
    const disconnectedState: ConnectionState = {
      ...mockConnectionState,
      status: 'disconnected'
    };

    render(
      <ConnectionStatus 
        connectionState={disconnectedState} 
        onManualReconnect={vi.fn()}
        isOffline={true}
      />
    );
    
    expect(screen.queryByRole('button', { name: /переподключиться/i })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ConnectionStatus 
        connectionState={mockConnectionState} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});