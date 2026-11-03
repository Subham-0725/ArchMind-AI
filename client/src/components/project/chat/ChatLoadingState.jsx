// client/src/components/project/chat/ChatLoadingState.jsx
//
// Thinking and context retrieval indicator during active LLM inference.

export default function ChatLoadingState({ status = "Thinking..." }) {
  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4 rounded-xl bg-[#060a12] border border-white/[0.08] mr-6 sm:mr-10 self-start animate-fade-in">
      <div className="flex items-center gap-2 pb-1.5 border-b border-white/[0.05]">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
          AM
        </div>
        <span className="text-xs font-semibold text-slate-200">
          ArchMind Intelligence
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      </div>

      <div className="flex items-center gap-2.5 py-1 text-xs text-cyan-300 font-mono">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
        </div>
        <span>{status}</span>
      </div>
    </div>
  );
}

