import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser, useAuth, UserButton } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import useUserSync from "../hooks/useUserSync.js";
import { importGithubProject, fetchRecentProjects, uploadZipRepository } from "../services/projectService.js";


// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring", stiffness: 400, damping: 28 };

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay },
  }),
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ children, className = "w-4 h-4", fill = "none", ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

const IconUpload = ({ className }) => (
  <Icon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Icon>
);

const IconGithub = ({ className }) => (
  <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.373-12-12-12z" />
  </svg>
);

const IconFileZip = ({ className }) => (
  <Icon className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="12" x2="12" y2="18" />
    <path d="M9 15h6" />
  </Icon>
);

const IconCheck = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

const IconX = ({ className }) => (
  <Icon className={className} strokeWidth="2.2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);

const IconBolt = ({ className }) => (
  <Icon className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Icon>
);

const IconLayers = ({ className }) => (
  <Icon className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Icon>
);

const IconFolder = ({ className }) => (
  <Icon className={className}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Icon>
);

const IconClock = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

const IconCpu = ({ className }) => (
  <Icon className={className}>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </Icon>
);

const IconArrow = ({ className }) => (
  <Icon className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </Icon>
);




// ─── Ambient Background ───────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animate-aurora-cyan absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full bg-cyan-500/[0.045] blur-[110px] gpu-layer" />
      <div className="animate-aurora-indigo absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full bg-indigo-500/[0.04] blur-[110px] gpu-layer" />
      <div className="animate-aurora-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-blue-500/[0.025] blur-[130px] gpu-layer" />
    </div>
  );
}

// ─── Dashboard Header ─────────────────────────────────────────────────────────

function DashboardHeader({ user }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex items-center justify-between px-5 md:px-8 py-3.5 border-b border-white/[0.06] archmind-glass sticky top-0 z-30"
    >
      {/* Branding */}
      <Link to="/" className="flex items-center gap-2.5 group" aria-label="ArchMind AI home">
        <div className="relative flex items-center justify-center w-8 h-8">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/25 to-blue-600/20 border border-cyan-500/25 group-hover:border-cyan-400/40 transition-colors duration-200" />
          <IconLayers className="w-4 h-4 text-cyan-400 relative z-10" />
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-bold text-white tracking-tight">
            Arch<span className="text-cyan-400">Mind</span>
          </span>
          <span className="text-[10px] font-semibold text-slate-500 tracking-widest ml-0.5">AI</span>
        </div>
      </Link>

      {/* Center: Breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600">
        <span className="text-slate-500">Dashboard</span>
        <span>/</span>
        <span className="text-slate-400">New Analysis</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-400">
            {user?.firstName || user?.username || "Engineer"}
          </span>
        </div>
        <div className="w-px h-5 bg-white/10 hidden sm:block" />
        <UserButton afterSignOutUrl="/" />
      </div>
    </motion.header>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

const STATS = [
  { icon: IconFolder, label: "Repos Analyzed", value: "12.4K+", color: "text-cyan-400", borderColor: "border-cyan-500/20" },
  { icon: IconClock, label: "Avg Analysis", value: "< 8s", color: "text-blue-400", borderColor: "border-blue-500/20" },
  { icon: IconCpu, label: "Stacks Detected", value: "340+", color: "text-indigo-400", borderColor: "border-indigo-500/20" },
];

function StatsStrip() {
  return (
    <motion.div
      variants={fadeUp}
      custom={0.45}
      initial="hidden"
      animate="visible"
      className="w-full max-w-lg grid grid-cols-3 gap-3 mt-4"
    >
      {STATS.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.5 + i * 0.06 }}
          className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border ${stat.borderColor} bg-white/[0.02] backdrop-blur-sm`}
        >
          <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
          <span className={`text-base font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
          <span className="text-[10px] text-slate-600 text-center leading-tight">{stat.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Method Tabs ──────────────────────────────────────────────────────────────

function MethodTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: "zip", label: "ZIP Upload", icon: IconFileZip, accentClass: "text-cyan-400", activeClass: "border-cyan-500/50 bg-cyan-500/8 text-cyan-300" },
    { id: "github", label: "GitHub URL", icon: IconGithub, accentClass: "text-blue-400", activeClass: "border-blue-500/50 bg-blue-500/8 text-blue-300" },
  ];

  return (
    <div className="flex gap-2 p-1 rounded-xl bg-[#060a13] border border-white/[0.06]">
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          type="button"
          id={`tab-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
          className={[
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg",
            "text-xs font-semibold border transition-all duration-200 cursor-pointer",
            activeTab === tab.id
              ? tab.activeClass
              : "border-transparent text-slate-500 hover:text-slate-400 hover:bg-white/[0.03]",
          ].join(" ")}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
        </motion.button>
      ))}
    </div>
  );
}

// ─── ZIP Upload Panel ─────────────────────────────────────────────────────────

function ZipUploadPanel({ file, onFileSelect, onFileClear, isDragging, onDragEnter, onDragLeave, onDrop }) {
  const inputRef = useRef(null);
  const shouldReduce = useReducedMotion();

  const handleInputChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) onFileSelect(selected);
    e.target.value = "";
  };

  return (
    <motion.div
      key="zip-panel"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      <motion.div
        id="zip-upload-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        animate={shouldReduce ? {} : isDragging ? { scale: 1.008 } : { scale: 1 }}
        transition={{ duration: 0.16 }}
        className={[
          "relative flex flex-col items-center justify-center gap-3",
          "w-full rounded-xl border-2 border-dashed px-6 py-9 cursor-pointer",
          "transition-all duration-200 select-none overflow-hidden",
          file
            ? "border-emerald-500/40 bg-emerald-500/[0.04]"
            : isDragging
            ? "border-cyan-400/60 bg-cyan-500/[0.07]"
            : "border-white/[0.08] bg-[#080c14] hover:border-cyan-500/30 hover:bg-[#090e1b]",
        ].join(" ")}
        role="button"
        tabIndex={0}
        aria-label="Drop ZIP file here or click to browse"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {/* Dot grid texture — purely decorative */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <input
          ref={inputRef}
          id="zip-file-input"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="sr-only"
          onChange={handleInputChange}
        />

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file-ok"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="relative z-10 flex flex-col items-center gap-3 w-full"
            >
              {/* Success icon */}
              <div className="relative flex items-center justify-center w-12 h-12">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 border border-emerald-500/25" />
                <IconCheck className="w-6 h-6 text-emerald-400 relative z-10" />
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-400">Ready to analyze</p>
                <p className="text-[11px] text-slate-500 mt-0.5">File loaded successfully</p>
              </div>

              {/* File pill */}
              <div className="flex items-center gap-2 w-full max-w-xs px-3 py-2 rounded-lg bg-[#060a10] border border-emerald-500/20">
                <IconFileZip className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-300 font-mono truncate flex-1">
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>

              <button
                id="zip-clear-button"
                type="button"
                onClick={(e) => { e.stopPropagation(); onFileClear(); }}
                className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-red-400 transition-colors"
              >
                <IconX className="w-3 h-3" />
                Remove file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="relative z-10 flex flex-col items-center gap-2.5"
            >
              <div className={[
                "flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-200",
                isDragging
                  ? "bg-cyan-500/15 border-cyan-400/50 scale-110"
                  : "bg-[#0a1020] border-white/10",
              ].join(" ")}>
                <IconUpload className={[
                  "w-6 h-6 transition-colors duration-200",
                  isDragging ? "text-cyan-300" : "text-slate-500",
                ].join(" ")} />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                  {isDragging ? "Release to upload" : "Drop your ZIP here"}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  or{" "}
                  <span className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2 cursor-pointer">
                    click to browse
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
                <span className="text-[10px] text-slate-600 font-mono">.zip</span>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-[10px] text-slate-600">up to 50 MB</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── GitHub URL Panel ─────────────────────────────────────────────────────────

function GithubUrlPanel({ url, onUrlChange }) {
  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = (val) => {
    // If the user pastes a full GitHub URL, strip protocol and domain
    // so it cleanly displays as 'owner/repo' alongside the 'github.com/' prefix badge
    const cleaned = val
      .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "")
      .replace(/^git@github\.com:/i, "")
      .replace(/\.git$/i, "");
    onUrlChange(cleaned);
  };

  return (
    <motion.div
      key="github-panel"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="flex flex-col gap-4"
    >
      {/* Input row */}
      <div className="relative group">
        <div
          className={[
            "flex items-stretch w-full rounded-xl border overflow-hidden",
            "transition-all duration-200",
            isFocused || url
              ? "border-blue-500/40 bg-[#090e1b]"
              : "border-white/[0.08] bg-[#080c14] hover:border-white/[0.12]",
          ].join(" ")}
        >
          {/* Prefix addon */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-r border-white/[0.08] bg-[#060a12] select-none">
            <IconGithub className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">github.com/</span>
          </div>

          {/* Text input */}
          <input
            id="github-url-input"
            type="text"
            value={url}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="username/repository"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 px-4 py-3 bg-transparent text-sm font-mono text-slate-200 outline-none placeholder:text-slate-700 transition-colors"
            aria-label="GitHub repository URL"
          />

          {/* Clear */}
          <AnimatePresence>
            {url && (
              <motion.button
                id="github-url-clear"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={() => onUrlChange("")}
                className="px-3 text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                aria-label="Clear URL"
              >
                <IconX className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Focus glow */}
        <div
          aria-hidden="true"
          className={[
            "absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300",
            isFocused ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ boxShadow: "0 0 0 1px rgba(59,130,246,0.28), 0 0 16px rgba(59,130,246,0.06)" }}
        />
      </div>

      {/* Quick example chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-slate-700 mr-1">Try:</span>
        {["facebook/react", "vercel/next.js", "tailwindlabs/tailwindcss"].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onUrlChange(example)}
            className="text-[10px] font-mono text-slate-600 hover:text-cyan-400 px-2 py-0.5 rounded-md border border-white/[0.06] hover:border-cyan-500/20 bg-white/[0.02] hover:bg-cyan-500/[0.04] transition-all duration-150 cursor-pointer"
          >
            {example}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-700 -mt-1">
        Public and private repositories are supported.
      </p>
    </motion.div>
  );
}

// ─── Analyze Button ───────────────────────────────────────────────────────────

function AnalyzeButton({ disabled, isLoading, statusText, activeTab, onClick }) {
  const label = isLoading
    ? statusText || "Importing Repository..."
    : disabled
    ? activeTab === "zip"
      ? "Add a ZIP file to continue"
      : "Enter a GitHub URL to continue"
    : "Analyze Project";

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        id="analyze-project-button"
        type="button"
        disabled={disabled || isLoading}
        onClick={onClick}
        whileHover={disabled || isLoading ? {} : { scale: 1.012, y: -1 }}
        whileTap={disabled || isLoading ? {} : { scale: 0.975 }}
        transition={SPRING}
        className={[
          "relative w-full flex items-center justify-center gap-2.5",
          "h-11 rounded-xl font-semibold text-sm tracking-wide overflow-hidden",
          "transition-all duration-300 select-none",
          disabled || isLoading
            ? "bg-[#0a0f1a] border border-white/[0.06] text-slate-500 cursor-not-allowed"
            : [
                "text-white cursor-pointer border border-transparent",
                "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500",
                "shadow-[0_0_20px_rgba(6,182,212,0.2)]",
                "hover:shadow-[0_0_30px_rgba(6,182,212,0.35)]",
              ].join(" "),
        ].join(" ")}
        aria-label={label}
        aria-disabled={disabled || isLoading}
      >
        {/* Shimmer on active state */}
        {!disabled && !isLoading && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-1/2 left-0 animate-shimmer pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.09) 50%, transparent 100%)",
            }}
          />
        )}

        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin shrink-0" />
            <span className="relative z-10 font-mono text-xs text-cyan-300">
              {statusText || "Scanning Repository..."}
            </span>
          </>
        ) : (
          <>
            <IconBolt className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Analyze Project</span>
            {!disabled && <IconArrow className="w-3.5 h-3.5 relative z-10 opacity-70" />}
          </>
        )}
      </motion.button>

      {disabled && !isLoading && (
        <p className="text-center text-[11px] text-slate-700">
          {activeTab === "zip"
            ? "Upload a .zip archive to get started"
            : "Paste a GitHub repository URL to get started"}
        </p>
      )}
    </div>
  );
}

// ─── Language Badge Helper ───────────────────────────────────────────────────

const LANGUAGE_COLORS = {
  JavaScript: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  TypeScript: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Python: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Go: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Rust: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Java: "bg-red-500/10 text-red-400 border-red-500/20",
  "C++": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Ruby: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  PHP: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Recent Projects ──────────────────────────────────────────────────────────

function RecentProjects({ projects = [], isLoading = false, onSelectProject }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={0.55}
      initial="hidden"
      animate="visible"
      className="w-full max-w-lg mt-8"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          Recent Projects
        </h2>
        <span className="text-[10px] text-slate-600 font-mono">
          {isLoading ? "loading..." : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        </span>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-white/[0.05] bg-[#060a12]/60 p-4 flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-mono">Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-white/[0.05] bg-[#060a12]/60 px-5 py-7 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <IconFolder className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">No projects analyzed yet</p>
          <p className="text-[11px] text-slate-600 max-w-[260px] leading-relaxed">
            Enter a GitHub repository URL above to generate architecture diagrams and security audits.
          </p>
        </div>
      ) : (
        /* Project list */
        <div className="flex flex-col gap-2">
          {projects.map((project) => {
            const primary = project.primaryLanguage || project.github?.language || "Unknown";
            const langClass =
              LANGUAGE_COLORS[primary] ||
              "bg-white/[0.04] text-slate-400 border-white/10";
            const confidencePct = Math.round((project.languageDetectionConfidence || 0) * 100);
            const secondaryLangs = project.secondaryLanguages || [];
            const frameworks = project.techStack?.frameworks || [];

            return (
              <motion.div
                key={project.id || project._id}
                onClick={() => {
                  const pid = project.id || project._id;
                  if (pid && onSelectProject) onSelectProject(pid);
                }}
                whileHover={{ y: -1, borderColor: "rgba(6,182,212,0.35)" }}
                transition={{ duration: 0.15 }}
                className="group relative flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-[#070c16]/80 hover:bg-[#09101f] transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] group-hover:border-cyan-500/30 group-hover:bg-cyan-500/[0.05] transition-colors shrink-0">
                    {project.source === "github" ? (
                      <IconGithub className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                    ) : (
                      <IconFileZip className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                    )}
                  </div>

                  {/* Title and metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                        {project.github?.fullName || project.name}
                      </span>
                      {project.github?.isPrivate && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/[0.05] text-slate-500 border border-white/10">
                          private
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {primary && primary !== "Unknown" && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${langClass}`}>
                          {primary}
                        </span>
                      )}

                      {secondaryLangs.map((sec) => (
                        <span
                          key={sec}
                          className="px-1.5 py-0.5 rounded text-[10px] font-normal border bg-white/[0.02] text-slate-400 border-white/[0.08]"
                        >
                          {sec}
                        </span>
                      ))}

                      {frameworks.map((fw) => (
                        <span
                          key={fw}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                        >
                          {fw}
                        </span>
                      ))}

                      {confidencePct > 0 && (
                        <span className="text-[9px] font-mono text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                          {confidencePct}% conf
                        </span>
                      )}

                      {project.stats?.totalFiles > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {project.stats.totalFiles} files
                        </span>
                      )}

                      <span className="text-[10px] text-slate-600">
                        {formatTimeAgo(project.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status pill / Action */}
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {project.status || "imported"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}


// ─── Corner Brackets ──────────────────────────────────────────────────────────

function CornerBrackets() {
  const corner = "absolute w-3 h-3 border-slate-700/60";
  return (
    <>
      <span className={`${corner} top-2 left-2 border-t border-l`} />
      <span className={`${corner} top-2 right-2 border-t border-r`} />
      <span className={`${corner} bottom-2 left-2 border-b border-l`} />
      <span className={`${corner} bottom-2 right-2 border-b border-r`} />
    </>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Sync Clerk profile to MongoDB on first load — fires once per session
  const { syncError } = useUserSync();
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);

  const [activeTab, setActiveTab] = useState("zip");
  const [zipFile, setZipFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Analysis submission state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState("");
  const [analyzeError, setAnalyzeError] = useState(null);
  const [analyzeSuccess, setAnalyzeSuccess] = useState(null);

  // Fetch recent projects from MongoDB
  const loadRecentProjects = useCallback(async () => {
    if (!isLoaded || !user) return;
    try {
      setIsLoadingProjects(true);
      const token = await getToken();
      if (token) {
        const data = await fetchRecentProjects(token);
        setProjects(data);
      }
    } catch (err) {
      console.error("[Dashboard] Failed to load recent projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [isLoaded, user, getToken]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!isLoaded || !user) return;
      try {
        setIsLoadingProjects(true);
        const token = await getToken();
        if (!token) return;
        const data = await fetchRecentProjects(token);
        if (!ignore) setProjects(data);
      } catch (err) {
        if (!ignore) console.error("[Dashboard] Failed to load recent projects:", err);
      } finally {
        if (!ignore) setIsLoadingProjects(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, [isLoaded, user, getToken]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;

    const isZip =
      dropped.type === "application/zip" ||
      dropped.type === "application/x-zip-compressed" ||
      dropped.name.toLowerCase().endsWith(".zip");

    if (isZip) {
      setZipFile(dropped);
      setActiveTab("zip");
      setAnalyzeError(null);
      setAnalyzeSuccess(null);
    }
  }, []);

  const clearZipFile = useCallback(() => {
    setZipFile(null);
    dragCounter.current = 0;
    setIsDragging(false);
    setAnalyzeError(null);
    setAnalyzeSuccess(null);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setAnalyzeError(null);
    setAnalyzeSuccess(null);
    // Clear the other input when switching
    if (tab === "zip") setGithubUrl("");
    if (tab === "github") clearZipFile();
  }, [clearZipFile]);

  const isAnalyzeEnabled =
    activeTab === "zip" ? Boolean(zipFile) : Boolean(githubUrl.trim());

  // Handle repository analysis submission
  const handleAnalyze = async () => {
    if (isAnalyzing || !isAnalyzeEnabled) return;

    setAnalyzeError(null);
    setAnalyzeSuccess(null);

    if (activeTab === "github") {
      const trimmedUrl = githubUrl.trim();
      if (!trimmedUrl) return;

      setIsAnalyzing(true);
      setAnalyzeStatus("Connecting to GitHub REST API...");

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication session expired. Please sign in again.");
        }

        setAnalyzeStatus("Scanning repository & filtering tree...");
        const result = await importGithubProject(token, trimmedUrl);

        setAnalyzeSuccess(
          `Repository '${result.github?.fullName || result.name}' imported successfully! Scanned ${result.stats?.totalFiles || 0} files.`
        );

        // Reload user's recent projects
        await loadRecentProjects();

        // Navigate to project workspace
        const targetId = result.id || result._id;
        if (targetId) {
          navigate(`/project/${targetId}`);
        }
      } catch (err) {
        console.error("[Dashboard] GitHub import failed:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to import GitHub repository. Please check the URL and try again.";
        setAnalyzeError(errorMsg);
      } finally {
        setIsAnalyzing(false);
        setAnalyzeStatus("");
      }
    } else if (activeTab === "zip") {
      if (!zipFile) return;

      setIsAnalyzing(true);
      setAnalyzeStatus("Uploading archive...");

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication session expired. Please sign in again.");
        }

        const result = await uploadZipRepository(
          token,
          zipFile,
          (pct) => {
            if (pct < 100) {
              setAnalyzeStatus(`Uploading... ${pct}%`);
            } else {
              setAnalyzeStatus("Extracting & scanning repository...");
            }
          }
        );

        setAnalyzeSuccess(
          `Repository '${result.name}' uploaded and scanned successfully! Found ${result.stats?.totalFiles || 0} files.`
        );
        setZipFile(null);

        // Reload user's recent projects
        await loadRecentProjects();

        // Navigate to project workspace
        const targetId = result.id || result._id;
        if (targetId) {
          navigate(`/project/${targetId}`);
        }
      } catch (err) {
        console.error("[Dashboard] ZIP upload failed:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to upload ZIP archive. Please try again.";
        setAnalyzeError(errorMsg);
      } finally {
        setIsAnalyzing(false);
        setAnalyzeStatus("");
      }
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#04060b] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/15" />
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin" />
          </div>
          <p className="text-xs font-mono text-slate-600 tracking-wider">
            Loading ArchMind Workspace...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060b] text-slate-100 relative">
      <AmbientBackground />
      <DashboardHeader user={user} />

      {/* Sync error banner — shown if MongoDB sync failed, dismissible */}
      <AnimatePresence>
        {syncError && !syncBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="relative z-20 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20"
          >
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[11px] text-amber-400">{syncError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSyncBannerDismissed(true)}
              className="text-amber-600 hover:text-amber-400 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex flex-col items-center px-4 py-10 md:py-14">

        {/* Hero heading */}
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="visible"
          className="text-center mb-8 max-w-lg"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] mb-4"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-cyan-400 tracking-widest uppercase">
              Repository Intelligence Engine
            </span>
          </motion.div>

          <h1 className="text-3xl md:text-[2.6rem] font-black text-white leading-tight tracking-tight mb-3">
            Analyze Your{" "}
            <span className="archmind-gradient-text">Codebase</span>
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            Submit a project as a <span className="text-slate-300 font-medium">.zip archive</span> or paste
            a <span className="text-slate-300 font-medium">GitHub URL</span> — get architecture diagrams,
            security audits, and DevOps manifests in seconds.
          </p>
        </motion.div>

        {/* Submission panel */}
        <motion.div
          variants={fadeUp}
          custom={0.08}
          initial="hidden"
          animate="visible"
          className="w-full max-w-lg"
        >
          <div
            className="relative rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(8,13,24,0.97) 0%, rgba(6,10,18,0.95) 100%)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Corner brackets (decorative) */}
            <CornerBrackets />

            {/* Top edge light */}
            <div
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)" }}
            />

            {/* Panel body */}
            <div className="p-5 md:p-7 flex flex-col gap-5">
              {/* Method tabs */}
              <MethodTabs activeTab={activeTab} onTabChange={handleTabChange} />

              {/* Active panel */}
              <AnimatePresence mode="wait">
                {activeTab === "zip" ? (
                  <ZipUploadPanel
                    key="zip"
                    file={zipFile}
                    onFileSelect={setZipFile}
                    onFileClear={clearZipFile}
                    isDragging={isDragging}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ) : (
                  <GithubUrlPanel
                    key="github"
                    url={githubUrl}
                    onUrlChange={(val) => {
                      setGithubUrl(val);
                      if (analyzeError) setAnalyzeError(null);
                      if (analyzeSuccess) setAnalyzeSuccess(null);
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Feedback banners */}
              <AnimatePresence>
                {analyzeError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-xs text-red-300"
                  >
                    <IconX className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-400">Import Failed</p>
                      <p className="text-[11px] text-red-300/80 mt-0.5 leading-relaxed">{analyzeError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnalyzeError(null)}
                      className="text-red-400/60 hover:text-red-300 transition-colors shrink-0"
                    >
                      <IconX className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}

                {analyzeSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-xs text-emerald-300"
                  >
                    <IconCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-400">Repository Ready</p>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5 leading-relaxed">{analyzeSuccess}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnalyzeSuccess(null)}
                      className="text-emerald-400/60 hover:text-emerald-300 transition-colors shrink-0"
                    >
                      <IconX className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="h-px bg-white/[0.04]" />

              {/* Analyze button */}
              <AnalyzeButton
                disabled={!isAnalyzeEnabled}
                isLoading={isAnalyzing}
                statusText={analyzeStatus}
                activeTab={activeTab}
                onClick={handleAnalyze}
              />
            </div>

            {/* Panel footer */}
            <div className="px-5 md:px-7 py-3 border-t border-white/[0.04] bg-black/20 flex items-center justify-between gap-4">
              <p className="text-[10px] text-slate-700 leading-relaxed">
                Code is processed securely and never stored permanently on our servers.
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-500 font-medium">Encrypted</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats strip */}
        <StatsStrip />

        {/* Recent projects */}
        <RecentProjects
          projects={projects}
          isLoading={isLoadingProjects}
          onSelectProject={(projectId) => navigate(`/project/${projectId}`)}
        />
      </main>
    </div>
  );
}

