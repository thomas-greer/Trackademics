import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors, shadows, radius } from "../theme";

const MUTED = colors.textSubtle;
const PIE_COLORS = [colors.primary, colors.accent];

function fmtShort(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ProfileAnalyticsCharts({ analytics, showHeader = true }) {
  if (!analytics?.last_7_days) return null;

  const {
    last_7_days,
    this_week_minutes,
    last_week_minutes,
    this_week_percent,
    last_week_percent,
    week_range_this,
    week_range_last,
    community,
  } = analytics;

  const pieData = [
    { name: "This week", value: Math.max(0, this_week_minutes) },
    { name: "Last week", value: Math.max(0, last_week_minutes) },
  ];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const compareBars = [
    { name: "You (this week)", minutes: Number(community?.your_this_week_minutes ?? 0) },
    { name: "Community avg", minutes: Number(community?.avg_this_week_minutes ?? 0) },
    { name: "Community median", minutes: Number(community?.median_this_week_minutes ?? 0) },
  ];

  const maxBar = Math.max(
    ...compareBars.map((d) => d.minutes),
    1
  );

  const beats = community?.beats_percent_of_peers;
  const peerCount = community?.peer_count ?? 0;

  return (
    <div style={sectionWrap}>
      {showHeader && (
        <>
          <h2 style={sectionTitle}>Study insights</h2>
          <p style={sectionSubtitle}>
            This week: {fmtShort(week_range_this?.start)}–
            {fmtShort(week_range_this?.end)}. Last week: {fmtShort(week_range_last?.start)}–
            {fmtShort(week_range_last?.end)}.
          </p>
        </>
      )}

      <div style={insightsGrid}>
        <div style={{ ...card, ...sessionsTrendCard }}>
          <h3 style={cardTitle}>Last 7 days — minutes studied</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart
                data={last_7_days}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: colors.primaryMuted }}
                  contentStyle={{
                    borderRadius: radius.md,
                    border: `1px solid ${colors.cardBorder}`,
                    boxShadow: shadows.sm,
                  }}
                  formatter={(value) => [`${value} min`, "Studied"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date
                      ? `Date: ${payload[0].payload.date}`
                      : ""
                  }
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {last_7_days.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === last_7_days.length - 1 ? colors.accent : colors.primarySoft}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...card, ...pieCard }}>
          <h3 style={cardTitle}>This week vs last week</h3>
          <p style={cardHint}>
            Share of your combined study time across these two weeks (minutes in each week).
          </p>
          {pieTotal === 0 ? (
            <p style={emptyText}>No study sessions in these two weeks yet.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} minutes`, name]}
                    contentStyle={{
                      borderRadius: radius.md,
                      border: `1px solid ${colors.cardBorder}`,
                      boxShadow: shadows.sm,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {pieTotal > 0 && (
            <p style={summaryLine}>
              <strong>This week:</strong> {this_week_percent}% of your two-week total ·{" "}
              <strong>Last week:</strong> {last_week_percent}%
            </p>
          )}
        </div>
        <div style={{ ...card, ...comparisonCard }}>
          <h3 style={cardTitle}>How you compare (this week)</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={compareBars}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} horizontal={false} />
                <XAxis type="number" domain={[0, maxBar * 1.15]} tick={{ fill: MUTED, fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fill: colors.textMuted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`${v} minutes`, ""]}
                  contentStyle={{
                    borderRadius: radius.md,
                    border: `1px solid ${colors.cardBorder}`,
                    boxShadow: shadows.sm,
                  }}
                />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={22}>
                  {compareBars.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0 ? colors.primary : i === 1 ? colors.primarySoft : colors.chartTertiary
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={compareFooter}>
            {peerCount === 0 ? (
              <p style={emptyText}>Add more student accounts to see a peer comparison.</p>
            ) : beats === null || beats === undefined ? (
              <p style={emptyText}>Comparison unavailable.</p>
            ) : (
              <p style={peerLine}>
                You studied more than <strong>{beats}%</strong> of other students this week (
                <strong>{peerCount}</strong> others on Trackademic).
              </p>
            )}
            <p style={peerLineMuted}>
              Community average: {community?.avg_this_week_minutes} min · Median:{" "}
              {community?.median_this_week_minutes} min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionWrap = {
  marginTop: "24px",
};

const sectionTitle = {
  margin: "0 0 6px 0",
  fontSize: "22px",
  fontWeight: 800,
  color: colors.primary,
  letterSpacing: "-0.02em",
};

const sectionSubtitle = {
  margin: "0 0 18px 0",
  fontSize: "13px",
  color: colors.textMuted,
  lineHeight: 1.45,
};

const insightsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch",
};

const sessionsTrendCard = {
  gridColumn: "span 2",
};

const pieCard = {
  gridColumn: "span 1",
};

const comparisonCard = {
  gridColumn: "span 1",
};

const card = {
  background: colors.card,
  borderRadius: radius.lg,
  padding: "18px 18px 14px",
  boxShadow: shadows.sm,
  border: `1px solid ${colors.cardBorder}`,
};

const cardTitle = {
  margin: "0 0 6px 0",
  fontSize: "16px",
  fontWeight: 700,
  color: colors.primary,
};

const cardHint = {
  margin: "0 0 10px 0",
  fontSize: "12px",
  color: colors.textMuted,
  lineHeight: 1.4,
};

const emptyText = {
  margin: "24px 0",
  textAlign: "center",
  color: colors.textSubtle,
  fontSize: "14px",
};

const summaryLine = {
  margin: "8px 0 0",
  fontSize: "13px",
  color: colors.textMuted,
  textAlign: "center",
};

const compareFooter = {
  marginTop: "12px",
  paddingTop: "4px",
};

const peerLine = {
  margin: "0 0 6px 0",
  fontSize: "14px",
  color: colors.text,
  lineHeight: 1.5,
};

const peerLineMuted = {
  margin: 0,
  fontSize: "13px",
  color: colors.textMuted,
};

export default ProfileAnalyticsCharts;
