import React, { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const cardData = [
  {
    id: "01",
    category: "VISUAL ARCHITECTURE",
    title: "Living Topology & ERDs",
    description:
      "Auto-generated schema maps that evolve with your code changes.",
    accent: "cyan",
    type: "topology",
  },
  {
    id: "02",
    category: "INFRASTRUCTURE",
    title: "DevOps-as-Code Synthesis",
    description:
      "Instant K8s manifests and Terraform modules from application logic.",
    accent: "blue",
    type: "devops",
  },
  {
    id: "03",
    category: "CODE INTELLIGENCE",
    title: "Repository-Aware RAG",
    description:
      "Contextual AI that understands your entire project structure.",
    accent: "emerald",
    type: "rag",
  },
  {
    id: "04",
    category: "SECURITY",
    title: "AST Security Audits",
    description:
      "Deep static analysis to catch vulnerabilities before they ship.",
    accent: "red",
    type: "security",
  },
  {
    id: "05",
    category: "DOCS SYNTHESIS",
    title: "Living API Documentation",
    description:
      "Real-time documentation that stays synchronized with your endpoints.",
    accent: "indigo",
    type: "api",
  },
  {
    id: "06",
    category: "PORTABILITY",
    title: "Architecture-as-Code",
    description:
      "Export your architecture into standard formats for any engineering tool.",
    accent: "amber",
    type: "export",
  },
];

const accentStyles = {
  cyan: {
    text: "text-cyan-400",
    border: "group-hover:border-cyan-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(6,182,212,0.18)]",
    line: "from-cyan-400 via-sky-400 to-transparent",
  },
  blue: {
    text: "text-blue-400",
    border: "group-hover:border-blue-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(59,130,246,0.18)]",
    line: "from-blue-400 via-indigo-400 to-transparent",
  },
  emerald: {
    text: "text-emerald-400",
    border: "group-hover:border-emerald-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(16,185,129,0.18)]",
    line: "from-emerald-400 via-teal-400 to-transparent",
  },
  red: {
    text: "text-red-400",
    border: "group-hover:border-red-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(239,68,68,0.18)]",
    line: "from-red-400 via-orange-400 to-transparent",
  },
  indigo: {
    text: "text-indigo-400",
    border: "group-hover:border-indigo-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(99,102,241,0.18)]",
    line: "from-indigo-400 via-purple-400 to-transparent",
  },
  amber: {
    text: "text-amber-400",
    border: "group-hover:border-amber-500/40",
    glow: "group-hover:shadow-[0_0_25px_rgba(245,158,11,0.18)]",
    line: "from-amber-400 via-yellow-400 to-transparent",
  },
};

/* ─── 01. Topology Widget with Flowing Packets ───────────────────────────── */
const TopologyWidget = memo(() => (
  <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-3.5 select-none">
    <div
      className="absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(56,189,248,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.3) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    />

    {/* SVG Connector Lines + Kinetic Glowing Data Packet */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <linearGradient id="widgetLine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <path
        id="topologyPath1"
        d="M 60 38 C 110 38, 110 80, 160 80"
        fill="none"
        stroke="url(#widgetLine)"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <path
        id="topologyPath2"
        d="M 160 80 C 210 80, 210 38, 260 38"
        fill="none"
        stroke="url(#widgetLine)"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />

      {/* SVG GPU Native Particle Tracker */}
      <circle r="2.5" fill="#38bdf8" className="shadow-[0_0_8px_#38bdf8]">
        <animateMotion
          dur="2.4s"
          repeatCount="indefinite"
          path="M 60 38 C 110 38, 110 80, 160 80"
        />
      </circle>
      <circle r="2" fill="#818cf8">
        <animateMotion
          dur="2.4s"
          begin="1.2s"
          repeatCount="indefinite"
          path="M 160 80 C 210 80, 210 38, 260 38"
        />
      </circle>
    </svg>

    {/* Floating Node Chips */}
    <div className="absolute left-3 top-6 px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-950/40 text-[9px] font-mono text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)] transition-transform duration-300 hover:scale-105">
      users
    </div>
    <div className="absolute left-1/2 top-16 -translate-x-1/2 px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-950/40 text-[9px] font-mono text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)] transition-transform duration-300 hover:scale-105">
      relations
    </div>
    <div className="absolute right-3 top-6 px-2.5 py-1 rounded-md border border-indigo-500/30 bg-indigo-950/40 text-[9px] font-mono text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.15)] transition-transform duration-300 hover:scale-105">
      orders
    </div>

    <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[8px] font-mono text-cyan-400/90">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
      12 RELATIONS MAPPED
    </div>
  </div>
));

/* ─── 02. DevOps Widget with Shimmer Scan ───────────────────────────────── */
const DevOpsWidget = memo(() => (
  <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-3 font-mono text-[9px] select-none">
    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5 text-slate-400">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
        <span>deployment.yaml</span>
      </div>
      <span className="text-emerald-400">VALID</span>
    </div>

    <div className="space-y-1 text-slate-300">
      <div>
        <span className="text-cyan-400">apiVersion:</span> apps/v1
      </div>
      <div>
        <span className="text-cyan-400">replicas:</span>{" "}
        <span className="text-emerald-400">3</span>
      </div>
      <div>
        <span className="text-cyan-400">strategy:</span>{" "}
        <span className="text-indigo-300">RollingUpdate</span>
      </div>
    </div>

    {/* Shimmer Light Bar Sweep */}
    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-blue-400/10 to-transparent transition-transform duration-1000 ease-in-out pointer-events-none" />

    <div className="absolute bottom-2 left-3 flex items-center gap-1 text-[8px] text-emerald-400">
      <span className="text-emerald-400">✓</span>
      <span>KUBECONFORM PASSED</span>
    </div>
  </div>
));

/* ─── 03. RAG Chat Widget with Context Beacon ───────────────────────────── */
const RAGWidget = memo(() => (
  <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-3 flex flex-col justify-between select-none">
    <div className="flex justify-end">
      <div className="rounded-lg rounded-tr-none bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[9px] text-slate-300">
        Where is auth handled?
      </div>
    </div>

    <div className="rounded-lg rounded-tl-none border border-cyan-500/20 bg-cyan-950/20 p-2 text-[9px] text-slate-300 space-y-1">
      <div>JWT auth via bearer interceptor.</div>
      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[8px] font-mono text-cyan-300 transition-colors hover:border-cyan-400">
        📄 src/auth/jwt.go:42
      </div>
    </div>

    <div className="flex items-center justify-between text-[8px] font-mono">
      <span className="text-slate-500">VECTOR RAG</span>
      <span className="text-emerald-400 flex items-center gap-1">
        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
        98.7% MATCH
      </span>
    </div>
  </div>
));

/* ─── 04. Security Widget with Smooth Bar Reveal ────────────────────────── */
const SecurityWidget = memo(() => (
  <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-3 flex flex-col justify-between select-none">
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-mono text-slate-400">
        SECURITY SCORE
      </span>
      <span className="text-base font-bold text-emerald-400">98/100</span>
    </div>

    {/* Progress Bar with Viewport Easing */}
    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: "98%" }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
      />
    </div>

    <div className="grid grid-cols-3 gap-1.5 text-center">
      <div className="rounded border border-white/5 bg-white/[0.02] p-1 transition-colors group-hover:border-emerald-500/20">
        <div className="text-xs font-bold text-emerald-400">0</div>
        <div className="text-[7px] text-slate-500">CRITICAL</div>
      </div>
      <div className="rounded border border-white/5 bg-white/[0.02] p-1 transition-colors group-hover:border-amber-500/20">
        <div className="text-xs font-bold text-amber-400">1</div>
        <div className="text-[7px] text-slate-500">HIGH</div>
      </div>
      <div className="rounded border border-white/5 bg-white/[0.02] p-1 transition-colors group-hover:border-slate-500/20">
        <div className="text-xs font-bold text-slate-300">4</div>
        <div className="text-[7px] text-slate-500">MEDIUM</div>
      </div>
    </div>

    <div className="text-[8px] font-mono text-emerald-400">
      ✓ AST SCAN COMPLETE
    </div>
  </div>
));

/* ─── 05. API Widget with Endpoint Status ────────────────────────────────── */
const APIWidget = memo(() => (
  <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-2.5 font-mono flex flex-col justify-between select-none">
    <div className="space-y-1.5">
      <div className="flex items-center justify-between py-1 border-b border-white/5 text-[9px] transition-colors group-hover:border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-bold">POST</span>
          <span className="text-slate-300">/api/v2/analyze</span>
        </div>
        <span className="text-emerald-400">200 OK</span>
      </div>
      <div className="flex items-center justify-between py-1 border-b border-white/5 text-[9px] transition-colors group-hover:border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-400 font-bold">GET</span>
          <span className="text-slate-300">/topology/ws</span>
        </div>
        <span className="text-blue-400">101 Switch</span>
      </div>
    </div>

    <div className="flex items-center justify-between text-[8px]">
      <span className="text-indigo-400">SYNCED WITH REPOSITORY</span>
      <span className="text-slate-500 font-mono">14ms</span>
    </div>
  </div>
));

/* ─── 06. Export Widget with Magnetic Tab Pill ──────────────────────────── */
const ExportWidget = () => {
  const [format, setFormat] = useState(".mermaid");

  const snippets = {
    ".mermaid": "graph TD; A[Gateway] --> B[Engine]; B --> C[(DB)]",
    ".c4dsl": 'workspace { model { arch = softwareSystem "ArchMind" } }',
    ".pdf": "[VECTOR EXPORT] Architecture diagram • 2.4MB",
  };

  return (
    <div className="relative h-36 overflow-hidden rounded-xl border border-white/[0.07] bg-[#040810] p-2.5 flex flex-col justify-between select-none">
      <div className="flex gap-1 relative z-10">
        {Object.keys(snippets).map((item) => {
          const isActive = format === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFormat(item)}
              className={`relative px-2 py-0.5 rounded text-[8px] font-mono transition-colors duration-150 ${
                isActive
                  ? "text-cyan-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="exportTabIndicator"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="absolute inset-0 bg-cyan-500/20 border border-cyan-500/40 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)] z-[-1]"
                />
              )}
              {item}
            </button>
          );
        })}
      </div>

      <div className="rounded border border-white/5 bg-black/30 p-2 text-[8px] font-mono text-slate-300 truncate">
        <span className="text-cyan-400">&gt;</span> {snippets[format]}
      </div>

      <div className="flex justify-end text-[8px] font-mono text-emerald-400">
        EXPORT READY
      </div>
    </div>
  );
};

const CardWidget = ({ type }) => {
  switch (type) {
    case "topology":
      return <TopologyWidget />;
    case "devops":
      return <DevOpsWidget />;
    case "rag":
      return <RAGWidget />;
    case "security":
      return <SecurityWidget />;
    case "api":
      return <APIWidget />;
    case "export":
      return <ExportWidget />;
    default:
      return null;
  }
};

/* ─── Main Section Component ────────────────────────────────────────────── */
export default function FeaturesSection() {
  return (
    <section
      id="services"
      className="relative z-10 py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none"
    >
      {/* Static Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/[0.05] blur-[100px] pointer-events-none -z-10" />

      {/* =====================================================
          SECTION HEADER
      ====================================================== */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#09111f]/90 border border-cyan-500/25 text-cyan-300 text-[10px] sm:text-[11px] font-mono tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.08)] backdrop-blur-md"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>CAPABILITIES // INTELLIGENCE</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight"
        >
          Everything you need to <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400">
            understand your codebase.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto"
        >
          ArchMind transforms raw source code into living architecture,
          infrastructure manifests, security audits, and real-time docs.
        </motion.p>
      </div>

      {/* =====================================================
          FEATURE BENTO GRID
      ====================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {cardData.map((card, index) => {
          const style = accentStyles[card.accent];

          return (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.04 }}
              className={`group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#070c16]/85 backdrop-blur-md p-5 shadow-[0_15px_30px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-1 will-change-transform ${style.border} ${style.glow} overflow-hidden`}
            >
              {/* Subtle Animated Top Border Shimmer */}
              <div
                className={`absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r ${style.line} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-3 text-[9px] font-mono">
                  <span className={`font-bold tracking-wider ${style.text}`}>
                    {card.category}
                  </span>
                  <span className="text-slate-600">[{card.id}]</span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-cyan-100 transition-colors">
                  {card.title}
                </h3>

                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* Widget Container */}
              <div className="mt-5">
                <CardWidget type={card.type} />
              </div>

              {/* Bottom Metadata */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[8px] font-mono text-slate-500">
                <span>ARCHMIND_CORE</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* =====================================================
          BOTTOM TELEMETRY STRIP
      ====================================================== */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[9px] font-mono text-slate-500">
        <span>ARCHMIND ENGINE</span>
        <span className="text-white/10">/</span>
        <span>
          AST DEPTH:{" "}
          <strong className="text-cyan-400 font-normal">8 LEVELS</strong>
        </span>
        <span className="text-white/10">/</span>
        <span>
          ANALYSIS:{" "}
          <strong className="text-emerald-400 font-normal">READY</strong>
        </span>
        <span className="text-white/10">/</span>
        <span>
          LATENCY: <strong className="text-blue-400 font-normal">14MS</strong>
        </span>
      </div>
    </section>
  );
}
