// client/src/components/project/api/RouteFilters.jsx
//
// Filter controls for the API Explorer route catalog.
// Provides search with debouncing, method chips, auth status toggle, and framework filtering.

import { useState, useEffect } from "react";

const METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];

export default function RouteFilters({
  filters,
  frameworks = [],
  onFilterChange,
  onResetFilters,
  resultCount = 0,
  totalCount = 0,
}) {
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  const [prevSearch, setPrevSearch] = useState(filters.search || "");

  // Debounce search input by 250ms to prevent request flood while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFilterChange({ ...filters, search: localSearch });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, filters, onFilterChange]);

  // Synchronize when parent resets filters (React recommended state adjustment during render)
  if (filters.search !== prevSearch) {
    setPrevSearch(filters.search || "");
    setLocalSearch(filters.search || "");
  }

  const hasActiveFilters = Boolean(
    (filters.method && filters.method !== "ALL") ||
    (filters.framework && filters.framework !== "ALL") ||
    (filters.auth && filters.auth !== "ALL") ||
    (filters.search && filters.search.trim().length > 0)
  );

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
      {/* Top Row: Search Input & Auth Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs font-mono">
            🔍
          </span>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search path, handler, or controller..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs font-mono bg-[#050811] border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch("");
                onFilterChange({ ...filters, search: "" });
              }}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Framework Selector */}
        {frameworks.length > 0 && (
          <select
            value={filters.framework || "ALL"}
            onChange={(e) => onFilterChange({ ...filters, framework: e.target.value })}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#050811] border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
          >
            <option value="ALL">All Frameworks</option>
            {frameworks.map((fw) => (
              <option key={fw} value={fw}>
                {fw.toUpperCase()}
              </option>
            ))}
          </select>
        )}

        {/* Auth Toggle Pill */}
        <div className="flex items-center rounded-lg border border-white/10 bg-[#050811] p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, auth: "ALL" })}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              filters.auth === "ALL" || !filters.auth
                ? "bg-white/10 text-slate-100 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Auth
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, auth: "true" })}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
              filters.auth === "true"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                : "text-slate-400 hover:text-cyan-300"
            }`}
          >
            <span>🔒</span> Protected
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, auth: "false" })}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              filters.auth === "false"
                ? "bg-slate-700/50 text-slate-200 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Public
          </button>
        </div>
      </div>

      {/* Bottom Row: HTTP Method Chips & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
        {/* Method Chips */}
        <div className="flex flex-wrap items-center gap-1">
          {METHODS.map((m) => {
            const isSelected = (filters.method || "ALL") === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onFilterChange({ ...filters, method: m })}
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* Status / Reset */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] font-mono text-slate-500">
            Showing <strong className="text-slate-300">{resultCount}</strong> of {totalCount}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
