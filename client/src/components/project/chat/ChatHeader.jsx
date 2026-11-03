// client/src/components/project/chat/ChatHeader.jsx
//
// Header for Repository AI Chat Drawer with project context,
// history toggle, new chat action, and close control.

export default function ChatHeader({
  projectName = "Repository",
  conversationTitle,
  isHistoryOpen = false,
  conversationCount = 0,
  onToggleHistory,
  onNewChat,
  onClose,
}) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#060a12]/90 backdrop-blur-md shrink-0">
      {/* Left: Brand Icon + Title & Project Pill */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-xs font-bold text-slate-100 truncate">
              Repository AI Chat
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 truncate max-w-[120px]">
              {projectName}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 truncate max-w-[240px]">
            {conversationTitle || "New Conversation"}
          </span>
        </div>
      </div>

      {/* Right: Actions (History, New Chat, Close) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* History Toggle */}
        <button
          type="button"
          onClick={onToggleHistory}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
            isHistoryOpen
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]"
          }`}
          title="Toggle conversation history"
          aria-label="Toggle conversation history"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">History</span>
          {conversationCount > 0 && (
            <span className="ml-0.5 px-1 rounded-full text-[9px] font-mono bg-white/10 text-slate-300">
              {conversationCount}
            </span>
          )}
        </button>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors cursor-pointer"
          title="Start a new conversation"
          aria-label="Start new chat"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Close Drawer Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="Close chat drawer (Esc)"
          aria-label="Close chat drawer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

