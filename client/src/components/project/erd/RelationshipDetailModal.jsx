// client/src/components/project/erd/RelationshipDetailModal.jsx
export default function RelationshipDetailModal({ relationship, onClose, onSelectEntity }) {
  if (!relationship) return null;

  const data = relationship.data || relationship;
  const src = data.sourceEntity || data.source;
  const tgt = data.targetEntity || data.target;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#08131e] shadow-2xl overflow-hidden p-6 text-slate-100 space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-sm">
              ⇄
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Relationship Connector</h3>
              <p className="text-[11px] font-mono text-emerald-400">
                {data.crowNotation || data.type || "Association"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Entities Visual Flow */}
        <div className="grid grid-cols-5 items-center gap-2 p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center">
          <div className="col-span-2 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Source Entity
            </span>
            <button
              type="button"
              onClick={() => onSelectEntity && onSelectEntity(src)}
              className="text-xs font-mono font-bold text-emerald-300 hover:underline block truncate w-full"
            >
              {src}
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              Field: <code className="text-amber-300">{data.sourceField || "_id"}</code>
            </span>
          </div>

          <div className="col-span-1 flex flex-col items-center">
            <span className="text-xs font-bold text-emerald-400">→</span>
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              {data.crowNotation || data.type}
            </span>
          </div>

          <div className="col-span-2 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Target Entity
            </span>
            <button
              type="button"
              onClick={() => onSelectEntity && onSelectEntity(tgt)}
              className="text-xs font-mono font-bold text-emerald-300 hover:underline block truncate w-full"
            >
              {tgt}
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              Field: <code className="text-emerald-300">{data.targetField || "_id"}</code>
            </span>
          </div>
        </div>

        {/* Technical Attributes Table */}
        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-slate-400">Relationship Type</span>
            <span className="text-slate-200 capitalize">{data.type || "many-to-one"}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-slate-400">Cardinality</span>
            <span className="text-emerald-300 font-bold">{data.crowNotation || "N:1"}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-slate-400">Enforcement</span>
            <span className={data.isPhysical ? "text-emerald-300" : "text-cyan-300"}>
              {data.isPhysical ? "Physical Mongoose ObjectId ref" : "Logical Multi-Tenant Reference"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-slate-400">Constraint</span>
            <span className={data.required ? "text-cyan-300 font-semibold" : "text-slate-400"}>
              {data.required ? "Required (Non-Nullable)" : "Optional"}
            </span>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 leading-relaxed">
            {data.description}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

