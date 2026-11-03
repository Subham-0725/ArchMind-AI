// client/src/components/project/api/RouteList.jsx
//
// Scrollable list of extracted API routes.
// Highlights active route, displays HTTP verbs with distinct color schemes,
// handler metadata, and quick navigation indicators.

const METHOD_THEMES = {
  GET: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
  },
  POST: {
    badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    text: "text-cyan-400",
  },
  PUT: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    text: "text-amber-400",
  },
  PATCH: {
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    text: "text-purple-400",
  },
  DELETE: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    text: "text-red-400",
  },
  ALL: {
    badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    text: "text-slate-400",
  },
};

/**
 * Highlights route path parameters (e.g. :id, {user_id}, <int:id>)
 */
function renderRoutePath(path = "") {
  const parts = path.split(/([/:][a-zA-Z0-9_-]+|\{[^}]+\}|<[^>]+>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith(":") || (part.startsWith("{") && part.endsWith("}")) || (part.startsWith("<") && part.endsWith(">"))) {
      return (
        <span key={idx} className="text-cyan-300 font-bold bg-cyan-500/10 px-1 py-0.2 rounded">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function RouteList({
  routes = [],
  selectedRouteId,
  onSelectRoute,
  onResetFilters,
  totalRoutes = 0,
}) {
  if (totalRoutes === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-white/[0.08] bg-white/[0.01] min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-500 text-xl mb-3">
          ⇄
        </div>
        <h4 className="text-sm font-bold text-slate-200">No API Endpoints Detected</h4>
        <p className="text-xs font-mono text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
          ArchMind scanned the repository but did not detect Express, Fastify, NestJS, FastAPI, Flask, or Django route definitions.
        </p>
        <span className="px-3 py-1 rounded-full text-[11px] font-mono border bg-slate-800/60 text-slate-400 border-slate-700/60">
          [Zero Routes Found]
        </span>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-white/[0.08] bg-white/[0.01] min-h-[300px]">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-base mb-3">
          🔍
        </div>
        <h4 className="text-sm font-semibold text-slate-200">No Matching Routes</h4>
        <p className="text-xs font-mono text-slate-500 max-w-xs mt-1 mb-4">
          No endpoints match your current filter or search criteria.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[640px] pr-1 custom-scrollbar">
      {routes.map((route) => {
        const isSelected = selectedRouteId === route.routeId;
        const theme = METHOD_THEMES[route.method] || METHOD_THEMES.ALL;
        const filename = route.sourceFile ? route.sourceFile.split("/").pop() : "unknown";
        const startLine = route.lineRange?.startLine || 1;

        return (
          <div
            key={route.routeId}
            onClick={() => onSelectRoute(route.routeId)}
            className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
              isSelected
                ? "bg-cyan-500/[0.08] border-cyan-500/50 shadow-md shadow-cyan-500/5"
                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
            }`}
          >
            {/* Active Indicator Bar on Left */}
            {isSelected && (
              <div className="absolute left-0 inset-y-2 w-1 bg-cyan-400 rounded-r" />
            )}

            {/* Row 1: Method, Path, Auth & Confidence */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Method Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${theme.badge}`}
                >
                  {route.method}
                </span>

                {/* Path */}
                <span
                  className={`text-xs font-mono font-semibold truncate ${
                    isSelected ? "text-cyan-200" : "text-slate-200 group-hover:text-cyan-300"
                  }`}
                  title={route.path}
                >
                  {renderRoutePath(route.path)}
                </span>
              </div>

              {/* Right Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Auth Protected */}
                {route.isAuthProtected && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1"
                    title="Protected by authentication middleware or guard"
                  >
                    <span>🔒</span>
                    <span className="hidden sm:inline">Auth</span>
                  </span>
                )}

                {/* Framework Tag */}
                {route.framework && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-white/[0.04] border border-white/[0.08] uppercase">
                    {route.framework}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Handler name, Controller, and Source Citation preview */}
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
              <div className="flex items-center gap-2 truncate">
                {route.handlerName ? (
                  <span className="text-slate-400 truncate">
                    fn: <strong className="text-slate-300 font-semibold">{route.handlerName}</strong>
                    {route.controllerName && ` (${route.controllerName})`}
                  </span>
                ) : (
                  <span className="text-slate-600 italic">inline handler</span>
                )}
              </div>

              {/* File & Line Citation */}
              <span
                className="text-[10px] text-slate-500 hover:text-slate-300 truncate shrink-0"
                title={`${route.sourceFile}:${startLine}`}
              >
                {filename}:{startLine}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

