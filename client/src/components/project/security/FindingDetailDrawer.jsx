// client/src/components/project/security/FindingDetailDrawer.jsx
//
// Slide-over drawer displaying comprehensive finding details, why it's unsafe,
// evidence (with zero-leak masked credentials), remediation steps, and status actions.

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { updateSecurityFindingStatus } from "../../../services/projectService";

const SEVERITY_CONFIG = {
  Critical: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    pill: "bg-red-500 text-slate-950",
  },
  High: {
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    pill: "bg-orange-500 text-slate-950",
  },
  Medium: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pill: "bg-amber-500 text-slate-950",
  },
  Low: {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pill: "bg-blue-500 text-slate-950",
  },
};

export default function FindingDetailDrawer({
  finding,
  projectId,
  isOpen,
  onClose,
  onInspectSource,
  onStatusChange,
}) {
  const { getToken } = useAuth();
  const [currentStatus, setCurrentStatus] = useState(finding?.status || "open");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !finding) return null;

  const sevConfig = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.Medium;

  const handleUpdateStatus = async (newStatus) => {
    if (isUpdatingStatus || newStatus === currentStatus) return;
    try {
      setIsUpdatingStatus(true);
      setStatusError(null);
      const token = await getToken();
      if (!token) throw new Error("Authentication token unavailable.");

      // Optimistic update
      setCurrentStatus(newStatus);
      const updated = await updateSecurityFindingStatus(token, projectId, finding._id, newStatus);
      if (onStatusChange) {
        onStatusChange(finding._id, updated?.status || newStatus);
      }
    } catch (err) {
      console.error("[FindingDetailDrawer] Status update failed:", err);
      // Rollback
      setCurrentStatus(finding.status || "open");
      setStatusError(err.response?.data?.error || err.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isSecret = finding.source === "secret_scanner" || Boolean(finding.maskedValue);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} aria-label="Close drawer overlay" />

      {/* Drawer content panel */}
      <div className="w-full max-w-xl h-full bg-[#070c16] border-l border-white/[0.1] shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-white/[0.02]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${sevConfig.badge}`}
              >
                {finding.severity}
              </span>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] text-slate-300">
                {finding.source === "secret_scanner"
                  ? "Secret Scanner"
                  : finding.source === "ast_analyzer"
                  ? "AST Analyzer"
                  : "AI Code Review"}
              </span>

              {finding.confirmed ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                  Confirmed
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Potential
                </span>
              )}

              <span className="text-[11px] font-mono text-slate-500">
                Rule: {finding.ruleId || finding.category}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-100 leading-snug break-words">
              {finding.title || finding.category}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Close finding details (Esc)"
            aria-label="Close finding details"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 custom-scrollbar">
          {/* File location card */}
          <div className="rounded-xl border border-white/[0.08] bg-[#04070d] p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="uppercase text-[10px] text-slate-500 tracking-wider">Source Location</span>
              <span className="text-amber-400 font-semibold">
                Lines {finding.startLine || finding.lineNumber}
                {finding.endLine && finding.endLine !== (finding.startLine || finding.lineNumber)
                  ? `–${finding.endLine}`
                  : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <code className="text-xs font-mono text-cyan-300 break-all select-all">
                {finding.filePath}
              </code>
              {onInspectSource && (
                <button
                  type="button"
                  onClick={() => onInspectSource(finding.filePath, finding.startLine || finding.lineNumber, finding.endLine)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Inspect Code</span>
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Description
            </span>
            <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06]">
              {finding.description || "No detailed description provided by the scanner."}
            </p>
          </div>

          {/* Why it is potentially unsafe */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Why It Is Unsafe</span>
            </span>
            <div className="text-xs text-slate-300 leading-relaxed bg-amber-500/[0.03] p-3.5 rounded-xl border border-amber-500/20">
              {finding.whyUnsafe ||
                (isSecret
                  ? "Exposed credentials in source code can be extracted through repository access, build artifacts, or client bundles, granting attackers unauthorized access to sensitive infrastructure and APIs."
                  : "Unsanitized user inputs passed directly to evaluators, system commands, or dynamic file paths may enable remote code execution, SQL/NoSQL injection, or path traversal attacks.")}
            </div>
          </div>

          {/* Evidence section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Evidence
              </span>
              {isSecret && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  🛡️ Zero-Leak Redaction Active
                </span>
              )}
            </div>

            {isSecret ? (
              <div className="flex flex-col gap-2 bg-[#04070d] p-3.5 rounded-xl border border-amber-500/30">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Masked Credential:</span>
                  <span className="text-amber-400/80">Never exposed in raw form</span>
                </div>
                <code className="text-xs font-mono p-2.5 rounded bg-black/60 border border-white/[0.08] text-amber-300 font-bold tracking-widest break-all select-all">
                  {finding.maskedValue || finding.redactedEvidence || "••••••••••••••••"}
                </code>
              </div>
            ) : (
              <pre className="text-xs font-mono text-slate-300 bg-[#04070d] p-3.5 rounded-xl border border-white/[0.08] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {finding.redactedEvidence || finding.evidence || "No raw code evidence attached."}
              </pre>
            )}
          </div>

          {/* Remediation */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🛠️</span>
              <span>Recommended Remediation</span>
            </span>
            <div className="text-xs text-slate-300 leading-relaxed bg-emerald-500/[0.03] p-3.5 rounded-xl border border-emerald-500/20">
              {finding.recommendation ||
                (isSecret
                  ? "Immediately revoke the compromised credential, rotate the key in your provider's dashboard, and migrate the secret to environment variables (.env) or a secret manager (AWS Secrets Manager, HashiCorp Vault)."
                  : "Use parameterized queries, strictly validate and sanitize input against a whitelist, and avoid dynamic evaluation functions like eval(), child_process.exec(), or unsanitized path resolution.")}
            </div>
          </div>

          {/* External References */}
          {Array.isArray(finding.references) && finding.references.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                References & Standards
              </span>
              <ul className="flex flex-col gap-1.5 text-xs font-mono">
                {finding.references.map((ref, i) => (
                  <li key={i} className="flex items-center gap-2 text-cyan-400">
                    <span>↗</span>
                    <a
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline truncate"
                    >
                      {ref}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer / Status Management Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-white/[0.015] flex flex-col gap-2">
          {statusError && (
            <div className="text-xs text-red-400 font-mono px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              {statusError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono font-semibold uppercase ${
                  currentStatus === "resolved"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : currentStatus === "ignored"
                    ? "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {currentStatus}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentStatus !== "resolved" && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus("resolved")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Updating..." : "Mark Resolved"}
                </button>
              )}

              {currentStatus !== "ignored" && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus("ignored")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 border border-slate-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Updating..." : "Ignore"}
                </button>
              )}

              {currentStatus !== "open" && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus("open")}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Updating..." : "Reopen"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
