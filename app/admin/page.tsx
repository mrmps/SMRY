"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  event_time: string;
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
  event_time: string;
  url: string;
  hostname: string;
  source: string;
  outcome: string;
  duration_ms: number;
  error_type: string;
  cache_hit: number;
}

interface UpstreamBreakdown {
  upstream_hostname: string;
  upstream_status_code: number;
  error_count: number;
  affected_hostnames: number;
  sample_error_type: string;
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
    hasFilters: boolean;
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
    upstream_hostname: string;
    upstream_status_code: number;
  }>;
  upstreamBreakdown: UpstreamBreakdown[];
  realtimePopular: Array<{
    url: string;
    hostname: string;
    count: number;
  }>;
  requestEvents: RequestEvent[];
  liveRequests: LiveRequest[];
  endpointStats: Array<{
    endpoint: string;
    total_requests: number;
    success_count: number;
    error_count: number;
    success_rate: number;
    avg_duration_ms: number;
    total_input_tokens: number;
    total_output_tokens: number;
  }>;
  hourlyEndpointTraffic: Array<{
    hour: string;
    endpoint: string;
    request_count: number;
    success_count: number;
    error_count: number;
  }>;
  universallyBroken: Array<{
    hostname: string;
    total_requests: number;
    sources_tried: number;
    sources_list: string;
    overall_success_rate: number;
    sample_url: string;
  }>;
  sourceErrorRateTimeSeries: Array<{
    time_bucket: string;
    source: string;
    total_requests: number;
    error_count: number;
    error_rate: number;
  }>;
}

type TabType = "overview" | "requests" | "live" | "errors";

function AnalyticsDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const range = searchParams.get("range") || "24h";

  // State
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [urlSearch, setUrlSearch] = useState("");
  const [debouncedUrlSearch, setDebouncedUrlSearch] = useState("");
  const [hostnameFilter, setHostnameFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);

  // Debounce URL search to prevent flashing on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUrlSearch(urlSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [urlSearch]);

  // Build query string (uses debounced search to prevent flashing)
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (hostnameFilter) params.set("hostname", hostnameFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (outcomeFilter) params.set("outcome", outcomeFilter);
    if (debouncedUrlSearch) params.set("urlSearch", debouncedUrlSearch);
    return params.toString();
  }, [range, hostnameFilter, sourceFilter, outcomeFilter, debouncedUrlSearch]);

  // Change time range while preserving filters
  const changeTimeRange = useCallback((newRange: string) => {
    const params = new URLSearchParams();
    params.set("range", newRange);
    if (hostnameFilter) params.set("hostname", hostnameFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (outcomeFilter) params.set("outcome", outcomeFilter);
    if (debouncedUrlSearch) params.set("urlSearch", debouncedUrlSearch);
    router.push(`?${params.toString()}`);
  }, [router, hostnameFilter, sourceFilter, outcomeFilter, debouncedUrlSearch]);

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["analytics", range, hostnameFilter, sourceFilter, outcomeFilter, debouncedUrlSearch],
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
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !isTyping) {
        e.preventDefault();
        document.getElementById("url-search")?.focus();
      }
      if (e.key === "Escape") {
        setExpandedRequest(null);
        setUrlSearch("");
        (document.activeElement as HTMLElement)?.blur();
      }
      // Only switch tabs if not typing in an input
      if (!isTyping) {
        if (e.key === "1") setActiveTab("overview");
        if (e.key === "2") setActiveTab("requests");
        if (e.key === "3") setActiveTab("live");
        if (e.key === "4") setActiveTab("errors");
      }
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
              <button
                key={r}
                onClick={() => changeTimeRange(r)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  range === r
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {r}
              </button>
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      refetch();
                    }
                  }}
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
            hasFilters={data.filters.hasFilters}
          />
        )}

        {activeTab === "live" && (
          <LiveStreamTab
            liveRequests={data.liveRequests}
            enabled={liveStreamEnabled}
            setEnabled={setLiveStreamEnabled}
            hasFilters={data.filters.hasFilters}
          />
        )}

        {activeTab === "errors" && (
          <ErrorAnalysisTab
            errorBreakdown={data.errorBreakdown}
            upstreamBreakdown={data.upstreamBreakdown}
            hostnameStats={data.hostnameStats}
            universallyBroken={data.universallyBroken}
          />
        )}
      </div>
    </div>
  );
}

// ============ Overview Tab ============
function OverviewTab({ data, sourceMatrix }: { data: DashboardData; sourceMatrix: Record<string, Record<string, number>> }) {
  const [sitesPage, setSitesPage] = useState(0);
  const sitesPerPage = 100;
  const totalSites = Math.min(data.hostnameStats.length, 200);
  const totalPages = Math.ceil(totalSites / sitesPerPage);

  // Transform source error rate time series for recharts (pivot by source)
  const sourceErrorRateChartData = React.useMemo(() => {
    const timeMap = new Map<string, Record<string, string | number>>();

    for (const item of data.sourceErrorRateTimeSeries || []) {
      if (!timeMap.has(item.time_bucket)) {
        timeMap.set(item.time_bucket, { time_bucket: item.time_bucket });
      }
      const entry = timeMap.get(item.time_bucket)!;
      // Use source name as key with error_rate as value
      entry[item.source] = item.error_rate;
      // Also store request count for tooltip
      entry[`${item.source}_requests`] = item.total_requests;
    }

    return Array.from(timeMap.values()).sort((a, b) =>
      String(a.time_bucket).localeCompare(String(b.time_bucket))
    );
  }, [data.sourceErrorRateTimeSeries]);

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

      {/* Source Error Rate Over Time - Key Observability Chart */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Source Error Rates Over Time
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Error rate % by source (15-min buckets) - Use to detect regressions after deployments
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { source: "smry-fast", color: "#3b82f6" },
              { source: "smry-slow", color: "#a855f7" },
              { source: "wayback", color: "#f59e0b" },
              { source: "jina.ai", color: "#ec4899" },
            ].map(({ source, color }) => (
              <span key={source} className="flex items-center gap-1 text-xs text-zinc-400">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                {source}
              </span>
            ))}
          </div>
        </div>
        {sourceErrorRateChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sourceErrorRateChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="time_bucket"
                tickFormatter={(v) => v.split(" ")[1] || v}
                stroke="#71717a"
                fontSize={11}
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value, name, props) => {
                  const requests = props.payload[`${name}_requests`];
                  return [`${value}% (${requests || 0} requests)`, name];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="smry-fast"
                stroke="#3b82f6"
                name="smry-fast"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="smry-slow"
                stroke="#a855f7"
                name="smry-slow"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="wayback"
                stroke="#f59e0b"
                name="wayback"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="jina.ai"
                stroke="#ec4899"
                name="jina.ai"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-zinc-500">
            No source error rate data yet
          </div>
        )}
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

      {/* Top Sites by Traffic */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Top Sites by Traffic
            <span className="text-xs text-zinc-500 font-normal ml-2">
              ({totalSites} sites)
            </span>
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSitesPage(Math.max(0, sitesPage - 1))}
                disabled={sitesPage === 0}
                className="px-3 py-1 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-sm text-zinc-400">
                {sitesPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setSitesPage(Math.min(totalPages - 1, sitesPage + 1))}
                disabled={sitesPage >= totalPages - 1}
                className="px-3 py-1 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {data.hostnameStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">
                    #
                  </th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">
                    Site
                  </th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">
                    Requests
                  </th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">
                    Success
                  </th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">
                    Errors
                  </th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">
                    Latency
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
                {data.hostnameStats
                  .slice(0, totalSites)
                  .slice(sitesPage * sitesPerPage, (sitesPage + 1) * sitesPerPage)
                  .map((site, idx) => {
                    const sources = sourceMatrix[site.hostname] || {};
                    const rank = sitesPage * sitesPerPage + idx + 1;
                    return (
                      <tr
                        key={site.hostname}
                        className="border-b border-zinc-800 hover:bg-zinc-800/50"
                      >
                        <td className="py-3 px-4 text-zinc-500 text-xs">
                          {rank}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                          {site.hostname.length > 30
                            ? site.hostname.slice(0, 30) + "..."
                            : site.hostname}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-200 font-medium">
                          {Number(site.total_requests).toLocaleString()}
                        </td>
                        <td className="text-center py-3 px-4">
                          <SuccessRateBadge rate={site.success_rate} />
                        </td>
                        <td className="py-3 px-4 text-right text-red-400 font-mono text-xs">
                          {site.error_count}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-400 font-mono text-xs">
                          {site.avg_duration_ms}ms
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
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500">
            No traffic data yet
          </div>
        )}
      </div>

      {/* Endpoint Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Endpoint Stats Cards */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            API Endpoints
          </h2>
          {data.endpointStats.length > 0 ? (
            <div className="space-y-4">
              {data.endpointStats.map((ep) => (
                <div key={ep.endpoint} className="p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-sm text-zinc-200">{ep.endpoint}</span>
                    <SuccessRateBadge rate={ep.success_rate} />
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-zinc-500">Requests</p>
                      <p className="text-zinc-200 font-medium">{ep.total_requests.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Errors</p>
                      <p className="text-red-400 font-medium">{ep.error_count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Avg Latency</p>
                      <p className="text-zinc-200 font-medium">{ep.avg_duration_ms}ms</p>
                    </div>
                    {ep.endpoint === "/api/summary" && (
                      <div>
                        <p className="text-zinc-500">Tokens</p>
                        <p className="text-zinc-200 font-medium">
                          {((ep.total_input_tokens + ep.total_output_tokens) / 1000).toFixed(1)}k
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500">
              No endpoint data yet
            </div>
          )}
        </div>

        {/* Summary API Details */}
        {data.endpointStats.find(e => e.endpoint === "/api/summary") && (
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Summary API Details
            </h2>
            {(() => {
              const summary = data.endpointStats.find(e => e.endpoint === "/api/summary");
              if (!summary) return null;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Success Rate</p>
                      <p className={`text-2xl font-bold ${summary.success_rate >= 90 ? 'text-emerald-400' : summary.success_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {summary.success_rate}%
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Failed Summaries</p>
                      <p className="text-2xl font-bold text-red-400">{summary.error_count}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Input Tokens</p>
                      <p className="text-xl font-bold text-zinc-200">
                        {(summary.total_input_tokens / 1000).toFixed(1)}k
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <p className="text-xs text-zinc-500 uppercase mb-1">Output Tokens</p>
                      <p className="text-xl font-bold text-zinc-200">
                        {(summary.total_output_tokens / 1000).toFixed(1)}k
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Avg Response Time</p>
                    <p className={`text-xl font-bold ${summary.avg_duration_ms > 10000 ? 'text-red-400' : 'text-zinc-200'}`}>
                      {summary.avg_duration_ms}ms
                    </p>
                  </div>
                </div>
              );
            })()}
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
  hasFilters,
}: {
  requests: RequestEvent[];
  expandedRequest: string | null;
  setExpandedRequest: (id: string | null) => void;
  hasFilters: boolean;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">
          Request Explorer
          <span className="text-xs text-zinc-500 font-normal ml-2">
            ({requests.length} requests{hasFilters && ", filtered"})
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Click a row to expand timing waterfall and details
          {hasFilters && <span className="text-amber-400 ml-2">• Filters applied</span>}
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
              <React.Fragment key={req.request_id}>
                <tr
                  onClick={() => setExpandedRequest(expandedRequest === req.request_id ? null : req.request_id)}
                  className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                    expandedRequest === req.request_id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                >
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                    {req.event_time}
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
                  <tr>
                    <td colSpan={5} className="p-0">
                      <RequestDetails request={req} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
              <h3 className="text-sm font-semibold text-red-400 mb-2">
                Error Message
              </h3>
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
  hasFilters,
}: {
  liveRequests: LiveRequest[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  hasFilters: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            Last 60 seconds of requests (5s refresh) - Click any row to expand
            {hasFilters && <span className="text-amber-400 ml-2">• Filters applied</span>}
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
        {liveRequests.map((req, i) => {
          const itemId = `${req.request_id}-${i}`;
          const isExpanded = expandedId === itemId;
          return (
            <div key={itemId}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : itemId)}
                className={`px-4 py-3 flex items-center gap-4 cursor-pointer transition-colors ${
                  isExpanded ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-xs font-mono text-zinc-500 w-20">
                  {req.event_time}
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

              {/* Expanded Details */}
              {isExpanded && (
                <div className="bg-zinc-800/50 p-4 border-t border-zinc-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Request Details</h4>
                      <dl className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Request ID</dt>
                          <dd className="text-zinc-300 font-mono">{req.request_id}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Source</dt>
                          <dd className="text-zinc-300">{req.source || "unknown"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Duration</dt>
                          <dd className="text-zinc-300">{req.duration_ms}ms</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Cache</dt>
                          <dd className="text-zinc-300">{req.cache_hit ? "Hit" : "Miss"}</dd>
                        </div>
                        {req.error_type && (
                          <div className="flex justify-between">
                            <dt className="text-zinc-500">Error Type</dt>
                            <dd className="text-red-400">{req.error_type}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Full URL</h4>
                      <p className="text-xs font-mono text-zinc-400 break-all bg-zinc-900 p-2 rounded">
                        {req.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
  upstreamBreakdown,
  hostnameStats,
  universallyBroken,
}: {
  errorBreakdown: DashboardData["errorBreakdown"];
  upstreamBreakdown: DashboardData["upstreamBreakdown"];
  hostnameStats: DashboardData["hostnameStats"];
  universallyBroken: DashboardData["universallyBroken"];
}) {
  const [expandedBroken, setExpandedBroken] = useState<number | null>(null);
  const [expandedError, setExpandedError] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Universally Broken Sites - HIGH PRIORITY */}
      {universallyBroken && universallyBroken.length > 0 && (
        <div className="bg-red-950/20 rounded-lg border border-red-900/50 overflow-hidden">
          <div className="p-4 border-b border-red-900/50 bg-red-950/30">
            <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              Universally Broken Sites
            </h2>
            <p className="text-xs text-red-300/70 mt-1">
              Sites where ALL attempted sources failed (0% success rate). Click to see full URL. Consider adding to hard paywall blocklist.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-900/30 bg-red-950/20">
                  <th className="text-left py-3 px-4 text-red-300 font-medium">Hostname</th>
                  <th className="text-center py-3 px-4 text-red-300 font-medium">Sources Tried</th>
                  <th className="text-right py-3 px-4 text-red-300 font-medium">Total Requests</th>
                  <th className="text-left py-3 px-4 text-red-300 font-medium">Sample URL</th>
                </tr>
              </thead>
              <tbody>
                {universallyBroken.map((item, i) => (
                  <React.Fragment key={i}>
                    <tr
                      onClick={() => setExpandedBroken(expandedBroken === i ? null : i)}
                      className={`border-b border-red-900/20 cursor-pointer transition-colors ${
                        expandedBroken === i ? "bg-red-950/40" : "hover:bg-red-950/30"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-red-200">
                        {item.hostname}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs text-red-300">
                          {item.sources_tried} sources
                        </span>
                        <span className="block text-xs text-red-400/60 mt-0.5">
                          {item.sources_list}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-red-300 font-medium">
                        {item.total_requests}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-xs text-red-400/80 truncate" title={item.sample_url}>
                          {item.sample_url}
                        </p>
                      </td>
                    </tr>
                    {expandedBroken === i && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <div className="bg-red-950/30 p-4 border-t border-red-900/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-red-300 uppercase mb-2">Site Details</h4>
                                <dl className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <dt className="text-red-400/70">Hostname</dt>
                                    <dd className="text-red-200 font-mono">{item.hostname}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-red-400/70">Total Requests</dt>
                                    <dd className="text-red-200">{item.total_requests}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-red-400/70">Success Rate</dt>
                                    <dd className="text-red-400 font-bold">{item.overall_success_rate}%</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-red-400/70">Sources Tried</dt>
                                    <dd className="text-red-200">{item.sources_list}</dd>
                                  </div>
                                </dl>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-red-300 uppercase mb-2">Sample URL</h4>
                                <p className="text-xs font-mono text-red-300 break-all bg-red-950/50 p-2 rounded border border-red-900/30">
                                  {item.sample_url}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Upstream Service Errors - Shows which external services are failing */}
      {upstreamBreakdown && upstreamBreakdown.length > 0 && (
        <div className="bg-amber-950/20 rounded-lg border border-amber-900/50 overflow-hidden">
          <div className="p-4 border-b border-amber-900/50 bg-amber-950/30">
            <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              Upstream Service Errors
            </h2>
            <p className="text-xs text-amber-300/70 mt-1">
              Which external services (Wayback, Diffbot API, etc.) are returning errors. This helps identify if issues are with our service or upstream dependencies.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-900/30 bg-amber-950/20">
                  <th className="text-left py-3 px-4 text-amber-300 font-medium">Upstream Service</th>
                  <th className="text-center py-3 px-4 text-amber-300 font-medium">HTTP Status</th>
                  <th className="text-center py-3 px-4 text-amber-300 font-medium">Error Type</th>
                  <th className="text-right py-3 px-4 text-amber-300 font-medium">Error Count</th>
                  <th className="text-right py-3 px-4 text-amber-300 font-medium">Sites Affected</th>
                </tr>
              </thead>
              <tbody>
                {upstreamBreakdown.map((item, i) => (
                  <tr key={i} className="border-b border-amber-900/20 hover:bg-amber-950/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-amber-200">
                      {item.upstream_hostname || "(unknown)"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.upstream_status_code ? (
                        <span className={`px-2 py-1 rounded text-xs font-mono ${
                          item.upstream_status_code === 429 ? "bg-amber-900/50 text-amber-300" :
                          item.upstream_status_code >= 500 ? "bg-red-900/50 text-red-300" :
                          item.upstream_status_code === 403 || item.upstream_status_code === 401 ? "bg-orange-900/50 text-orange-300" :
                          "bg-zinc-700 text-zinc-300"
                        }`}>
                          {item.upstream_status_code}
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-zinc-700/50 text-zinc-300 rounded text-xs font-mono">
                        {item.sample_error_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-amber-300 font-medium">
                      {item.error_count}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400">
                      {item.affected_hostnames}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error Breakdown Table with Messages */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Error Breakdown</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Grouped by hostname and error type - Click any row to see full error message
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Hostname</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Error Type</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Upstream</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Sample Message</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Count</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {errorBreakdown.map((item, i) => (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => setExpandedError(expandedError === i ? null : i)}
                    className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                      expandedError === i ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                      {item.hostname}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-mono">
                        {item.error_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.upstream_hostname ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-amber-300">
                            {item.upstream_hostname}
                          </span>
                          {item.upstream_status_code > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                              item.upstream_status_code === 429 ? "bg-amber-900/50 text-amber-300" :
                              item.upstream_status_code >= 500 ? "bg-red-900/50 text-red-300" :
                              item.upstream_status_code === 403 || item.upstream_status_code === 401 ? "bg-orange-900/50 text-orange-300" :
                              "bg-zinc-700 text-zinc-300"
                            }`}>
                              {item.upstream_status_code}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">-</span>
                      )}
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
                      {item.latest_timestamp?.split(" ")[1]?.split(".")[0] || "-"}
                    </td>
                  </tr>
                  {expandedError === i && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="bg-zinc-800/50 p-4 border-t border-zinc-700">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Error Details</h4>
                              <dl className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <dt className="text-zinc-500">Hostname</dt>
                                  <dd className="text-zinc-300 font-mono">{item.hostname}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-zinc-500">Error Type</dt>
                                  <dd className="text-red-400">{item.error_type}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-zinc-500">Occurrences</dt>
                                  <dd className="text-red-400 font-bold">{item.error_count}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-zinc-500">Last Seen</dt>
                                  <dd className="text-zinc-300">{item.latest_timestamp || "-"}</dd>
                                </div>
                              </dl>
                            </div>
                            {/* Upstream Service Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-amber-400 uppercase mb-2">Upstream Service</h4>
                              {item.upstream_hostname ? (
                                <dl className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <dt className="text-zinc-500">Service</dt>
                                    <dd className="text-amber-300 font-mono">{item.upstream_hostname}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-zinc-500">HTTP Status</dt>
                                    <dd className={
                                      item.upstream_status_code === 429 ? "text-amber-400" :
                                      item.upstream_status_code >= 500 ? "text-red-400" :
                                      item.upstream_status_code === 403 || item.upstream_status_code === 401 ? "text-orange-400" :
                                      "text-zinc-300"
                                    }>
                                      {item.upstream_status_code || "-"}
                                    </dd>
                                  </div>
                                </dl>
                              ) : (
                                <p className="text-xs text-zinc-500 italic">No upstream info available</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Full Error Message</h4>
                              <div className="bg-red-950/30 border border-red-900/50 rounded-md p-3">
                                <p className="text-xs font-mono text-red-300 break-all whitespace-pre-wrap">
                                  {item.error_message || "No error message available"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return null;

  const config: Record<string, { bg: string; text: string; label: string }> = {
    expected: { bg: "bg-zinc-700", text: "text-zinc-300", label: "expected" },
    degraded: { bg: "bg-amber-900/30", text: "text-amber-400", label: "degraded" },
    unexpected: { bg: "bg-red-900/30", text: "text-red-400", label: "unexpected" },
  };

  const { bg, text, label } = config[severity] || config.unexpected;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// Loading fallback for Suspense
function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-zinc-100">Loading analytics...</div>
    </div>
  );
}

// Default export with Suspense boundary (required for useSearchParams)
export default function AnalyticsDashboard() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AnalyticsDashboardContent />
    </Suspense>
  );
}
