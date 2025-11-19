"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type RedisStatus = 'operational' | 'degraded' | 'down' | 'checking';

interface RedisStatusResponse {
  status: RedisStatus;
  service: string;
  responseTime: number;
  timestamp: string;
  message?: string;
  features: {
    caching: boolean;
    rateLimit: boolean;
  };
}

interface RedisStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  autoRefresh?: boolean;
  refreshInterval?: number;
  hideWhenOperational?: boolean;
}

export function RedisStatus({ 
  showLabel = true, 
  size = 'sm', 
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
  hideWhenOperational = false
}: RedisStatusProps) {
  const [status, setStatus] = useState<RedisStatus>('checking');
  const [statusData, setStatusData] = useState<RedisStatusResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    try {
      // This endpoint is cached by Next.js for 60s
      // so this fetch is very lightweight
      const response = await fetch('/api/summary/status');
      
      if (!response.ok) {
        throw new Error('Status check failed');
      }
      
      const data: RedisStatusResponse = await response.json();
      setStatus(data.status);
      setStatusData(data);
      setLastChecked(new Date());
    } catch (error) {
      setStatus('down');
      setStatusData(null);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkStatus();
    
    if (autoRefresh) {
      const interval = setInterval(checkStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const sizeClasses = {
    sm: 'size-2',
    md: 'size-3',
    lg: 'size-4',
  };

  const statusConfig = {
    operational: {
      color: 'bg-green-500',
      label: 'Operational',
      textColor: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      description: 'All features working normally',
    },
    degraded: {
      color: 'bg-yellow-500',
      label: 'Degraded',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      description: 'Some features may be unavailable',
    },
    down: {
      color: 'bg-red-500',
      label: 'Down',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Service temporarily unavailable',
    },
    checking: {
      color: 'bg-gray-400',
      label: 'Checking',
      textColor: 'text-gray-700',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      description: 'Checking status...',
    },
  };

  const config = statusConfig[status];

  if (status === 'operational' && hideWhenOperational) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2 cursor-help">
            <span className={`${sizeClasses[size]} ${config.color} rounded-full`} />
            {showLabel && (
              <span className="text-xs font-medium text-gray-600">
                {config.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 p-1">
            <div>
              <div className="text-xs font-semibold text-gray-900">
                Redis Cache Status
              </div>
              <div className={`text-xs ${config.textColor}`}>
                {config.description}
              </div>
            </div>
            
            {statusData && statusData.features && (
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center justify-between gap-4">
                  <span>Caching:</span>
                  <span className={statusData.features.caching ? 'text-green-600' : 'text-red-600'}>
                    {statusData.features.caching ? '✓ Active' : '✗ Unavailable'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Rate Limiting:</span>
                  <span className={statusData.features.rateLimit ? 'text-green-600' : 'text-red-600'}>
                    {statusData.features.rateLimit ? '✓ Active' : '✗ Unavailable'}
                  </span>
                </div>
              </div>
            )}
            
            {lastChecked && (
              <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                Last updated: {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

