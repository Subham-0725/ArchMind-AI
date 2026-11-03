// client/src/components/project/api/RouteSummaryBar.jsx
//
// Summary metrics bar for API Explorer.
// Displays total route count, breakdown by HTTP method, auth protection stats, and detected frameworks.

export default function RouteSummaryBar({ summary = {}, frameworks = [], totalRoutes = 0 }) {
  const byMethod = summary.byMethod || {};
  const authProtectedCount = summary.authProtectedCount || 0;
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  const METHOD_COLORS = {
    GET: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    POST: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    PUT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    PATCH: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    DELETE: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {/* Total Routes */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Total Endpoints
        </span>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-2xl font-bold font-mono text-slate-100">
            {totalRoutes}
          </span>
          <span className="text-[10px] font-mono text-slate-500">routes</span>
        </div>
      </div>

      {/* Auth Protected */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] p-3 flex flex-col justify-between">
        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1">
          <span>🔒</span> Protected
        </span>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {authProtectedCount}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {totalRoutes > 0 ? `${Math.round((authProtectedCount / totalRoutes) * 100)}%` : "0%"}
          </span>
        </div>
      </div>

      {/* Method Badges Container (Col span 2 or 3) */}
      <div className="col-span-2 sm:col-span-2 lg:col-span-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Methods Distribution
        </span>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {methods.map((m) => {
            const count = byMethod[m] || 0;
            const style = METHOD_COLORS[m] || "text-slate-400 bg-slate-500/10 border-slate-500/20";
            return (
              <span
                key={m}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${style}`}
              >
                <span className="font-bold">{m}</span>
                <span className="text-[10px] opacity-80">({count})</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Detected Frameworks */}
      <div className="col-span-2 sm:col-span-2 lg:col-span-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Frameworks
        </span>
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          {frameworks && frameworks.length > 0 ? (
            frameworks.map((fw) => (
              <span
                key={fw}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase"
              >
                {fw}
              </span>
            ))
          ) : (
            <span className="text-xs font-mono text-slate-500">None detected</span>
          )}
        </div>
      </div>
    </div>
  );
}

