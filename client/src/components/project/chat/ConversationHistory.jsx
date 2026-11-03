// client/src/components/project/chat/ConversationHistory.jsx
//
// Collapsible conversation history panel within the chat drawer.
// Displays project-scoped conversations, message counts, timestamps,
// and delete actions.

import { useState } from "react";

function formatTimestamp(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationHistory({
  conversations = [],
  activeConversationId,
  isLoading = false,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, convId) => {
    e.stopPropagation();
    if (deletingId) return;
    try {
      setDeletingId(convId);
      await onDeleteConversation(convId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#04070d] border-b sm:border-b-0 sm:border-r border-white/[0.08] p-3 overflow-y-auto no-scrollbar">
      {/* Top Action */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Conversations ({conversations.length})
        </span>
        <button
          type="button"
          onClick={onNewChat}
          className="px-2 py-1 rounded text-[11px] font-medium text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-colors cursor-pointer"
        >
          + New Chat
        </button>
      </div>

      {isLoading && conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
          <div className="w-5 h-5 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-2" />
          <span className="text-xs font-mono">Loading history...</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
          <p className="text-xs text-slate-500">No previous conversations for this project.</p>
          <button
            type="button"
            onClick={onNewChat}
            className="mt-3 text-xs font-semibold text-cyan-400 hover:underline cursor-pointer"
          >
            Start your first chat →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {conversations.map((conv) => {
            const isActive = conv.conversationId === activeConversationId;
            const isDeleting = deletingId === conv.conversationId;

            return (
              <div
                key={conv.conversationId}
                onClick={() => onSelectConversation(conv.conversationId)}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group ${
                  isActive
                    ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-200"
                    : "bg-[#070c18] border-white/[0.05] hover:bg-white/[0.04] text-slate-300"
                } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span
                    className={`text-xs font-medium truncate ${
                      isActive ? "text-cyan-200 font-semibold" : "text-slate-200"
                    }`}
                    title={conv.title}
                  >
                    {conv.title || "Untitled Conversation"}
                  </span>

                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500">
                    <span>{formatTimestamp(conv.lastMessageAt || conv.updatedAt)}</span>
                    <span>•</span>
                    <span>{conv.messageCount || 0} msgs</span>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, conv.conversationId)}
                  disabled={isDeleting}
                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

