// client/src/components/project/chat/ChatComposer.jsx
//
// Chat composer input area supporting multiline input (Shift+Enter for newline,
// Enter to submit), auto-resizing, validation, and accessibility.

import { useState, useRef, useEffect } from "react";

export default function ChatComposer({
  onSendMessage,
  isSending = false,
  placeholder = "Ask a question about this repository...",
  initialDraft = "",
}) {
  const [text, setText] = useState(initialDraft);
  const [prevInitialDraft, setPrevInitialDraft] = useState(initialDraft);
  const textareaRef = useRef(null);

  // Sync initial draft if external retry sets it (React recommended pattern for state from props)
  if (initialDraft !== prevInitialDraft) {
    setPrevInitialDraft(initialDraft);
    setText(initialDraft);
  }

  // Auto-resize textarea height up to 140px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 140);
    el.style.height = `${Math.max(newHeight, 38)}px`;
  }, [text]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    onSendMessage(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "38px";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isValid = Boolean(text.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 border-t border-white/[0.08] bg-[#050811]/95 backdrop-blur-md"
    >
      <div className="relative flex items-end gap-2 rounded-xl border border-white/[0.1] bg-[#070c18] p-1.5 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
        {/* Multiline Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 resize-none outline-none py-1.5 px-2.5 max-h-[140px] leading-relaxed disabled:opacity-50 no-scrollbar"
          aria-label="Repository question input"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!isValid || isSending}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0 shadow-md shadow-cyan-500/20"
          aria-label="Send message"
          title={isValid ? "Send question (Enter)" : "Enter a question to send"}
        >
          {isSending ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
          ) : (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-500 font-mono">
        <span>Enter to send • Shift + Enter for newline</span>
        {text.length > 500 && (
          <span className={text.length > 3500 ? "text-amber-400" : "text-slate-400"}>
            {text.length}/4000
          </span>
        )}
      </div>
    </form>
  );
}
