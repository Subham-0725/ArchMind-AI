// client/src/components/project/erd/EntityNode.jsx
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const EntityNode = ({ data, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const entityName = data.name || "Entity";
  const collectionName = data.collectionName || data.tableName || entityName.toLowerCase();
  const isEmbedded = Boolean(data.isEmbedded);
  const isSelected = Boolean(data.isSelected);
  const isMatch = Boolean(data.isMatch);
  const isDimmed = Boolean(data.isDimmed);

  // Show up to 8 fields in the preview card; remaining in drawer
  const previewFields = fields.slice(0, 8);
  const remainingCount = Math.max(0, fields.length - previewFields.length);

  // Dynamic theme colors based on entity nature
  const borderClass = isSelected
    ? "border-sky-400 ring-2 ring-sky-400/40 shadow-[0_0_30px_rgba(56,189,248,0.35)]"
    : isMatch
    ? "border-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-pulse"
    : isEmbedded
    ? "border-purple-500/35 hover:border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.12)]"
    : "border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.12)]";

  const headerGradient = isEmbedded
    ? "from-purple-500/20 via-indigo-500/10 to-transparent"
    : "from-emerald-500/20 via-cyan-500/10 to-transparent";

  const iconBg = isEmbedded
    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";

  return (
    <div
      className={`relative rounded-xl border bg-[#08131e]/95 backdrop-blur-md min-w-[280px] max-w-[320px] overflow-hidden transition-all duration-200 select-none ${borderClass} ${
        isDimmed ? "opacity-30 pointer-events-none" : "opacity-100"
      }`}
      style={{ cursor: "pointer" }}
    >
      {/* Target Connection Handle */}
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-[#04070d] transition-transform hover:scale-125"
      />

      {/* Entity Card Header */}
      <div className={`px-3.5 py-2.5 bg-gradient-to-r ${headerGradient} border-b border-white/[0.08] flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-mono font-bold shrink-0 ${iconBg}`}>
            {isEmbedded ? "◈" : "⬡"}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-100 tracking-wide truncate">
                {entityName}
              </span>
              {isEmbedded && (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  SUBDOC
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-emerald-400/80 truncate">
              {collectionName}
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-white/[0.05] border border-white/[0.1] text-slate-300 shrink-0">
          {fields.length} {fields.length === 1 ? "field" : "fields"}
        </span>
      </div>

      {/* Fields List */}
      <div className="p-2 space-y-1">
        {fields.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-500 text-center py-3">
            No explicit schema fields
          </div>
        ) : (
          previewFields.map((field, idx) => (
            <div
              key={field.name || idx}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] transition-colors group"
            >
              {/* Left: badges + name */}
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                {field.primaryKey ? (
                  <span
                    className="px-1.5 py-px text-[8px] font-mono font-bold rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0 shadow-sm"
                    title="Primary Key (_id)"
                  >
                    PK
                  </span>
                ) : field.foreignKey ? (
                  <span
                    className="px-1.5 py-px text-[8px] font-mono font-bold rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 shrink-0 shadow-sm"
                    title={
                      field.references
                        ? `Foreign Key → ${field.references.entity}.${field.references.field} (${field.references.type})`
                        : "Foreign Key reference"
                    }
                  >
                    FK
                  </span>
                ) : field.required ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"
                    title="Required field"
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"
                    title="Optional field"
                  />
                )}

                <span className="text-xs font-mono text-slate-200 truncate" title={field.name}>
                  {field.name}
                </span>

                {field.unique && !field.primaryKey && (
                  <span
                    className="px-1 py-px text-[7px] font-mono font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0"
                    title="Unique constraint"
                  >
                    UK
                  </span>
                )}

                {field.enumValues && (
                  <span
                    className="px-1 py-px text-[7px] font-mono font-semibold rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 shrink-0"
                    title={`Enum: [${field.enumValues.join(", ")}]`}
                  >
                    enum
                  </span>
                )}
              </div>

              {/* Right: type badge */}
              <span
                className="text-[10px] font-mono text-cyan-300/90 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0 max-w-[105px] truncate"
                title={field.type || "String"}
              >
                {field.type || "String"}
              </span>
            </div>
          ))
        )}

        {/* Remaining fields indicator */}
        {remainingCount > 0 && (
          <div className="pt-1 text-center">
            <span className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-colors py-0.5 block">
              +{remainingCount} more fields (click to view all)
            </span>
          </div>
        )}
      </div>

      {/* Source Connection Handle */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-[#04070d] transition-transform hover:scale-125"
      />
    </div>
  );
};

export default memo(EntityNode);
