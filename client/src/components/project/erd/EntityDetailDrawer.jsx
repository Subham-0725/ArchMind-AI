// client/src/components/project/erd/EntityDetailDrawer.jsx
import { useState, useMemo } from "react";

export default function EntityDetailDrawer({ entity, onClose, onSelectEntity, relationships = [] }) {
  const [activeTab, setActiveTab] = useState("fields"); // 'fields' | 'indexes' | 'relationships'
  const [fieldSearch, setFieldSearch] = useState("");

  const fields = useMemo(() => (Array.isArray(entity?.fields) ? entity.fields : []), [entity]);
  const indexes = useMemo(() => (Array.isArray(entity?.indexes) ? entity.indexes : []), [entity]);

  // Filter fields by search
  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return fields;
    const q = fieldSearch.toLowerCase();
    return fields.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    );
  }, [fields, fieldSearch]);

  // Filter relationships involving this entity
  const entityRelationships = useMemo(() => {
    if (!entity?.name) return [];
    const name = entity.name.toLowerCase();
    return relationships.filter((r) => {
      const src = (r.sourceEntity || r.source || "").toLowerCase();
      const tgt = (r.targetEntity || r.target || "").toLowerCase();
      return src === name || tgt === name;
    });
  }, [entity, relationships]);

  if (!entity) return null;

  const isEmbedded = Boolean(entity.isEmbedded);
  const pkFields = fields.filter((f) => f.primaryKey);
  const fkFields = fields.filter((f) => f.foreignKey);
  const uniqueFields = fields.filter((f) => f.unique);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#070c16]/98 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center text-base font-bold shrink-0 ${
              isEmbedded
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {isEmbedded ? "◈" : "⬡"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 tracking-wide truncate">
                {entity.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  isEmbedded
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {isEmbedded ? "Embedded Subdocument" : "MongoDB Collection"}
              </span>
            </div>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">
              Collection: <span className="text-slate-300">{entity.collectionName || entity.tableName}</span>
            </p>
            {entity.description && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {entity.description}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="px-5 py-2.5 bg-black/40 border-b border-white/[0.06] flex flex-wrap items-center gap-3 text-xs font-mono">
        <span className="text-slate-400">
          Fields: <strong className="text-slate-200">{fields.length}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-emerald-400">
          PK: <strong className="text-emerald-300">{pkFields.length}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-amber-400">
          FKs: <strong className="text-amber-300">{fkFields.length}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-purple-400">
          Unique: <strong className="text-purple-300">{uniqueFields.length}</strong>
        </span>
        {indexes.length > 0 && (
          <>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400">
              Indexes: <strong className="text-cyan-300">{indexes.length}</strong>
            </span>
          </>
        )}
      </div>

      {/* Tab Nav */}
      <div className="flex items-center px-4 border-b border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setActiveTab("fields")}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "fields"
              ? "border-emerald-400 text-emerald-300 bg-white/[0.03]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Fields ({fields.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("indexes")}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "indexes"
              ? "border-emerald-400 text-emerald-300 bg-white/[0.03]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Indexes ({indexes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("relationships")}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "relationships"
              ? "border-emerald-400 text-emerald-300 bg-white/[0.03]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Relationships ({entityRelationships.length})
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
        {/* TAB 1: FIELDS */}
        {activeTab === "fields" && (
          <div className="space-y-3">
            {/* Field Search Input */}
            <div className="relative">
              <input
                type="text"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search schema fields..."
                className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              {fieldSearch && (
                <button
                  type="button"
                  onClick={() => setFieldSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {filteredFields.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-6 text-center">
                No matching fields found
              </p>
            ) : (
              <div className="space-y-2">
                {filteredFields.map((field, idx) => (
                  <div
                    key={field.name || idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {field.primaryKey && (
                          <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                            PK
                          </span>
                        )}
                        {field.foreignKey && (
                          <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold rounded bg-amber-500/25 text-amber-300 border border-amber-500/40">
                            FK
                          </span>
                        )}
                        {field.unique && !field.primaryKey && (
                          <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold rounded bg-purple-500/25 text-purple-300 border border-purple-500/40">
                            UNIQUE
                          </span>
                        )}
                        {field.required ? (
                          <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            REQUIRED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[8px] font-mono font-medium rounded bg-slate-800 text-slate-400">
                            OPTIONAL
                          </span>
                        )}

                        <span className="text-xs font-mono font-semibold text-slate-100 truncate">
                          {field.name}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 shrink-0">
                        {field.type || "String"}
                      </span>
                    </div>

                    {/* Field Details & References */}
                    <div className="text-[11px] space-y-1 mt-2 pt-2 border-t border-white/[0.04]">
                      {field.references && (
                        <div className="flex items-center gap-1.5 text-amber-300 font-mono">
                          <span>↳ References:</span>
                          <button
                            type="button"
                            onClick={() => onSelectEntity && onSelectEntity(field.references.entity)}
                            className="font-bold underline hover:text-amber-200 cursor-pointer"
                          >
                            {field.references.entity}.{field.references.field}
                          </button>
                          <span className="text-slate-500">({field.references.type || "physical"})</span>
                        </div>
                      )}

                      {field.defaultValue !== null && field.defaultValue !== undefined && (
                        <div className="text-slate-400 font-mono">
                          Default: <span className="text-slate-300">{field.defaultValue}</span>
                        </div>
                      )}

                      {Array.isArray(field.enumValues) && field.enumValues.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap font-mono">
                          <span className="text-slate-400">Allowed Enum:</span>
                          {field.enumValues.map((val) => (
                            <span
                              key={val}
                              className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
                            >
                              "{val}"
                            </span>
                          ))}
                        </div>
                      )}

                      {field.description && (
                        <div className="text-slate-400 italic">
                          {field.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INDEXES */}
        {activeTab === "indexes" && (
          <div className="space-y-3">
            {indexes.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-6 text-center">
                No explicit secondary indexes registered
              </p>
            ) : (
              indexes.map((idxItem, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {idxItem.fieldList || JSON.stringify(idxItem.fields)}
                    </span>
                    {idxItem.unique && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40">
                        UNIQUE INDEX
                      </span>
                    )}
                  </div>

                  {idxItem.partialFilterExpression && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Partial Filter: {JSON.stringify(idxItem.partialFilterExpression)}
                    </div>
                  )}
                  {idxItem.name && (
                    <div className="text-[10px] font-mono text-slate-500">
                      Index Name: {idxItem.name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: RELATIONSHIPS */}
        {activeTab === "relationships" && (
          <div className="space-y-3">
            {entityRelationships.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-6 text-center">
                No direct relationships found for this entity
              </p>
            ) : (
              entityRelationships.map((rel, idx) => {
                const src = rel.sourceEntity || rel.source;
                const tgt = rel.targetEntity || rel.target;
                const isOutgoing = src?.toLowerCase() === entity.name.toLowerCase();

                return (
                  <div
                    key={rel.id || idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/30 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300 font-bold">{src}</span>
                        <span className="text-emerald-400 font-bold">→</span>
                        <span className="text-slate-300 font-bold">{tgt}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                        {rel.crowNotation || rel.type}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 leading-relaxed">
                      {rel.description || (isOutgoing ? `References ${tgt}` : `Referenced by ${src}`)}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-white/[0.04]">
                      <span>Field: {rel.sourceField || rel.foreignKey || "_id"}</span>
                      <button
                        type="button"
                        onClick={() => onSelectEntity && onSelectEntity(isOutgoing ? tgt : src)}
                        className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        Inspect {isOutgoing ? tgt : src} →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

