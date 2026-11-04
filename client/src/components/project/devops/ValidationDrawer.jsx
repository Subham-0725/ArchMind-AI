// client/src/components/project/devops/ValidationDrawer.jsx
//
// Validation Results Panel for ArchMind AI DevOps artifacts.
// Displays overall validation status, validation level, errors, warnings,
// and itemized deterministic checks.

export default function ValidationDrawer({
  validation,
  isValidating = false,
  onRevalidate,
}) {
  if (!validation) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#070c16] p-4 text-center">
        <p className="text-xs text-slate-500 font-mono">No validation report available for this artifact.</p>
      </div>
    );
  }

  const isValid = validation.valid === true;
  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  const checks = Array.isArray(validation.checks) ? validation.checks : [];
  const level = validation.validationLevel || "structural";

  // Determine badge state
  let statusBadge = {
    label: "Passed",
    style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: "✓",
  };

  if (!isValid || errors.length > 0) {
    statusBadge = {
      label: "Failed",
      style: "bg-red-500/15 text-red-400 border-red-500/30",
      icon: "✕",
    };
  } else if (warnings.length > 0) {
    statusBadge = {
      label: "Warnings",
      style: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: "⚠️",
    };
  }

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-[#070c16] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🛡️</span>
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
              Validation Report
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Level: <span className="text-cyan-400 uppercase font-semibold">{level}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${statusBadge.style}`}
          >
            <span>{statusBadge.icon}</span>
            <span>{statusBadge.label}</span>
          </span>

          {onRevalidate && (
            <button
              type="button"
              onClick={onRevalidate}
              disabled={isValidating}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
              title="Re-run deterministic validation checks"
            >
              {isValidating ? (
                <>
                  <span className="w-3 h-3 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <span>⟳</span>
                  <span>Validate</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 text-xs font-mono">
        {/* Errors Block */}
        {errors.length > 0 && (
          <div className="p-3.5 rounded-lg bg-red-500/[0.08] border border-red-500/25">
            <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs">
              <span>✕</span>
              <span>Blocking Validation Errors ({errors.length})</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5 list-disc text-red-300/90 text-[11px] leading-relaxed">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings Block */}
        {warnings.length > 0 && (
          <div className="p-3.5 rounded-lg bg-amber-500/[0.08] border border-amber-500/25">
            <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs">
              <span>⚠️</span>
              <span>Review Warnings ({warnings.length})</span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-5 list-disc text-amber-300/90 text-[11px] leading-relaxed">
              {warnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Itemized Checks */}
        <div>
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Itemized Checks ({checks.filter((c) => c.passed).length}/{checks.length} Passed)
          </h5>

          {checks.length === 0 ? (
            <p className="text-slate-500 text-[11px] italic">No itemized check data recorded.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {checks.map((chk, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors ${
                    chk.passed
                      ? "bg-white/[0.015] border-white/[0.06] hover:border-white/10"
                      : "bg-red-500/[0.04] border-red-500/20"
                  }`}
                >
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                      chk.passed
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {chk.passed ? "✓" : "✕"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200 text-xs">
                        {formatCheckName(chk.name)}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          chk.passed ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {chk.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    {chk.message && (
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {chk.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCheckName(name) {
  if (!name) return "Check";
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

