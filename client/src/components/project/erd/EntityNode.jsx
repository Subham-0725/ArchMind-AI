// client/src/components/project/erd/EntityNode.jsx
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const EntityNode = ({ data, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const fields = data.fields || [];
  const entityName = data.name || "Entity";
  const tableName = data.tableName || entityName.toLowerCase();

  return (
    <div className="relative rounded-xl border border-emerald-500/30 bg-[#08131e]/95 backdrop-blur-md shadow-[0_0_25px_rgba(16,185,129,0.12)] min-w-[260px] max-w-[320px] overflow-hidden transition-all duration-200 hover:border-emerald-500/50 hover:shadow-[0_0_35px_rgba(16,185,129,0.18)]">
      {/* Target Handle */}
      <Handle
        type="target"
        position={targetPosition}
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#060a12]"
      />

      {/* Entity Card Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold shrink-0">
            ⬡
          </span>
          <div>
            <div className="text-xs font-bold text-slate-100 tracking-wide">{entityName}</div>
            <div className="text-[10px] font-mono text-emerald-400/80">{tableName}</div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 shrink-0">
          {fields.length} {fields.length === 1 ? "field" : "fields"}
        </span>
      </div>

      {/* Fields List */}
      <div className="p-2 space-y-0.5 max-h-[300px] overflow-y-auto">
        {fields.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-500 text-center py-3">
            No explicit schema fields
          </div>
        ) : (
          fields.map((field, idx) => (
            <div
              key={field.name || idx}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] transition-colors group"
            >
              {/* Left: indicator + field name */}
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                {field.isPrimary ? (
                  <span
                    className="px-1 py-px text-[8px] font-mono font-bold rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0"
                    title="Primary Key"
                  >
                    PK
                  </span>
                ) : field.isForeign ? (
                  <span
                    className="px-1 py-px text-[8px] font-mono font-bold rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 shrink-0"
                    title={field.references ? `FK → ${field.references.entity}.${field.references.field}` : "Foreign Key"}
                  >
                    FK
                  </span>
                ) : field.isRequired && !field.isNullable ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-cyan-500/70 shrink-0"
                    title="Required"
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"
                    title="Optional"
                  />
                )}

                <span className="text-xs font-mono text-slate-200 truncate">{field.name}</span>

                {/* Unique badge */}
                {field.isUnique && !field.isPrimary && (
                  <span
                    className="px-1 py-px text-[7px] font-mono font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0"
                    title="Unique"
                  >
                    U
                  </span>
                )}
              </div>

              {/* Right: type */}
              <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0 max-w-[90px] truncate">
                {field.type || "String"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer: references summary (if any FK fields) */}
      {fields.some((f) => f.isForeign && f.references) && (
        <div className="px-3 py-1.5 border-t border-white/[0.06] flex flex-wrap gap-1.5">
          {fields
            .filter((f) => f.isForeign && f.references)
            .map((f, i) => (
              <span
                key={i}
                className="text-[9px] font-mono text-amber-400/70 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/15 truncate max-w-full"
                title={`${f.name} → ${f.references.entity}.${f.references.field}`}
              >
                {f.name} → {f.references.entity}
              </span>
            ))}
        </div>
      )}

      {/* Source Handle */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#060a12]"
      />
    </div>
  );
};

export default memo(EntityNode);
