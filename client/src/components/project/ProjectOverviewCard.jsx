// client/src/components/project/ProjectOverviewCard.jsx


const LANGUAGE_COLORS = {
  JavaScript: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  TypeScript: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Python: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Go: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Rust: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Java: "bg-red-500/10 text-red-400 border-red-500/20",
  Kotlin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "C++": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Ruby: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  PHP: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export default function ProjectOverviewCard({ project }) {
  const overview = project?.overview || {};
  const languages = project?.languages || {};
  const stats = project?.stats || {};

  const totalFiles = overview.totalFiles ?? stats.totalFiles ?? 0;
  const totalDirs = overview.totalDirectories ?? stats.totalDirs ?? 0;
  const totalSize = overview.totalSize ?? stats.totalBytes ?? 0;

  const primary = languages.primary || project?.primaryLanguage || "Unknown";
  const secondary = languages.secondary || project?.secondaryLanguages || [];
  const confidence = Math.round((languages.confidence ?? project?.languageDetectionConfidence ?? 0) * 100);

  const topExtensions = overview.topExtensions || stats.topExtensions || [];

  const langClass = LANGUAGE_COLORS[primary] || "bg-white/[0.04] text-slate-400 border-white/10";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 backdrop-blur-md flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Project Overview
        </h3>
        {confidence > 0 && (
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            {confidence}% Detection Confidence
          </span>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col p-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02]">
          <span className="text-[10px] text-slate-500 font-medium">Files</span>
          <span className="text-sm font-bold text-slate-200 font-mono mt-0.5">
            {totalFiles.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col p-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02]">
          <span className="text-[10px] text-slate-500 font-medium">Directories</span>
          <span className="text-sm font-bold text-slate-200 font-mono mt-0.5">
            {totalDirs.toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col p-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02]">
          <span className="text-[10px] text-slate-500 font-medium">Size</span>
          <span className="text-sm font-bold text-slate-200 font-mono mt-0.5">
            {formatBytes(totalSize)}
          </span>
        </div>
      </div>

      {/* Language Breakdown */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06]">
        <span className="text-[11px] font-medium text-slate-400">Detected Languages</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {primary && primary !== "Unknown" && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${langClass}`}>
              ★ {primary} (Primary)
            </span>
          )}

          {secondary.map((lang) => (
            <span
              key={lang}
              className="px-2 py-0.5 rounded text-xs font-normal border bg-white/[0.03] text-slate-300 border-white/[0.08]"
            >
              {lang}
            </span>
          ))}

          {primary === "Unknown" && secondary.length === 0 && (
            <span className="text-xs text-slate-600 font-mono">No code files detected</span>
          )}
        </div>
      </div>

      {/* Top File Extensions */}
      {topExtensions.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06]">
          <span className="text-[11px] font-medium text-slate-400">Top File Extensions</span>
          <div className="flex flex-wrap gap-1.5">
            {topExtensions.map((extItem) => (
              <span
                key={extItem.extension}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.02] border border-white/[0.06] text-slate-400"
              >
                <span className="text-slate-300">{extItem.extension}</span>
                <span className="text-slate-600">({extItem.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
