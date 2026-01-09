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
        return <CheckCircle2 className="size-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="size-4 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-amber-500" />;
      case 'info':
      default:
        return <Info className="size-4 text-blue-500" />;
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
        className="mb-3 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
        aria-label="Toggle debug panel"
      >
        <Terminal className="size-4 text-gray-500" />
        <span>Debug Console</span>
        {isOpen ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
      </button>

      {/* Debug Panel - Attio Style */}
      {isOpen && (
        <div className="flex max-h-[70vh] w-[600px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Extraction Pipeline</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {debugContext.steps.length} steps · {debugContext.source}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Debug
                </span>
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="space-y-3 bg-white p-4">
              {debugContext.steps.map((step, index) => {
                const isExpanded = isStepExpanded(index);
                return (
                  <div
                    key={index}
                    className={`overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                      isExpanded ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div
                      className="cursor-pointer bg-white px-4 py-3 transition-colors hover:bg-gray-50/50"
                      onClick={() => toggleStep(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {getStatusIcon(step.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-medium text-gray-900">
                              {step.step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <span className="shrink-0 font-mono text-xs text-gray-400">
                              {new Date(step.timestamp).toLocaleTimeString('en-US', { 
                                hour12: false, 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                              })}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{step.message}</p>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="size-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && step.data && (
                      <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getStatusBadge(step.status)}`}>
                              {step.status}
                            </span>
                          </div>
                          <div className="rounded-lg border border-gray-300 bg-white p-4">
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-white">
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
          <div className="border-t border-gray-200 bg-white px-6 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                Click to expand/collapse steps
              </span>
              <span className="max-w-xs truncate font-mono text-gray-500" title={debugContext.url}>
                {new URL(debugContext.url).hostname}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

