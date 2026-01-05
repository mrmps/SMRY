"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Dashboard data types
interface RequestEvent {
  request_id: string;
  timestamp: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  status_code: number;
  error_type: string;
  error_message: string;
  duration_ms: number;
  fetch_ms: number;
  cache_lookup_ms: number;
  cache_save_ms: number;
  cache_hit: number;
  cache_status: string;
  article_length: number;
  article_title: string;
}

interface LiveRequest {
  request_id: string;
  timestamp: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  duration_ms: number;
  error_type: string;
  cache_hit: number;
}

interface DashboardData {
  timeRange: string;
  generatedAt: string;
  bufferStats: {
    size: number;
    maxSize: number;
  };
  filters: {
    hostname: string;
    source: string;
    outcome: string;
    urlSearch: string;
    availableSources: string[];
    availableHostnames: string[];
  };
  health: {
    total_requests_24h: number;
    success_rate_24h: number;
    cache_hit_rate_24h: number;
    avg_duration_ms_24h: number;
    p95_duration_ms_24h: number;
    avg_heap_mb: number;
    unique_hostnames_24h: number;
  };
  hostnameStats: Array<{
    hostname: string;
    total_requests: number;
    success_rate: number;
    error_count: number;
    avg_duration_ms: number;
  }>;
  sourceEffectiveness: Array<{
    hostname: string;
    source: string;
    success_rate: number;
    request_count: number;
  }>;
  hourlyTraffic: Array<{
    hour: string;
    request_count: number;
    success_count: number;
    error_count: number;
  }>;
  errorBreakdown: Array<{
    hostname: string;
    error_type: string;
    error_message: string;
    error_count: number;
    latest_timestamp: string;
  }>;
  realtimePopular: Array<{
    url: string;
    hostname: string;
    count: number;
  }>;
  requestEvents: RequestEvent[];
  liveRequests: LiveRequest[];
}

type TabType = "overview" | "requests" | "live" | "errors";

export default function AnalyticsDashboard() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "24h";

  // State
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [urlSearch, setUrlSearch] = useState("");
  const [hostnameFilter, setHostnameFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);

  // Build query string
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (hostnameFilter) params.set("hostname", hostnameFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (outcomeFilter) params.set("outcome", outcomeFilter);
    if (urlSearch) params.set("urlSearch", urlSearch);
    return params.toString();
  }, [range, hostnameFilter, sourceFilter, outcomeFilter, urlSearch]);

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["analytics", range, hostnameFilter, sourceFilter, outcomeFilter, urlSearch],
    queryFn: async () => {
      const res = await fetch(`/api/admin?${buildQueryString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch analytics");
      }
      return res.json();
    },
    refetchInterval: liveStreamEnabled ? 5000 : 30000, // 5s when live stream enabled
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById("url-search")?.focus();
      }
      if (e.key === "Escape") {
        setExpandedRequest(null);
        setUrlSearch("");
      }
      if (e.key === "1") setActiveTab("overview");
      if (e.key === "2") setActiveTab("requests");
      if (e.key === "3") setActiveTab("live");
      if (e.key === "4") setActiveTab("errors");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-100">Loading analytics...</div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <p className="text-red-400 text-lg">Failed to load analytics</p>
          <p className="text-zinc-500 text-sm mt-2">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Process source effectiveness into a matrix
  const sourceMatrix = data.sourceEffectiveness.reduce(
    (acc, item) => {
      if (!acc[item.hostname]) acc[item.hostname] = {};
      acc[item.hostname][item.source] = item.success_rate;
      return acc;
    },
    {} as Record<string, Record<string, number>>
  );

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">SMRY Analytics</h1>
            <p className="text-zinc-400 text-sm">
              Last updated: {new Date(data.generatedAt).toLocaleString()} |
              Buffer: {data.bufferStats.size}/{data.bufferStats.maxSize}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Time range selector */}
            {["1h", "24h", "7d"].map((r) => (
              <a
                key={r}
                href={`?range=${r}`}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  range === r
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {r}
              </a>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800 pb-2">
          {[
            { id: "overview" as const, label: "Overview", key: "1" },
            { id: "requests" as const, label: "Request Explorer", key: "2" },
            { id: "live" as const, label: "Live Stream", key: "3" },
            { id: "errors" as const, label: "Error Analysis", key: "4" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-emerald-400 border-b-2 border-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs text-zinc-600">{tab.key}</span>
            </button>
          ))}
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* URL Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <input
                  id="url-search"
                  type="text"
                  placeholder="Search URLs... (press / to focus)"
                  value={urlSearch}
                  onChange={(e) => setUrlSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refetch()}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-zinc-500 text-xs">
                  Press Enter to search
                </span>
              </div>
            </div>

            {/* Filters */}
            <select
              value={hostnameFilter}
              onChange={(e) => setHostnameFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Hostnames</option>
              {data.filters.availableHostnames.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Sources</option>
              <option value="smry-fast">smry-fast</option>
              <option value="smry-slow">smry-slow</option>
              <option value="wayback">wayback</option>
              <option value="jina.ai">jina.ai</option>
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Outcomes</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>

            {/* Clear Filters */}
            {(hostnameFilter || sourceFilter || outcomeFilter || urlSearch) && (
              <button
                onClick={() => {
                  setHostnameFilter("");
                  setSourceFilter("");
                  setOutcomeFilter("");
                  setUrlSearch("");
                }}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <OverviewTab data={data} sourceMatrix={sourceMatrix} />
        )}

        {activeTab === "requests" && (
          <RequestExplorerTab
            requests={data.requestEvents}
            expandedRequest={expandedRequest}
            setExpandedRequest={setExpandedRequest}
          />
        )}

        {activeTab === "live" && (
          <LiveStreamTab
            liveRequests={data.liveRequests}
            enabled={liveStreamEnabled}
            setEnabled={setLiveStreamEnabled}
          />
        )}

        {activeTab === "errors" && (
          <ErrorAnalysisTab
            errorBreakdown={data.errorBreakdown}
            hostnameStats={data.hostnameStats}
          />
        )}
      </div>
    </div>
  );
}

// ============ Overview Tab ============
function OverviewTab({ data, sourceMatrix }: { data: DashboardData; sourceMatrix: Record<string, Record<string, number>> }) {
  return (
    <>
      {/* Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <KPICard
          title="Total Requests"
          value={data.health.total_requests_24h?.toLocaleString() || "0"}
        />
        <KPICard
          title="Success Rate"
          value={`${data.health.success_rate_24h || 0}%`}
          color={data.health.success_rate_24h > 90 ? "green" : "red"}
        />
        <KPICard
          title="Cache Hit Rate"
          value={`${data.health.cache_hit_rate_24h || 0}%`}
          color={data.health.cache_hit_rate_24h > 50 ? "green" : "yellow"}
        />
        <KPICard
          title="Avg Latency"
          value={`${data.health.avg_duration_ms_24h || 0}ms`}
        />
        <KPICard
          title="P95 Latency"
          value={`${data.health.p95_duration_ms_24h || 0}ms`}
          color={data.health.p95_duration_ms_24h > 5000 ? "red" : "default"}
        />
        <KPICard
          title="Avg Heap"
          value={`${data.health.avg_heap_mb || 0}MB`}
          color={data.health.avg_heap_mb > 400 ? "red" : "default"}
        />
        <KPICard
          title="Unique Sites"
          value={data.health.unique_hostnames_24h?.toString() || "0"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Traffic Over Time */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Traffic Over Time
          </h2>
          {data.hourlyTraffic.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.hourlyTraffic}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(v) => v.split(" ")[1] || v}
                  stroke="#71717a"
                  fontSize={12}
                />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="success_count"
                  stroke="#10b981"
                  name="Success"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="error_count"
                  stroke="#ef4444"
                  name="Errors"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500">
              No traffic data yet
            </div>
          )}
        </div>

        {/* Top Sites by Error Count */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Sites with Most Errors
          </h2>
          {data.hostnameStats.filter((h) => h.error_count > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.hostnameStats
                  .filter((h) => h.error_count > 0)
                  .sort((a, b) => b.error_count - a.error_count)
                  .slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis type="number" stroke="#71717a" fontSize={12} />
                <YAxis
                  dataKey="hostname"
                  type="category"
                  width={150}
                  stroke="#71717a"
                  fontSize={11}
                  tickFormatter={(v) =>
                    v.length > 20 ? v.slice(0, 20) + "..." : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="error_count" fill="#ef4444" name="Errors" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500">
              No errors recorded
            </div>
          )}
        </div>
      </div>

      {/* Source Effectiveness Matrix */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">
          Source Effectiveness by Site
        </h2>
        {Object.keys(sourceMatrix).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">
                    Hostname
                  </th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">
                    smry-fast
                  </th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">
                    smry-slow
                  </th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">
                    wayback
                  </th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">
                    jina.ai
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sourceMatrix)
                  .slice(0, 25)
                  .map(([hostname, sources]) => (
                    <tr
                      key={hostname}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                        {hostname.length > 30
                          ? hostname.slice(0, 30) + "..."
                          : hostname}
                      </td>
                      {["smry-fast", "smry-slow", "wayback", "jina.ai"].map(
                        (source) => (
                          <td
                            key={source}
                            className="text-center py-3 px-4"
                          >
                            <SuccessRateBadge rate={sources[source]} />
                          </td>
                        )
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500">
            No source effectiveness data yet
          </div>
        )}
      </div>

      {/* Real-time Popular */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">
          Popular Right Now
          <span className="text-xs text-zinc-500 font-normal ml-2">
            (Last 5 min)
          </span>
        </h2>
        {data.realtimePopular.length > 0 ? (
          <div className="space-y-2">
            {data.realtimePopular.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">
                    {item.url}
                  </p>
                  <p className="text-xs text-zinc-500">{item.hostname}</p>
                </div>
                <span className="ml-4 px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-sm font-medium">
                  {item.count} req
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500">
            No recent activity
          </div>
        )}
      </div>
    </>
  );
}

// ============ Request Explorer Tab ============
function RequestExplorerTab({
  requests,
  expandedRequest,
  setExpandedRequest,
}: {
  requests: RequestEvent[];
  expandedRequest: string | null;
  setExpandedRequest: (id: string | null) => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">
          Request Explorer
          <span className="text-xs text-zinc-500 font-normal ml-2">
            ({requests.length} requests)
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Click a row to expand timing waterfall and details
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium">Timestamp</th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium">URL</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium">Source</th>
              <th className="text-center py-3 px-4 text-zinc-400 font-medium">Status</th>
              <th className="text-right py-3 px-4 text-zinc-400 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <>
                <tr
                  key={req.request_id}
                  onClick={() => setExpandedRequest(expandedRequest === req.request_id ? null : req.request_id)}
                  className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                    expandedRequest === req.request_id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                >
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                    {req.timestamp}
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <p className="text-zinc-200 truncate text-xs" title={req.url}>
                      {req.url}
                    </p>
                    <p className="text-zinc-500 text-xs">{req.hostname}</p>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <SourceBadge source={req.source} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <OutcomeBadge outcome={req.outcome} cacheHit={req.cache_hit === 1} />
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    <span className={req.duration_ms > 5000 ? "text-red-400" : "text-zinc-300"}>
                      {req.duration_ms}ms
                    </span>
                  </td>
                </tr>

                {/* Expanded Details */}
                {expandedRequest === req.request_id && (
                  <tr key={`${req.request_id}-expanded`}>
                    <td colSpan={5} className="p-0">
                      <RequestDetails request={req} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 && (
        <div className="py-12 text-center text-zinc-500">
          No requests found matching your filters
        </div>
      )}
    </div>
  );
}

// ============ Request Details (Expanded Row) ============
function RequestDetails({ request }: { request: RequestEvent }) {
  const totalTime = request.duration_ms || 1;

  const timings = [
    { label: "Cache Lookup", value: request.cache_lookup_ms, color: "bg-blue-500" },
    { label: "Fetch", value: request.fetch_ms, color: "bg-emerald-500" },
    { label: "Cache Save", value: request.cache_save_ms, color: "bg-purple-500" },
  ].filter(t => t.value > 0);

  const accountedTime = timings.reduce((sum, t) => sum + t.value, 0);
  const otherTime = totalTime - accountedTime;

  if (otherTime > 0) {
    timings.push({ label: "Other", value: otherTime, color: "bg-zinc-600" });
  }

  return (
    <div className="bg-zinc-800/50 p-6 border-t border-zinc-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Timing Waterfall */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Timing Waterfall</h3>
          <div className="space-y-3">
            {timings.map((timing) => (
              <div key={timing.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{timing.label}</span>
                  <span className="text-zinc-300 font-mono">{timing.value}ms</span>
                </div>
                <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${timing.color} rounded-full transition-all`}
                    style={{ width: `${Math.min((timing.value / totalTime) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-zinc-700 flex justify-between text-sm">
              <span className="text-zinc-400 font-medium">Total</span>
              <span className="text-zinc-100 font-mono font-medium">{totalTime}ms</span>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-4">
          {/* Error Message */}
          {request.error_message && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-2">Error Message</h3>
              <div className="bg-red-950/30 border border-red-900/50 rounded-md p-3">
                <p className="text-xs font-mono text-red-300 break-all">
                  {request.error_message}
                </p>
              </div>
            </div>
          )}

          {/* Request Info */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Request Info</h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-zinc-500">Request ID</dt>
              <dd className="text-zinc-300 font-mono">{request.request_id.slice(0, 12)}...</dd>

              <dt className="text-zinc-500">Status Code</dt>
              <dd className="text-zinc-300">{request.status_code}</dd>

              <dt className="text-zinc-500">Cache Status</dt>
              <dd className="text-zinc-300">{request.cache_status || (request.cache_hit ? "hit" : "miss")}</dd>

              {request.article_length > 0 && (
                <>
                  <dt className="text-zinc-500">Article Length</dt>
                  <dd className="text-zinc-300">{request.article_length.toLocaleString()} chars</dd>
                </>
              )}

              {request.article_title && (
                <>
                  <dt className="text-zinc-500">Article Title</dt>
                  <dd className="text-zinc-300 truncate col-span-2" title={request.article_title}>
                    {request.article_title}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {/* Full URL */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Full URL</h3>
            <p className="text-xs font-mono text-zinc-400 break-all bg-zinc-900 p-2 rounded">
              {request.url}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Live Stream Tab ============
function LiveStreamTab({
  liveRequests,
  enabled,
  setEnabled,
}: {
  liveRequests: LiveRequest[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Live Request Stream
            <span className="ml-2 inline-flex items-center">
              <span className={`w-2 h-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
            </span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Last 60 seconds of requests (5s refresh)
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            enabled
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
          }`}
        >
          {enabled ? "Pause" : "Resume"}
        </button>
      </div>

      <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
        {liveRequests.map((req, i) => (
          <div
            key={`${req.request_id}-${i}`}
            className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-xs font-mono text-zinc-500 w-20">
              {req.timestamp}
            </span>

            <OutcomeBadge outcome={req.outcome} cacheHit={req.cache_hit === 1} />

            <span className="flex-1 text-sm text-zinc-300 truncate" title={req.url}>
              {req.hostname}
              <span className="text-zinc-500 ml-2">{req.url.replace(`https://${req.hostname}`, "").slice(0, 50)}</span>
            </span>

            <SourceBadge source={req.source} />

            <span className={`text-xs font-mono w-16 text-right ${req.duration_ms > 5000 ? "text-red-400" : "text-zinc-400"}`}>
              {req.duration_ms}ms
            </span>

            {req.error_type && (
              <span className="text-xs text-red-400 font-mono">
                {req.error_type}
              </span>
            )}
          </div>
        ))}

        {liveRequests.length === 0 && (
          <div className="py-12 text-center text-zinc-500">
            No requests in the last 60 seconds
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Error Analysis Tab ============
function ErrorAnalysisTab({
  errorBreakdown,
  hostnameStats,
}: {
  errorBreakdown: DashboardData["errorBreakdown"];
  hostnameStats: DashboardData["hostnameStats"];
}) {
  return (
    <div className="space-y-6">
      {/* Error Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total Errors</p>
          <p className="text-2xl font-bold text-red-400">
            {errorBreakdown.reduce((sum, e) => sum + e.error_count, 0)}
          </p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Affected Sites</p>
          <p className="text-2xl font-bold text-amber-400">
            {new Set(errorBreakdown.map(e => e.hostname)).size}
          </p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Error Types</p>
          <p className="text-2xl font-bold text-zinc-100">
            {new Set(errorBreakdown.map(e => e.error_type)).size}
          </p>
        </div>
      </div>

      {/* Error Breakdown Table with Messages */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Error Breakdown</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Grouped by hostname and error type, with sample error messages
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Hostname</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Error Type</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Sample Message</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Count</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {errorBreakdown.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-800 hover:bg-zinc-800/50"
                >
                  <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                    {item.hostname}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-mono">
                      {item.error_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <p className="text-xs text-zinc-400 truncate" title={item.error_message}>
                      {item.error_message || "-"}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-red-400 font-medium">{item.error_count}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-500 text-xs font-mono">
                    {item.latest_timestamp?.split(" ")[1] || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errorBreakdown.length === 0 && (
          <div className="py-12 text-center text-zinc-500">
            No errors recorded
          </div>
        )}
      </div>

      {/* Sites by Error Rate */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Sites by Error Rate</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Hostname</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Total</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Errors</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Success Rate</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {hostnameStats
                .filter(h => h.error_count > 0)
                .sort((a, b) => b.error_count - a.error_count)
                .slice(0, 20)
                .map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                      {item.hostname}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400">
                      {item.total_requests}
                    </td>
                    <td className="py-3 px-4 text-right text-red-400 font-medium">
                      {item.error_count}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <SuccessRateBadge rate={item.success_rate} />
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400 font-mono text-xs">
                      {item.avg_duration_ms}ms
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ Helper Components ============
function KPICard({
  title,
  value,
  color = "default",
}: {
  title: string;
  value: string;
  color?: "green" | "red" | "yellow" | "default";
}) {
  const colorClasses = {
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-amber-400",
    default: "text-zinc-100",
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
        {title}
      </p>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

function SuccessRateBadge({ rate }: { rate?: number }) {
  if (rate === undefined) {
    return <span className="text-zinc-600">-</span>;
  }

  const colorClasses =
    rate >= 90
      ? "bg-emerald-900/30 text-emerald-400"
      : rate >= 70
        ? "bg-amber-900/30 text-amber-400"
        : "bg-red-900/30 text-red-400";

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses}`}>
      {rate}%
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    "smry-fast": "bg-blue-900/30 text-blue-400",
    "smry-slow": "bg-purple-900/30 text-purple-400",
    "wayback": "bg-amber-900/30 text-amber-400",
    "jina.ai": "bg-pink-900/30 text-pink-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${colors[source] || "bg-zinc-700 text-zinc-400"}`}>
      {source || "unknown"}
    </span>
  );
}

function OutcomeBadge({ outcome, cacheHit }: { outcome: string; cacheHit?: boolean }) {
  if (outcome === "success") {
    return (
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs text-emerald-400">
          {cacheHit ? "cache" : "ok"}
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-red-500" />
      <span className="text-xs text-red-400">error</span>
    </span>
  );
}
