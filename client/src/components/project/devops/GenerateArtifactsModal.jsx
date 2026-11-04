// client/src/components/project/devops/GenerateArtifactsModal.jsx
//
// Modal dialog allowing users to selectively generate DevOps deployment artifacts
// (Dockerfile, CI/CD, Kubernetes) with explicit preview disclaimers and loading state.

import { useState } from "react";

export default function GenerateArtifactsModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
  error = null,
}) {
  const [selectedTypes, setSelectedTypes] = useState({
    dockerfile: true,
    cicd: true,
    kubernetes: true,
  });

  const [includeIngress, setIncludeIngress] = useState(false);

  if (!isOpen) return null;

  const toggleType = (key) => {
    setSelectedTypes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = () => {
    setSelectedTypes({
      dockerfile: true,
      cicd: true,
      kubernetes: true,
    });
  };

  const handleClearAll = () => {
    setSelectedTypes({
      dockerfile: false,
      cicd: false,
      kubernetes: false,
    });
  };

  const selectedCount = Object.values(selectedTypes).filter(Boolean).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedCount === 0 || isGenerating) return;

    const artifactTypes = Object.entries(selectedTypes)
      .filter(([, selected]) => selected)
      .map(([key]) => key);

    onGenerate({
      artifactTypes,
      options: {
        includeKubernetesIngress: includeIngress,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={isGenerating ? undefined : onClose}
        aria-label="Close dialog backdrop"
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-[#070c16] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg">
              ⚙️
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Generate DevOps Artifacts
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Grounded in repository intelligence and source code
              </p>
            </div>
          </div>

          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs font-mono">
          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] leading-relaxed">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Description & Selection Helpers */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Select artifacts to generate:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={isGenerating}
                className="text-cyan-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                Select All
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isGenerating}
                className="text-slate-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Artifact Options List */}
          <div className="flex flex-col gap-2.5">
            {/* 1. Dockerfile */}
            <label
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer ${
                selectedTypes.dockerfile
                  ? "bg-cyan-500/[0.04] border-cyan-500/30"
                  : "bg-white/[0.015] border-white/[0.06] hover:border-white/10"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTypes.dockerfile}
                onChange={() => toggleType("dockerfile")}
                disabled={isGenerating}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>🐳</span> Dockerfile
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Dockerfile</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Multi-stage build tailored to package manager, entry points, and non-root runtime users.
                </p>
              </div>
            </label>

            {/* 2. CI/CD Pipeline */}
            <label
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer ${
                selectedTypes.cicd
                  ? "bg-cyan-500/[0.04] border-cyan-500/30"
                  : "bg-white/[0.015] border-white/[0.06] hover:border-white/10"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTypes.cicd}
                onChange={() => toggleType("cicd")}
                disabled={isGenerating}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>🚀</span> GitHub Actions CI/CD
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">.github/workflows/ci.yml</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Dependency caching, least-privilege permissions, and test/build steps matching package.json scripts.
                </p>
              </div>
            </label>

            {/* 3. Kubernetes Manifests */}
            <label
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer ${
                selectedTypes.kubernetes
                  ? "bg-cyan-500/[0.04] border-cyan-500/30"
                  : "bg-white/[0.015] border-white/[0.06] hover:border-white/10"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTypes.kubernetes}
                onChange={() => toggleType("kubernetes")}
                disabled={isGenerating}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>☸️</span> Kubernetes Manifests
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">k8s/deployment.yaml</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Deployment, Service, and ConfigMap with pod selector alignment and probe auto-wiring.
                </p>

                {selectedTypes.kubernetes && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeIngress"
                      checked={includeIngress}
                      onChange={(e) => setIncludeIngress(e.target.checked)}
                      disabled={isGenerating}
                      className="w-3.5 h-3.5 rounded border-white/20 text-cyan-500 cursor-pointer"
                    />
                    <label htmlFor="includeIngress" className="text-[11px] text-slate-300 cursor-pointer">
                      Include Ingress resource definition (NGINX ingress class)
                    </label>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400 flex items-center gap-2">
            <span>ℹ️</span>
            <span>
              Generated files are previews. ArchMind AI does not commit or overwrite files in your repository.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="mt-2 pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || selectedCount === 0}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-40 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
                  <span>Generating Artifacts...</span>
                </>
              ) : (
                <>
                  <span>Generate ({selectedCount})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

