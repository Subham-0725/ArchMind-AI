// client/src/components/project/chat/ChatEmptyState.jsx
//
// Initial welcome state for Repository AI Chat.
// Guides the user on repository capabilities and offers quick starter questions.

export default function ChatEmptyState({ projectName, onSelectPrompt }) {
  const suggestedPrompts = [
    {
      label: "Architecture & Flow",
      prompt: "Can you explain the high-level architecture of this repository and how data flows through it?",
      icon: "🏗️",
    },
    {
      label: "Authentication",
      prompt: "How is authentication and authorization handled in this repository? Where are tokens validated?",
      icon: "🔐",
    },
    {
      label: "API Endpoints",
      prompt: "What are the primary API routes implemented in this codebase and what middleware protect them?",
      icon: "⚡",
    },
    {
      label: "Database Models",
      prompt: "What database models or entities are defined in this project and what fields do they contain?",
      icon: "🗄️",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center my-auto">
      {/* Icon Badge */}
      <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 mb-4 shadow-lg shadow-cyan-500/5">
        <svg
          className="w-7 h-7 text-cyan-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping opacity-75" />
      </div>

      <h3 className="text-sm sm:text-base font-semibold text-slate-100">
        Ask anything about {projectName || "this repository"}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1.5 mb-6 leading-relaxed">
        Grounded directly in the repository's source files, API routes, database schemas, and RIE analysis artifacts with line citations.
      </p>

      {/* Suggested Starter Prompts */}
      <div className="w-full flex flex-col gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 text-left font-medium">
          Suggested Questions
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {suggestedPrompts.map((item, idx) => (
            <button
              key={`prompt-${idx}`}
              type="button"
              onClick={() => onSelectPrompt?.(item.prompt)}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-white/[0.08] bg-[#070c18] hover:bg-[#0c1424] hover:border-cyan-500/30 transition-all text-left group cursor-pointer"
            >
              <span className="text-sm shrink-0">{item.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {item.label}
                </span>
                <span className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {item.prompt}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

