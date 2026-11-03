// client/src/components/project/chat/ChatMessage.jsx
//
// Polished, highly readable developer-grade message renderer for Repository AI Chat.
// Supports clean typography, collapsible section accordions, responsive Markdown tables,
// code blocks with syntax styling & copy buttons, inline citation chips, and streaming cursors.

import { useState } from "react";
import ChatCitation from "./ChatCitation";

/**
 * Clickable inline citation chip that copies the citation on click.
 */
function InlineCitationChip({ text, keyPrefix }) {
  const [copied, setCopied] = useState(false);

  const cleanRef = text.replace(/^\[(Source:\s*)?/, "").replace(/\]$/, "").trim();

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cleanRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy inline citation:", err);
    }
  };

  return (
    <button
      key={keyPrefix}
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.2 rounded text-[11px] font-mono font-medium bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 hover:border-cyan-500/50 transition-colors cursor-pointer align-baseline"
      title={`Click to copy reference: ${cleanRef}`}
    >
      <span className="text-[10px] text-cyan-400">📄</span>
      <span>{copied ? "✓ Copied" : cleanRef}</span>
    </button>
  );
}

/**
 * Formats inline text with bold, inline code, and inline citation chips.
 */
function renderInlineFormatted(text, keyPrefix) {
  if (!text) return null;

  // Split by inline citations first: [Source: file:L1-L10] or [file.js:L1-L10]
  const citationRegex = /(\[(?:Source:\s*)?[a-zA-Z0-9_.\-/]+(?::L\d+(?:-L\d+)?)?\])/g;
  const citationParts = text.split(citationRegex);

  return citationParts.map((part, cIdx) => {
    const cKey = `${keyPrefix}-cite-${cIdx}`;
    if (citationRegex.test(part)) {
      return <InlineCitationChip key={cKey} text={part} keyPrefix={cKey} />;
    }

    // Split by inline code: `code`
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((subPart, sIdx) => {
      const sKey = `${cKey}-code-${sIdx}`;
      if (subPart.startsWith("`") && subPart.endsWith("`") && subPart.length >= 2) {
        return (
          <code
            key={sKey}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-cyan-950/50 text-cyan-300 font-mono text-[11px] border border-cyan-800/40"
          >
            {subPart.slice(1, -1)}
          </code>
        );
      }

      // Process bold: **bold**
      const boldParts = subPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        const bKey = `${sKey}-bold-${bIdx}`;
        if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length >= 4) {
          return (
            <strong key={bKey} className="font-semibold text-slate-100">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        return <span key={bKey}>{bPart}</span>;
      });
    });
  });
}

/**
 * Responsive Markdown Table component
 */
function MarkdownTable({ headers, rows, keyPrefix }) {
  if (!headers || headers.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-white/[0.08] bg-[#050811] overflow-hidden shadow-sm">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#080e1c] border-b border-white/[0.08] text-cyan-300 font-mono text-[11px] uppercase tracking-wider">
              {headers.map((h, i) => (
                <th key={`${keyPrefix}-th-${i}`} className="py-2 px-3 font-semibold whitespace-nowrap">
                  {renderInlineFormatted(h, `${keyPrefix}-th-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-slate-300">
            {rows.map((row, rIdx) => (
              <tr
                key={`${keyPrefix}-tr-${rIdx}`}
                className="hover:bg-white/[0.02] transition-colors odd:bg-transparent even:bg-white/[0.01]"
              >
                {row.map((cell, cIdx) => (
                  <td key={`${keyPrefix}-td-${rIdx}-${cIdx}`} className="py-2 px-3 leading-relaxed align-top">
                    {renderInlineFormatted(cell, `${keyPrefix}-td-${rIdx}-${cIdx}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Collapsible Section Card for H3 sections (### Section Name)
 */
function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-2.5 rounded-lg border border-white/[0.08] bg-[#060a14]/60 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] text-left transition-colors cursor-pointer select-none group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-cyan-400 transform transition-transform duration-200">
            {isOpen ? "▼" : "▶"}
          </span>
          <h4 className="text-xs font-semibold text-cyan-200 group-hover:text-cyan-100 transition-colors truncate">
            {title}
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">
          {isOpen ? "collapse" : "expand"}
        </span>
      </button>

      {isOpen && <div className="p-3.5 border-t border-white/[0.05] space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Code Block component with Copy button
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy code snippet:", err);
    }
  };

  return (
    <div className="my-2.5 rounded-lg border border-white/[0.08] bg-[#03060c] overflow-hidden text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-slate-400 text-[11px]">
        <span className="font-mono text-cyan-400/80">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="hover:text-slate-200 transition-colors cursor-pointer"
        >
          {copied ? <span className="text-emerald-400 font-medium">✓ Copied</span> : <span>Copy</span>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono text-[11px] no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Markdown Block Parser parsing Tables, Headings, Lists, Blockquotes, and Paragraphs
 */
function parseTextBlocks(text, keyPrefix) {
  const lines = text.split("\n");
  const nodes = [];

  let lineIdx = 0;
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      lineIdx++;
      continue;
    }

    // ── 1. Markdown Table Check ──────────────────────────────────────────────
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && lineIdx + 1 < lines.length) {
      const nextLine = lines[lineIdx + 1].trim();
      if (nextLine.startsWith("|") && /^[|\s\-:]+$/.test(nextLine)) {
        // Collect entire table
        const tableLines = [trimmed];
        lineIdx += 2; // skip header and delimiter

        while (lineIdx < lines.length && lines[lineIdx].trim().startsWith("|")) {
          tableLines.push(lines[lineIdx].trim());
          lineIdx++;
        }

        const parseRow = (str) =>
          str
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(1).map(parseRow);

        nodes.push(
          <MarkdownTable
            key={`${keyPrefix}-table-${lineIdx}`}
            headers={headers}
            rows={rows}
            keyPrefix={`${keyPrefix}-table-${lineIdx}`}
          />
        );
        continue;
      }
    }

    // ── 2. Headings ─────────────────────────────────────────────────────────
    if (trimmed.startsWith("### ")) {
      const title = trimmed.slice(4).trim();
      lineIdx++;

      // Collect section content until next ### or ## or end
      const sectionLines = [];
      while (lineIdx < lines.length && !lines[lineIdx].trim().startsWith("### ") && !lines[lineIdx].trim().startsWith("## ")) {
        sectionLines.push(lines[lineIdx]);
        lineIdx++;
      }

      const sectionBody = parseTextBlocks(sectionLines.join("\n"), `${keyPrefix}-sec-${title}`);
      nodes.push(
        <CollapsibleSection key={`${keyPrefix}-h3-${lineIdx}`} title={title} defaultOpen={true}>
          {sectionBody}
        </CollapsibleSection>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={`${keyPrefix}-h2-${lineIdx}`} className="text-sm font-bold text-slate-100 mt-4 mb-2 pb-1 border-b border-white/[0.06]">
          {renderInlineFormatted(trimmed.slice(3), `${keyPrefix}-h2-${lineIdx}`)}
        </h3>
      );
      lineIdx++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h2 key={`${keyPrefix}-h1-${lineIdx}`} className="text-base font-bold text-cyan-200 mt-4 mb-2">
          {renderInlineFormatted(trimmed.slice(2), `${keyPrefix}-h1-${lineIdx}`)}
        </h2>
      );
      lineIdx++;
      continue;
    }

    // ── 3. Blockquote ───────────────────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      nodes.push(
        <blockquote
          key={`${keyPrefix}-bq-${lineIdx}`}
          className="pl-3 py-1 my-2 border-l-2 border-cyan-500/50 bg-cyan-950/20 text-slate-300 italic text-xs rounded-r"
        >
          {renderInlineFormatted(trimmed.slice(2), `${keyPrefix}-bq-${lineIdx}`)}
        </blockquote>
      );
      lineIdx++;
      continue;
    }

    // ── 4. Lists ────────────────────────────────────────────────────────────
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems = [];
      while (lineIdx < lines.length && (lines[lineIdx].trim().startsWith("- ") || lines[lineIdx].trim().startsWith("* "))) {
        listItems.push(lines[lineIdx].trim().slice(2));
        lineIdx++;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-${lineIdx}`} className="list-disc pl-5 space-y-1 my-1.5 text-slate-300">
          {listItems.map((item, iIdx) => (
            <li key={`${keyPrefix}-li-${iIdx}`}>{renderInlineFormatted(item, `${keyPrefix}-li-${iIdx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // ── 5. Regular Paragraph ────────────────────────────────────────────────
    nodes.push(
      <p key={`${keyPrefix}-p-${lineIdx}`} className="text-slate-300 leading-relaxed">
        {renderInlineFormatted(trimmed, `${keyPrefix}-p-${lineIdx}`)}
      </p>
    );
    lineIdx++;
  }

  return nodes;
}

/**
 * Top-Level Formatted Content Component (handles fenced code blocks + text blocks)
 */
function FormattedContent({ content, isStreaming = false }) {
  if (!content) return null;

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements = [];
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      elements.push(
        <div key={`text-block-${blockIndex}`} className="space-y-2">
          {parseTextBlocks(textBefore, `tb-${blockIndex}`)}
        </div>
      );
    }

    const lang = match[1] || "";
    const code = match[2] || "";
    elements.push(<CodeBlock key={`code-block-${blockIndex}`} language={lang} code={code.trimEnd()} />);

    lastIndex = codeBlockRegex.lastIndex;
    blockIndex++;
  }

  const remainingText = content.slice(lastIndex);
  if (remainingText.trim()) {
    elements.push(
      <div key={`text-block-${blockIndex}`} className="space-y-2">
        {parseTextBlocks(remainingText, `tb-${blockIndex}`)}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {elements}
      {isStreaming && (
        <span className="inline-block w-2 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
      )}
    </div>
  );
}

export default function ChatMessage({ message, isStreaming = false, onRetry }) {
  if (!message) return null;

  const isUser = message.role === "user";
  const isFailed = Boolean(message.metadata?.failed);
  const citations = Array.isArray(message.citations) ? message.citations : [];
  const model = message.metadata?.model;

  return (
    <div
      className={`flex flex-col gap-2 p-3 sm:p-4 rounded-xl transition-all ${
        isUser
          ? "bg-cyan-500/[0.08] border border-cyan-500/20 ml-6 sm:ml-12 self-end"
          : "bg-[#060a12] border border-white/[0.08] mr-2 sm:mr-6 self-start w-full max-w-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          {isUser ? (
            <>
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                U
              </div>
              <span className="text-xs font-medium text-cyan-200">You</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                AM
              </div>
              <span className="text-xs font-semibold text-slate-200">ArchMind Intelligence</span>
              {model && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hidden sm:inline">
                  {model}
                </span>
              )}
              {isStreaming && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Streaming
                </span>
              )}
            </>
          )}
        </div>

        {message.createdAt && (
          <span className="text-[10px] font-mono text-slate-500">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="text-xs text-slate-200">
        <FormattedContent content={message.content} isStreaming={isStreaming} />
      </div>

      {/* Error state */}
      {isFailed && (
        <div className="flex items-center justify-between gap-2 p-2 mt-2 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
          <span>Failed to complete answer.</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-semibold text-red-200 cursor-pointer transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Verified Citations Section */}
      {citations.length > 0 && !isStreaming && (
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-400">
            <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>Verified Sources ({citations.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {citations.map((cite, cIdx) => (
              <ChatCitation key={`cite-${cite.filePath}-${cite.lineStart}-${cIdx}`} citation={cite} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
