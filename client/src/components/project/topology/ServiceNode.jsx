// client/src/components/project/topology/ServiceNode.jsx
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

const TIER_STYLES = {
  Frontend: {
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)] border-cyan-500/40 bg-[#091526]/90",
    icon: "❖",
  },
  Backend: {
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)] border-indigo-500/40 bg-[#10102b]/90",
    icon: "⚡",
  },
  Database: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/40 bg-[#081a17]/90",
    icon: "⬡",
  },
  DevOps: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-500/40 bg-[#1c1407]/90",
    icon: "⚙",
  },
};

const ServiceNode = ({ data, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const tier = data.tier || "Backend";
  const style = TIER_STYLES[tier] || TIER_STYLES.Backend;

  return (
    <div className={`relative px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-200 min-w-[220px] ${style.glow}`}>
      <Handle
        type="target"
        position={targetPosition}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-[#060a12]"
      />

      <div className="flex items-center justify-between mb-1">
        <span className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border ${style.badge}`}>
          {style.icon} {tier}
        </span>
      </div>

      <div className="text-sm font-semibold text-slate-100 truncate">
        {data.label || "Service Node"}
      </div>

      {data.technology && (
        <div className="text-xs font-mono text-slate-400 mt-1 truncate">
          {data.technology}
        </div>
      )}

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-2 !border-[#060a12]"
      />
    </div>
  );
};

export default memo(ServiceNode);
