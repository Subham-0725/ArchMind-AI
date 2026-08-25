import React, { useState, memo } from "react";
import { motion } from "framer-motion";

/* ─── Step 01: Ingestion & Extraction Widget ───────────────────────────── */
const IngestionWidget = memo(() => {
  const [activeMode, setActiveMode] = useState("github");

  return (
    <div className="space-y-3.5">
      {/* Mode Segmented Switcher */}
      <div className="flex rounded-lg border border-white/10 bg-[#050811] p-1 text-[11px] font-mono">
        <button
          type="button"
          onClick={() => setActiveMode("github")}
          className={`flex-1 py-1.5 rounded-md transition-all ${
            activeMode === "github"
              ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          GitHub URL
        </button>
        <button
          type="button"
          onClick={() => setActiveMode("zip")}
          className={`flex-1 py-1.5 rounded-md transition-all ${
            activeMode === "zip"
              ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          .zip Upload
        </button>
      </div>

      {/* Mock URL Input Bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#04060e] text-xs font-mono text-slate-300">
        <svg
          className="w-3.5 h-3.5 text-cyan-400 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="truncate text-slate-300">
          {activeMode === "github"
            ? "https://github.com/org/microservices"
            : "microservices-v2.4.zip (48.2MB)"}
        </span>
      </div>

      {/* Terminal Mini Window */}
      <div className="rounded-xl border border-white/10 bg-[#03050a] p-3.5 font-mono text-[10px] space-y-1.5 shadow-inner">
        <div className="flex items-center gap-1.5 mb-2 border-b border-white/5 pb-2">
          <span className="w-2 h-2 rounded-full bg-red-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
          <span className="text-[9px] text-slate-600 ml-auto">zsh</span>
        </div>

        <div className="text-cyan-400">$ git clone --depth 1 https://...</div>
        <div className="text-emerald-400">✓ Cloned repository (0.4s)</div>
        <div className="text-slate-400">● Detected: Next.js (frontend)</div>
        <div className="text-slate-400">● Detected: Express (api-gateway)</div>
        <div className="text-slate-400">● Detected: Prisma (schema)</div>
        <div className="text-cyan-300 font-bold pt-1">
          Ingestion Complete (1.2s)
        </div>
      </div>
    </div>
  );
});

/* ─── Step 02: AST & Gemini Context Engine Widget ──────────────────────── */
const ASTEngineWidget = memo(() => (
  <div className="flex flex-col justify-between h-full space-y-3">
    {/* Pipeline Node 1: Tree-sitter */}
    <div className="flex items-center justify-between p-2.5 rounded-xl border border-cyan-500/30 bg-[#050811] text-xs font-mono text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.12)]">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>Tree-sitter AST Parser</span>
      </div>
      <svg
        className="w-3.5 h-3.5 text-cyan-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 6h16M4 12h16m-7 6h7" />
      </svg>
    </div>

    {/* Vertical Connector 1 */}
    <div className="flex justify-center -my-1">
      <div className="w-px h-5 bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-500 relative">
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
      </div>
    </div>

    {/* Pipeline Node 2: Resolver */}
    <div className="flex items-center justify-between p-2.5 rounded-xl border border-blue-500/30 bg-[#050811] text-xs font-mono text-blue-200">
      <span>Dependency & Schema Resolver</span>
      <span className="px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/30 text-[9px] font-bold text-blue-400 uppercase">
        BLUE_RESOLVER
      </span>
    </div>

    {/* Vertical Connector 2 */}
    <div className="flex justify-center -my-1">
      <div className="w-px h-5 bg-gradient-to-b from-blue-500 via-indigo-500 to-cyan-400 relative">
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
      </div>
    </div>

    {/* Pipeline Node 3: Gemini Context Buffer */}
    <div className="flex items-center justify-between p-2.5 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-950/30 via-[#070b16] to-indigo-950/30 text-xs font-mono text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.18)]">
      <div className="flex items-center gap-2">
        <span className="text-cyan-400">🤖</span>
        <span className="font-semibold text-white">Gemini Context Buffer</span>
      </div>
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
    </div>

    {/* Dynamic Status Logs */}
    <div className="text-center text-[10px] font-mono text-slate-500 italic pt-1">
      Resolving cyclic dependencies...
    </div>

    {/* Bottom Telemetry Chip */}
    <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/30 text-[10px] font-mono text-cyan-300">
      <span>⚡</span>
      <span>124 Functions & 18 Schemas Indexed</span>
    </div>
  </div>
));

/* ─── Step 03: Artifact Launchpad Widget ────────────────────────────────── */
const ArtifactLauncherWidget = memo(() => {
  const artifacts = [
    {
      label: "Topology Graph",
      status: "RENDERED",
      color: "text-cyan-300 border-cyan-500/30 bg-cyan-950/40",
    },
    {
      label: "Security Audit",
      status: "98/100 PASSED",
      color: "text-emerald-300 border-emerald-500/30 bg-emerald-950/40",
    },
    {
      label: "Docker / K8s Configs",
      status: "READY",
      color: "text-blue-300 border-blue-500/30 bg-blue-950/40",
    },
    {
      label: "Contextual AI Chat",
      status: "ACTIVE",
      color: "text-purple-300 border-purple-500/30 bg-purple-950/40",
    },
  ];

  return (
    <div className="flex flex-col justify-between h-full space-y-3">
      {/* 4 Output Artifact Rows */}
      <div className="space-y-2">
        {artifacts.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/5 bg-[#04060e] text-xs font-mono text-slate-300 hover:border-white/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-500">❖</span>
              <span>{item.label}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${item.color} flex items-center gap-1`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Launch Workspace Primary Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        className="w-full relative group overflow-hidden rounded-xl p-[1px] shadow-[0_0_20px_rgba(6,182,212,0.3)] mt-2"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-xl" />
        <span className="relative flex items-center justify-center gap-2 w-full py-2.5 rounded-[11px] bg-gradient-to-r from-cyan-500 to-blue-600 group-hover:from-cyan-400 group-hover:to-blue-500 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all">
          <span>Launch Workspace</span>
          <span className="text-sm">➔</span>
        </span>
      </motion.button>
    </div>
  );
});

/* ─── Main Workflow Pipeline Section Component ─────────────────────────── */
export default function WorkflowSection() {
  const steps = [
    {
      step: "STEP 01",
      title: "Connect Repo or Drop Archive",
      description:
        "Upload a project ZIP archive or connect a GitHub repository via REST API with automated file tree mapping.",
      accent: "cyan",
      icon: (
        <svg
          className="w-4 h-4 text-cyan-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      ),
      widget: <IngestionWidget />,
    },
    {
      step: "STEP 02",
      title: "Technology Detection & Gemini Context Engine",
      description:
        "Our scanning engine parses package dependencies and AST call graphs, building a structured semantic context for Gemini AI.",
      accent: "blue",
      icon: (
        <svg
          className="w-4 h-4 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
        </svg>
      ),
      widget: <ASTEngineWidget />,
    },
    {
      step: "STEP 03",
      title: "Interactive Dashboard & DevOps Generation",
      description:
        "Instantly explore zoomable React Flow diagrams, query the repo-aware RAG chat, and export production Docker & K8s manifests.",
      accent: "emerald",
      icon: (
        <svg
          className="w-4 h-4 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
      widget: <ArtifactLauncherWidget />,
    },
  ];

  return (
    <section
      id="about"
      className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none"
    >
      {/* Subtle Central Lighting Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[500px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-transparent blur-[140px] pointer-events-none -z-10" />

      {/* =========================================================
          SECTION HEADER
      ========================================================== */}
      <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
        {/* Monospace Badge Tag */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#09111f]/90 border border-cyan-500/25 text-cyan-300 text-[10px] sm:text-[11px] font-mono tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.08)] backdrop-blur-md"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>[ PIPELINE & WORKFLOW // 03-STEP INGESTION ]</span>
        </motion.div>

        {/* Section Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight"
        >
          From Raw Repository to <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400">
            Living Architecture in 3 Steps.
          </span>
        </motion.h2>

        {/* Section Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-4 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto"
        >
          How ArchMind deterministically parses your codebase, analyzes system
          topology with Gemini AI, and renders production infrastructure on your
          dashboard.
        </motion.p>
      </div>

      {/* =========================================================
          WORKFLOW 3-CARD GRID WITH CONNECTOR BEAM
      ========================================================== */}
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Background Horizontal Pipeline Connection Beam (Desktop) */}
        <div className="hidden lg:block absolute top-1/2 left-10 right-10 h-[1.5px] bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-indigo-500/20 -translate-y-1/2 pointer-events-none -z-0" />

        {steps.map((item, idx) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: idx * 0.08 }}
            className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#070c18]/90 backdrop-blur-xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] will-change-transform z-10"
          >
            {/* Header & Meta */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan-500/20 bg-cyan-950/40 text-[10px] font-mono font-bold text-cyan-300">
                  {item.step}
                </span>
                <div className="p-1.5 rounded-lg border border-white/5 bg-white/[0.03]">
                  {item.icon}
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-200 transition-colors">
                {item.title}
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {item.description}
              </p>
            </div>

            {/* Step Micro-Widget Preview */}
            <div className="mt-auto pt-2">{item.widget}</div>
          </motion.div>
        ))}
      </div>

      {/* =========================================================
          BOTTOM TELEMETRY STATUS STRIP
      ========================================================== */}
      <div className="mt-14 flex flex-wrap items-center justify-between gap-y-3 text-[10px] font-mono text-slate-500 px-2 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <span>
            AVERAGE SCAN:{" "}
            <strong className="text-slate-300 font-normal">8.4s</strong>
          </span>
          <span>
            PARSER ENGINE:{" "}
            <strong className="text-cyan-400 font-normal">AST + GEMINI</strong>
          </span>
        </div>
        <div>
          <span>
            TARGET PLATFORM:{" "}
            <strong className="text-emerald-400 font-normal">
              KUBERNETES / DOCKER
            </strong>
          </span>
        </div>
      </div>
    </section>
  );
}
