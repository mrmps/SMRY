"use client";

import { useSearchParams } from "next/navigation";
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
interface DashboardData {
  timeRange: string;
  generatedAt: string;
  bufferStats: {
    size: number;
    maxSize: number;
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
    error_count: number;
  }>;
  realtimePopular: Array<{
    url: string;
    hostname: string;
    count: number;
  }>;
}

export default function AnalyticsDashboard() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "24h";

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin?range=${range}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch analytics");
      }
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">SMRY Analytics</h1>
            <p className="text-zinc-400 text-sm">
              Last updated: {new Date(data.generatedAt).toLocaleString()} |
              Buffer: {data.bufferStats.size}/{data.bufferStats.maxSize}
            </p>
          </div>
          <div className="flex gap-2">
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

        {/* Error Breakdown */}
        {data.errorBreakdown.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mt-8">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Error Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">
                      Hostname
                    </th>
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">
                      Error Type
                    </th>
                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.errorBreakdown.slice(0, 20).map((item, i) => (
                    <tr
                      key={i}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                        {item.hostname}
                      </td>
                      <td className="py-3 px-4 text-red-400 text-xs">
                        {item.error_type}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-300">
                        {item.error_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
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
