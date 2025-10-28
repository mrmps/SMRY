"use client";

import { DebugContext } from "@/lib/errors/types";
import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

interface DebugPanelProps {
  debugContext?: DebugContext;
}

/**
 * Attio-style debug panel with clean, modern design
 */
export function DebugPanel({ debugContext }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number> | 'all'>('all');

  if (!debugContext || debugContext.steps.length === 0) {
    return null;
  }
  
  const toggleStep = (index: number) => {
    if (expandedSteps === 'all') {
      const newSet = new Set(debugContext.steps.map((_, i) => i));
      newSet.delete(index);
      setExpandedSteps(newSet);
    } else {
      const newSet = new Set(expandedSteps);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      setExpandedSteps(newSet);
    }
  };
  
  const isStepExpanded = (index: number) => {
    return expandedSteps === 'all' || expandedSteps.has(index);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-3xl">
      {/* Toggle Button - Attio Style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-white text-gray-700 rounded-xl shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 mb-3 font-medium text-sm"
        aria-label="Toggle debug panel"
      >
        <Terminal className="w-4 h-4 text-gray-500" />
        <span>Debug Console</span>
        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Debug Panel - Attio Style */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col w-[600px]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Extraction Pipeline</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {debugContext.steps.length} steps · {debugContext.source}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Debug
                </span>
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="p-4 space-y-3 bg-white">
              {debugContext.steps.map((step, index) => {
                const isExpanded = isStepExpanded(index);
                return (
                  <div
                    key={index}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden bg-white ${
                      isExpanded ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors bg-white"
                      onClick={() => toggleStep(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getStatusIcon(step.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-medium text-gray-900">
                              {step.step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                              {new Date(step.timestamp).toLocaleTimeString('en-US', { 
                                hour12: false, 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && step.data && (
                      <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusBadge(step.status)}`}>
                              {step.status}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-300 p-4">
                            <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
                              {JSON.stringify(step.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-white border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                Click to expand/collapse steps
              </span>
              <span className="text-gray-500 font-mono truncate max-w-xs" title={debugContext.url}>
                {new URL(debugContext.url).hostname}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

