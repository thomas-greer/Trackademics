import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors, shadows, radius } from "../theme";

const MUTED = colors.textSubtle;

function fmtRange(isoA, isoB) {
  if (!isoA || !isoB) return "";
  try {
    const da = new Date(isoA + "T12:00:00");
    const db = new Date(isoB + "T12:00:00");
    return `${da.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${db.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "";
  }
}

function FeedCommunityStats({ stats }) {
  if (!stats?.week_daily_hours) return null;

  const { week_daily_hours, cumulative_week_hours, week_start, week_end, week_total_hours, total_hours_all_time } =
    stats;

  return (
    <div>
      <p style={{ fontSize: "12px", color: MUTED, margin: "0 0 10px", lineHeight: 1.45 }}>
        Everyone on Trackademic · calendar week {fmtRange(week_start, week_end)}
      </p>

      <div
        style={{
          textAlign: "center",
          padding: "14px 12px",
          borderRadius: radius.md,
          background: `linear-gradient(135deg, ${colors.primaryMuted} 0%, ${colors.accentMuted} 100%)`,
          border: `1px solid ${colors.cardBorder}`,
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: colors.primary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Total study time (all users)
        </div>
        <div style={{ fontSize: "28px", fontWeight: 800, color: colors.primary, lineHeight: 1.15, marginTop: "6px" }}>
          {total_hours_all_time}
          <span style={{ fontSize: "15px", fontWeight: 600, color: colors.textMuted, marginLeft: "6px" }}>hours</span>
        </div>
        <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "8px" }}>
          This week: <strong style={{ color: colors.text }}>{week_total_hours} hrs</strong> logged
        </div>
      </div>

      <h4 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 700, color: colors.primary }}>
        Community hours by day
      </h4>
      <div style={{ width: "100%", height: 150 }}>
        <ResponsiveContainer>
          <BarChart
            data={week_daily_hours}
            margin={{ top: 6, right: 6, left: 0, bottom: 2 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
              tickFormatter={(v) => (Number.isInteger(v) ? v : Number(v).toFixed(1))}
            />
            <Tooltip
              formatter={(value) => [`${value} hrs`, "Studied"]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date ? `Date: ${payload[0].payload.date}` : ""
              }
              contentStyle={{
                borderRadius: radius.md,
                border: `1px solid ${colors.cardBorder}`,
                fontSize: "12px",
                boxShadow: shadows.sm,
              }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={28} fill={colors.primarySoft} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ margin: "14px 0 6px", fontSize: "13px", fontWeight: 700, color: colors.primary }}>
        Cumulative community hours (Mon → Sun)
      </h4>
      <div style={{ width: "100%", height: 130 }}>
        <ResponsiveContainer>
          <LineChart
            data={cumulative_week_hours}
            margin={{ top: 6, right: 8, left: 0, bottom: 2 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              formatter={(value) => [`${value} hrs`, "Running total"]}
              contentStyle={{
                borderRadius: radius.md,
                border: `1px solid ${colors.cardBorder}`,
                fontSize: "12px",
                boxShadow: shadows.sm,
              }}
            />
            <Line
              type="monotone"
              dataKey="hours"
              stroke={colors.primary}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.primary }}
              activeDot={{ r: 5, fill: colors.accent, stroke: colors.primary }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default FeedCommunityStats;
