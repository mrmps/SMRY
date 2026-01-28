"use client";

import * as React from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  RadialBar,
  RadialBarChart as RechartsRadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

// ============================================================================
// Chart Theme - Dark mode optimized
// ============================================================================

export const chartColors = {
  primary: "#10b981", // emerald-500
  secondary: "#3b82f6", // blue-500
  tertiary: "#f59e0b", // amber-500
  quaternary: "#06b6d4", // cyan-500 (accent color)
  danger: "#ef4444", // red-500
  success: "#22c55e", // green-500
  warning: "#eab308", // yellow-500
  muted: "#71717a", // zinc-500
  background: "#18181b", // zinc-900
  border: "#3f3f46", // zinc-700
  text: "#a1a1aa", // zinc-400
  textBright: "#fafafa", // zinc-50
};

export const chartTheme = {
  grid: { stroke: chartColors.border, strokeDasharray: "3 3" },
  axis: { stroke: chartColors.muted, fontSize: 11 },
  tooltip: {
    contentStyle: {
      backgroundColor: chartColors.background,
      border: `1px solid ${chartColors.border}`,
      borderRadius: "8px",
      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.5)",
    },
    labelStyle: { color: chartColors.text },
    itemStyle: { color: chartColors.textBright },
  },
};

// ============================================================================
// Chart Card - Container component
// ============================================================================

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  insight?: {
    type: "success" | "warning" | "danger" | "info";
    message: string;
  };
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
  insight,
}: ChartCardProps) {
  const insightColors = {
    success: "bg-emerald-950/50 border-emerald-800/50 text-emerald-400",
    warning: "bg-amber-950/50 border-amber-800/50 text-amber-400",
    danger: "bg-red-950/50 border-red-800/50 text-red-400",
    info: "bg-blue-950/50 border-blue-800/50 text-blue-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between p-5 pb-0">
        <div>
          <h3 className="font-semibold text-zinc-100">{title}</h3>
          {description && (
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
      {insight && (
        <div
          className={cn(
            "mx-5 mb-5 rounded-lg border px-3 py-2 text-xs",
            insightColors[insight.type]
          )}
        >
          {insight.type === "success" && "✓ "}
          {insight.type === "warning" && "⚠ "}
          {insight.type === "danger" && "✕ "}
          {insight.type === "info" && "ℹ "}
          {insight.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Metric Card - Enhanced KPI display
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label?: string;
  };
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  subtitle?: string;
  sparkline?: number[];
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  icon,
  subtitle,
  sparkline,
  className,
}: MetricCardProps) {
  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-zinc-400",
  };

  const trendBg = {
    up: "bg-emerald-950/50",
    down: "bg-red-950/50",
    neutral: "bg-zinc-800",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {title}
          </p>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {icon && (
          <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">{icon}</div>
        )}
      </div>

      {change && trend && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              trendBg[trend],
              trendColor[trend]
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "neutral" && "→"}
            {Math.abs(change.value)}%
          </span>
          {change.label && (
            <span className="text-xs text-zinc-500">{change.label}</span>
          )}
        </div>
      )}

      {sparkline && sparkline.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-30">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsAreaChart data={sparkline.map((v, i) => ({ v, i }))}>
              <defs>
                <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={chartColors.primary}
                fill="url(#sparklineGradient)"
                strokeWidth={1.5}
              />
            </RechartsAreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Area Chart
// ============================================================================

interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: Array<{ key: string; color: string; name: string }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number | undefined, name: string) => [string, string];
}

export function AreaChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  xAxisFormatter = (v) => v,
  yAxisFormatter = (v) => v.toLocaleString(),
  tooltipFormatter,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        {showGrid && <CartesianGrid {...chartTheme.grid} />}
        <XAxis
          dataKey={xKey}
          tickFormatter={xAxisFormatter}
          {...chartTheme.axis}
        />
        <YAxis tickFormatter={yAxisFormatter} {...chartTheme.axis} />
        <Tooltip
          {...chartTheme.tooltip}
          formatter={tooltipFormatter as never}
        />
        {showLegend && <Legend />}
        <defs>
          {yKeys.map(({ key, color }) => (
            <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        {yKeys.map(({ key, color, name }) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={name}
            stroke={color}
            fill={`url(#gradient-${key})`}
            strokeWidth={2}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Line Chart
// ============================================================================

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: Array<{ key: string; color: string; name: string; dashed?: boolean }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number | undefined, name: string) => [string, string];
}

export function LineChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  showDots = false,
  xAxisFormatter = (v) => v,
  yAxisFormatter = (v) => v.toLocaleString(),
  tooltipFormatter,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        {showGrid && <CartesianGrid {...chartTheme.grid} />}
        <XAxis
          dataKey={xKey}
          tickFormatter={xAxisFormatter}
          {...chartTheme.axis}
        />
        <YAxis tickFormatter={yAxisFormatter} {...chartTheme.axis} />
        <Tooltip {...chartTheme.tooltip} formatter={tooltipFormatter as never} />
        {showLegend && <Legend />}
        {yKeys.map(({ key, color, name, dashed }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={name}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dashed ? "5 5" : undefined}
            dot={showDots}
            connectNulls
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Bar Chart
// ============================================================================

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: Array<{ key: string; color: string; name: string }>;
  height?: number;
  layout?: "horizontal" | "vertical";
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  barSize?: number;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number | undefined, name: string) => [string, string];
}

export function BarChart({
  data,
  xKey,
  yKeys,
  height = 300,
  layout = "horizontal",
  showGrid = true,
  showLegend = true,
  stacked = false,
  barSize,
  xAxisFormatter = (v) => v,
  yAxisFormatter = (v) => v.toLocaleString(),
  tooltipFormatter,
}: BarChartProps) {
  const isVertical = layout === "vertical";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} layout={layout}>
        {showGrid && <CartesianGrid {...chartTheme.grid} />}
        {isVertical ? (
          <>
            <XAxis type="number" tickFormatter={yAxisFormatter} {...chartTheme.axis} />
            <YAxis
              dataKey={xKey}
              type="category"
              width={100}
              tickFormatter={xAxisFormatter}
              {...chartTheme.axis}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickFormatter={xAxisFormatter} {...chartTheme.axis} />
            <YAxis tickFormatter={yAxisFormatter} {...chartTheme.axis} />
          </>
        )}
        <Tooltip {...chartTheme.tooltip} formatter={tooltipFormatter as never} />
        {showLegend && <Legend />}
        {yKeys.map(({ key, color, name }) => (
          <Bar
            key={key}
            dataKey={key}
            name={name}
            fill={color}
            stackId={stacked ? "stack" : undefined}
            barSize={barSize}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Donut Chart
// ============================================================================

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
  centerLabel?: { value: string; label: string };
}

export function DonutChart({
  data,
  height = 250,
  innerRadius = 60,
  outerRadius = 90,
  showLabel = true,
  centerLabel,
}: DonutChartProps) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={
              showLabel
                ? ({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                : undefined
            }
            labelLine={showLabel}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip {...chartTheme.tooltip} />
        </RechartsPieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-zinc-100">
            {centerLabel.value}
          </span>
          <span className="text-xs text-zinc-500">{centerLabel.label}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Radial Progress Chart
// ============================================================================

interface RadialProgressProps {
  value: number;
  maxValue?: number;
  label: string;
  color?: string;
  height?: number;
  showValue?: boolean;
}

export function RadialProgress({
  value,
  maxValue = 100,
  label,
  color = chartColors.primary,
  height = 180,
  showValue = true,
}: RadialProgressProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const data = [{ name: label, value: percentage, fill: color }];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={data}
        >
          <RadialBar
            background={{ fill: chartColors.border }}
            dataKey="value"
            cornerRadius={10}
          />
        </RechartsRadialBarChart>
      </ResponsiveContainer>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-3xl font-bold text-zinc-100">
            {percentage.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-500">{label}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Data Table with sparklines
// ============================================================================

interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  maxHeight?: string;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  maxHeight = "400px",
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-800/90 backdrop-blur-sm">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 py-3 font-medium text-zinc-400",
                    alignClass[col.align || "left"]
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-zinc-800/50"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      "px-4 py-3 text-zinc-300",
                      alignClass[col.align || "left"]
                    )}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String(row[col.key as keyof T] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Badge variants for status/metrics
// ============================================================================

interface StatusBadgeProps {
  status: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  children,
  size = "sm",
}: StatusBadgeProps) {
  const colors = {
    success: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
    warning: "bg-amber-950/50 text-amber-400 border-amber-800/50",
    danger: "bg-red-950/50 text-red-400 border-red-800/50",
    info: "bg-blue-950/50 text-blue-400 border-blue-800/50",
    neutral: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        colors[status],
        sizes[size]
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Progress bar
// ============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "primary" | "success" | "warning" | "danger";
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  max = 100,
  color = "primary",
  showLabel = false,
  size = "md",
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colors = {
    primary: "bg-emerald-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };

  const sizes = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex-1 overflow-hidden rounded-full bg-zinc-800", sizes[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="min-w-[3rem] text-right text-xs text-zinc-400">
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Heatmap cell
// ============================================================================

interface HeatmapCellProps {
  value: number;
  maxValue: number;
  label?: string;
  colorScale?: "green" | "blue" | "red";
}

export function HeatmapCell({
  value,
  maxValue,
  label,
  colorScale = "green",
}: HeatmapCellProps) {
  const intensity = Math.min(value / maxValue, 1);

  const colors = {
    green: `rgba(16, 185, 129, ${intensity * 0.8})`,
    blue: `rgba(59, 130, 246, ${intensity * 0.8})`,
    red: `rgba(239, 68, 68, ${intensity * 0.8})`,
  };

  return (
    <div
      className="flex h-8 w-full items-center justify-center rounded text-xs font-medium text-zinc-100"
      style={{ backgroundColor: colors[colorScale] }}
    >
      {label ?? value.toFixed(0)}
    </div>
  );
}
