// client/src/components/project/devops/DevOpsArtifactViewer.jsx
//
// Syntax-highlighted preview viewer for generated DevOps artifacts
// (Dockerfile, GitHub Actions CI/CD YAML, Kubernetes manifests).
// Read-only, preserving line numbers, copy action, and non-destructive preview banners.

import { useState } from "react";

/**
 * Highlights a single line of a Dockerfile.
 */
function renderDockerfileLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return <span>&nbsp;</span>;
  if (trimmed.startsWith("#")) {
    return <span className="text-slate-500 italic">{line}</span>;
  }

  // Tokenize Docker instruction keyword
  const match = line.match(/^(\s*)([A-Za-z]+)(\s+.*)?$/);
  if (!match) return <span>{line}</span>;

  const [, indent, keyword, rest] = match;
  const upperKey = keyword.toUpperCase();
  const DOCKER_KEYWORDS = new Set([
    "FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY",
    "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD",
    "STOPSIGNAL", "HEALTHCHECK", "SHELL",
  ]);

  if (DOCKER_KEYWORDS.has(upperKey)) {
    return (
      <span>
        {indent}
        <span className="text-cyan-400 font-bold">{upperKey}</span>
        {rest && highlightDockerRest(rest)}
      </span>
    );
  }

  return <span>{line}</span>;
}

function highlightDockerRest(rest) {
  // Highlight flags like --from=builder or --chown=node:node
  return rest.split(/(\s+)/).map((segment, idx) => {
    if (segment.startsWith("--")) {
      return (
        <span key={idx} className="text-amber-400">
          {segment}
        </span>
      );
    }
    if (segment.startsWith("$") || segment.includes("${")) {
      return (
        <span key={idx} className="text-violet-400 font-semibold">
          {segment}
        </span>
      );
    }
    return <span key={idx}>{segment}</span>;
  });
}

/**
 * Highlights a single line of YAML (GitHub Actions & Kubernetes).
 */
function renderYamlLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return <span>&nbsp;</span>;
  if (trimmed.startsWith("#")) {
    return <span className="text-slate-500 italic">{line}</span>;
  }
  if (trimmed === "---") {
    return <span className="text-cyan-400 font-bold">---</span>;
  }

  // Check for key: value
  const colonIndex = line.indexOf(":");
  if (colonIndex !== -1 && !line.includes("${{")) {
    const keyPart = line.slice(0, colonIndex);
    const valuePart = line.slice(colonIndex + 1);

    return (
      <span>
        <span className="text-sky-300 font-semibold">{keyPart}</span>
        <span className="text-slate-400">:</span>
        {highlightYamlValue(valuePart)}
      </span>
    );
  }

  // Expression or list item
  if (trimmed.startsWith("-")) {
    const dashIdx = line.indexOf("-");
    const prefix = line.slice(0, dashIdx + 1);
    const after = line.slice(dashIdx + 1);
    return (
      <span>
        <span className="text-slate-400 font-bold">{prefix}</span>
        {highlightYamlValue(after)}
      </span>
    );
  }

  return highlightYamlValue(line);
}

function highlightYamlValue(val) {
  if (!val) return null;
  const trimmed = val.trim();

  // GitHub Actions Expression: ${{ secrets.* }}
  if (trimmed.includes("${{")) {
    return <span className="text-violet-400 font-semibold">{val}</span>;
  }

  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return <span className="text-emerald-300">{val}</span>;
  }

  // Numbers or booleans
  if (trimmed === "true" || trimmed === "false" || /^\d+$/.test(trimmed)) {
    return <span className="text-amber-300 font-semibold">{val}</span>;
  }

  return <span className="text-slate-200">{val}</span>;
}

export default function DevOpsArtifactViewer({
  artifact,
  isLoading = false,
  onGenerateClick,
  activeType = "dockerfile",
}) {
  const [copied, setCopied] = useState(false);

  const lines = artifact?.content ? artifact.content.split(/\r?\n/) : [];

  const handleCopy = () => {
    if (!artifact?.content) return;
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="h-[520px] rounded-xl border border-white/[0.08] bg-[#04070d] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-3" />
        <p className="text-xs font-mono text-cyan-300">Loading artifact content...</p>
        <p className="text-[11px] text-slate-500 font-mono mt-1">Retrieving verified file from repository storage</p>
      </div>
    );
  }

  // 2. Empty State (No artifact generated yet)
  if (!artifact) {
    const titles = {
      dockerfile: "Dockerfile Not Generated",
      cicd: "CI/CD Pipeline Not Generated",
      kubernetes: "Kubernetes Manifests Not Generated",
    };
    const descriptions = {
      dockerfile: "Generate an optimized multi-stage Dockerfile tailored to your repository runtime and package manager.",
      cicd: "Generate an automated GitHub Actions CI/CD workflow grounded in repository build, lint, and test scripts.",
      kubernetes: "Generate production Deployment, Service, and ConfigMap manifests aligned with application ports and health endpoints.",
    };

    return (
      <div className="h-[520px] rounded-xl border border-white/[0.08] bg-[#070c16]/70 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400 text-xl mb-4">
          {activeType === "dockerfile" ? "🐳" : activeType === "cicd" ? "🚀" : "☸️"}
        </div>
        <h3 className="text-sm font-bold text-slate-200">{titles[activeType] || "No Artifact Generated"}</h3>
        <p className="text-xs text-slate-400 max-w-md mt-1.5 mb-6 leading-relaxed">
          {descriptions[activeType] || "Click below to generate this deployment artifact."}
        </p>
        {onGenerateClick && (
          <button
            type="button"
            onClick={onGenerateClick}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
          >
            <span>+</span> Generate {activeType === "dockerfile" ? "Dockerfile" : activeType === "cicd" ? "CI/CD Pipeline" : "Kubernetes Manifests"}
          </button>
        )}
      </div>
    );
  }

  const isYaml = artifact.artifactType === "cicd" || artifact.artifactType === "kubernetes";

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-[#070c16] overflow-hidden shadow-xl">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-100 truncate">
            {artifact.filePath || "Artifact"}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] border border-white/[0.1] text-slate-400">
            v{artifact.version || 1}
          </span>
          {artifact.metadata?.runtime && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              {artifact.metadata.runtime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Copy artifact content to clipboard"
          >
            {copied ? (
              <>
                <span className="text-emerald-400">✓</span>
                <span className="text-emerald-400 font-bold">Copied</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy Content</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Safety Notice Banner */}
      <div className="px-4 py-2 bg-amber-500/[0.06] border-b border-amber-500/20 flex items-center justify-between text-[11px] font-mono text-amber-300/90">
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span>Preview only — ArchMind AI does not automatically commit or overwrite files in your workspace.</span>
        </div>
        <span className="hidden md:inline text-[10px] text-amber-400/60">Suggested path: {artifact.filePath}</span>
      </div>

      {/* Code Content with Line Numbers */}
      <div className="h-[460px] overflow-auto bg-[#04070d] p-4 font-mono text-xs text-slate-200 select-text custom-scrollbar">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => {
              const lineNo = index + 1;
              return (
                <tr key={lineNo} className="hover:bg-white/[0.02] transition-colors leading-relaxed">
                  <td className="w-12 pr-4 text-right select-none text-slate-600 border-r border-white/[0.06] align-top text-[11px]">
                    {lineNo}
                  </td>
                  <td className="pl-4 whitespace-pre font-mono text-xs align-top">
                    {isYaml ? renderYamlLine(line) : renderDockerfileLine(line)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
