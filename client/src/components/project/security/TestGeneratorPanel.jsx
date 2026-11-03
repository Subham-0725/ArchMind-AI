// client/src/components/project/security/TestGeneratorPanel.jsx
//
// AI-assisted Unit Test Generator powered by Groq.
// Generates runnable test suites tailored to detected project test frameworks (Jest, Vitest, Pytest).
// Strict safety guarantee: Displays code for preview only; never executes tests or overwrites files.

import { useState, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { triggerTestGeneration } from "../../../services/projectService";

export default function TestGeneratorPanel({
  projectId,
  tree = [],
}) {
  const { getToken } = useAuth();

  // Extract eligible source code files for testing (JS, TS, Python)
  const testableFiles = useMemo(() => {
    const list = [];
    const traverse = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.type === "file" && node.path) {
          const p = node.path;
          const isCode =
            (p.endsWith(".js") ||
              p.endsWith(".jsx") ||
              p.endsWith(".ts") ||
              p.endsWith(".tsx") ||
              p.endsWith(".py")) &&
            !p.includes(".test.") &&
            !p.includes(".spec.") &&
            !p.includes("__tests__/") &&
            !p.includes("node_modules/") &&
            !p.includes(".git/");

          if (isCode) list.push(p);
        }
        if (node.children) traverse(node.children);
      }
    };
    traverse(tree);
    return list.sort();
  }, [tree]);

  const [selectedFile, setSelectedFile] = useState(testableFiles[0] || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateTests = async (e) => {
    e?.preventDefault();
    if (!selectedFile || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      const result = await triggerTestGeneration(token, projectId, selectedFile);
      setTestResult(result);
    } catch (err) {
      console.error("[TestGeneratorPanel] Test generation failed:", err);
      setError(err.response?.data?.error || err.message || "Failed to generate unit tests.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!testResult?.testCode) return;
    navigator.clipboard.writeText(testResult.testCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-slate-200">
      {/* ── Selection Form ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleGenerateTests}
        className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>🧪</span>
              <span>Unit Test Generation Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically detect project test framework, analyze module exports, and generate comprehensive unit tests.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !selectedFile}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-cyan-500/10"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Generating Tests...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Generate Unit Tests</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-3 border-t border-white/[0.06]">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
            Target Module ({testableFiles.length} testable files available)
          </label>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-cyan-300 outline-none focus:border-cyan-500/40 cursor-pointer disabled:opacity-50"
          >
            {testableFiles.length === 0 ? (
              <option value="">No supported code files found</option>
            ) : (
              testableFiles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))
            )}
          </select>
        </div>
      </form>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/[0.05] flex items-center justify-between gap-3 text-xs font-mono text-red-300">
          <div className="flex items-center gap-2">
            <span className="text-base">✕</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleGenerateTests}
            disabled={isLoading}
            className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Test Output Viewport ───────────────────────────────────────────── */}
      {testResult && (
        <div className="flex flex-col gap-4">
          {/* Metadata Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Framework Detection */}
            <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Detected Framework
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {testResult.framework || "Jest"}
                </span>
                {testResult.frameworkConfidence && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {testResult.frameworkConfidence}% Confidence
                  </span>
                )}
              </div>
              {testResult.frameworkReason && (
                <span className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                  {testResult.frameworkReason}
                </span>
              )}
            </div>

            {/* Target & Suggested Destination */}
            <div className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Suggested Test File Location
                </span>
                <code className="text-xs font-mono text-emerald-300 block mt-1 break-all">
                  {testResult.suggestedFilePath || `${testResult.targetFilePath}.test.js`}
                </code>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-2">
                Target: <span className="text-slate-300">{testResult.targetFilePath}</span>
              </div>
            </div>
          </div>

          {/* Prominent Non-Execution Disclaimer */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 flex items-start gap-3">
            <div className="text-amber-400 text-lg shrink-0 mt-0.5">⚠️</div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold font-mono text-amber-300 uppercase tracking-wider">
                Preview Only — Test Execution Safety Guarantee
              </span>
              <p className="text-slate-300 leading-relaxed">
                {testResult.disclaimer ||
                  "This test suite is a generated preview and was NOT automatically executed. ArchMind AI does not run test code in sandbox environments and does not overwrite or create workspace files. Review the code and copy it to your repository test directory to run."}
              </p>
            </div>
          </div>

          {/* Test Scenarios Checklist */}
          {Array.isArray(testResult.testCases) && testResult.testCases.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 flex flex-col gap-3">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Generated Test Scenarios ({testResult.testCases.length} Cases)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {testResult.testCases.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-white/[0.06] bg-[#04070d] flex items-start gap-2.5"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider font-bold shrink-0 mt-0.5 ${
                        tc.type === "error"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : tc.type === "edge"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {tc.type || "unit"}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-200">
                        {tc.name}
                      </span>
                      {tc.description && (
                        <span className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {tc.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Code Preview Box */}
          <div className="rounded-xl border border-white/[0.08] bg-[#04070d] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-200">
                  Runnable Test Suite Code
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  ({testResult.framework || "Jest"})
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{copied ? "✓ Copied Code" : "Copy Test Code"}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed custom-scrollbar max-h-[500px]">
              {testResult.testCode || "// No test code generated."}
            </pre>
          </div>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────────────── */}
      {!testResult && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-xl border border-white/[0.04] bg-white/[0.01]">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-2xl mb-4 shadow-lg shadow-cyan-500/5">
            🧪
          </div>
          <h4 className="text-base font-bold text-slate-200">
            Generate Unit Tests On-Demand
          </h4>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
            Select a target code file and click &quot;Generate Unit Tests&quot;. ArchMind analyzes exported functions, detects your project&apos;s testing library, and generates unit test cases.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span>Non-executing preview</span>
            <span>•</span>
            <span>Zero file overwrites</span>
            <span>•</span>
            <span>Edge and Error scenarios</span>
          </div>
        </div>
      )}
    </div>
  );
}

