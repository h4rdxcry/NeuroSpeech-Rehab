import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, CheckCircle2, Mic2, BarChart2, ArrowRight } from "lucide-react";
import { listAll } from "../../lib/api";
import type { Prediction, Session } from "../../lib/types";

function statusClass(status: string) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in-progress";
  return "default";
}

export default function PatientProgress() {
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ["patient-sessions", "all"],
    queryFn: () => listAll<Session>("/api/v1/sessions/sessions"),
  });
  const { data: predictions, isLoading: predictionsLoading, error: predictionsError } = useQuery({
    queryKey: ["patient-predictions-progress"],
    queryFn: () => listAll<Prediction>("/api/v1/predictions/predictions"),
  });

  const completed = sessions?.filter((s) => s.status === "completed").length ?? 0;
  const total = sessions?.length ?? 0;
  const orderedSessions = [...(sessions ?? [])].sort((a, b) =>
    b.session_date.localeCompare(a.session_date)
  );

  // Build chart data — cumulative completed sessions by date
  const chartData = (() => {
    const byDate: Record<string, number> = {};
    sessions?.filter(s => s.status === "completed").forEach(s => {
      const d = s.session_date.slice(0, 10);
      byDate[d] = (byDate[d] ?? 0) + 1;
    });
    let cum = 0;
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, n]) => {
      cum += n;
      return { date: date.slice(5), total: cum }; // show MM-DD
    });
  })();

  return (
    <div className="page-stack">
      {/* Page heading */}
      <div className="page-heading">
        <span className="eyebrow">YOUR JOURNEY</span>
        <h1>Progress &amp; history</h1>
        <p>Your practice record — research results, not clinical scores.</p>
      </div>

      {/* Error alerts */}
      {sessionsError && (
        <p className="notice" role="alert" style={{ borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c", background: "#fff1f1" }}>
          Unable to load session history.
        </p>
      )}
      {predictionsError && (
        <p className="notice" role="alert" style={{ borderColor: "rgba(185,28,28,0.2)", color: "#b91c1c", background: "#fff1f1" }}>
          Unable to load speech analysis results.
        </p>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label"><CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />Completed</span>
          <span className="stat-card-value">{sessionsError ? "—" : sessionsLoading ? "·" : completed}</span>
          <span className="stat-card-sub">sessions finished</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label"><Mic2 size={14} style={{ display: "inline", marginRight: 4 }} />Recorded</span>
          <span className="stat-card-value">{sessionsError ? "—" : sessionsLoading ? "·" : total}</span>
          <span className="stat-card-sub">total sessions</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label"><BarChart2 size={14} style={{ display: "inline", marginRight: 4 }} />Analyses</span>
          <span className="stat-card-value">{predictionsError ? "—" : predictionsLoading ? "·" : predictions?.length ?? 0}</span>
          <span className="stat-card-sub">speech results</span>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <section className="surface" aria-label="Progress chart">
          <div className="section-title"><TrendingUp size={18} aria-hidden="true" /><h2>Sessions completed over time</h2></div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0058bd" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0058bd" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#727785" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#727785" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid rgba(11,28,48,0.08)", fontSize: "0.82rem", boxShadow: "0 8px 24px -4px rgba(15,23,42,0.12)" }}
                labelStyle={{ fontWeight: 700, color: "#0b1c30" }}
              />
              <Area type="monotone" dataKey="total" name="Completed" stroke="#0058bd" strokeWidth={2} fill="url(#progressGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Session history */}
      <section className="surface" aria-labelledby="hist-title">
        <div className="section-title"><h2 id="hist-title">Session history</h2></div>
        {sessionsLoading ? (
          <p className="empty-state" role="status">Loading sessions…</p>
        ) : !sessionsError && (
          !orderedSessions.length ? (
            <p className="empty-state">No sessions yet. Your sessions will appear here after your first practice.</p>
          ) : (
            <ul className="session-list">
              {orderedSessions.map((session) => (
                <li key={session.id}>
                  <Link to={`/patient/session?sessionId=${session.id}`}>
                    <span className="icon-tile"><Mic2 size={16} aria-hidden="true" /></span>
                    <span>
                      <strong>Session {session.session_number}</strong>
                      <small>{session.session_date}</small>
                    </span>
                    <span className={`status-badge ${statusClass(session.status)}`} style={{ marginLeft: "auto", marginRight: "8px" }}>
                      {session.status.replace(/_/g, " ")}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" style={{ color: "#727785", flexShrink: 0 }} />
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {/* Live analysis results */}
      <section className="surface" aria-labelledby="analysis-title">
        <div className="section-title"><BarChart2 size={18} aria-hidden="true" /><h2 id="analysis-title">Live analysis results</h2></div>
        {predictionsLoading ? (
          <p className="empty-state" role="status">Loading analysis results…</p>
        ) : !predictionsError && (
          !predictions?.length ? (
            <p className="empty-state">No analyses yet — results appear here after a live session.</p>
          ) : (
            <div className="data-table">
              {predictions.map((prediction) => (
                <div key={prediction.id} className="data-table-row">
                  <div>
                    <p style={{ fontWeight: 600, color: "#0b1c30", margin: 0, fontSize: "0.95rem" }}>
                      {prediction.predicted_label || "Empty transcript"}
                    </p>
                    <p className="muted" style={{ marginTop: "2px" }}>
                      Signal: {prediction.signal_quality_state} · Model {prediction.model_version}
                    </p>
                    <p className="muted">{new Date(prediction.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  );
}
