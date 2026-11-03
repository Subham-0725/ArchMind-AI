// client/src/components/project/chat/ChatMessageList.jsx
//
// Scrollable message viewport supporting empty states, stage-level thinking indicators,
// real-time streaming token display, and non-intrusive scroll anchoring.

import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatEmptyState from "./ChatEmptyState";
import ChatLoadingState from "./ChatLoadingState";

export default function ChatMessageList({
  messages = [],
  isSending = false,
  streamingContent = "",
  currentStageLabel = "",
  projectName = "",
  onSelectPrompt,
  onRetryMessage,
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);

  // Monitor user scroll position to avoid forceful snapping when scrolled up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distanceToBottom > 120;
  };

  // Auto-scroll when new content arrives ONLY if user is near the bottom
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, streamingContent, currentStageLabel]);

  const isEmpty = messages.length === 0 && !isSending && !streamingContent;

  if (isEmpty) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center">
        <ChatEmptyState projectName={projectName} onSelectPrompt={onSelectPrompt} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3 space-y-1 no-scrollbar"
    >
      {/* Existing Persisted Messages */}
      {messages.map((msg, index) => (
        <ChatMessage
          key={msg.messageId || `msg-${index}`}
          message={msg}
          onRetry={msg.metadata?.failed ? () => onRetryMessage?.(msg) : null}
        />
      ))}

      {/* Real-time Streaming Assistant Message */}
      {streamingContent ? (
        <ChatMessage
          message={{
            role: "assistant",
            content: streamingContent,
            createdAt: new Date().toISOString(),
          }}
          isStreaming={true}
        />
      ) : isSending ? (
        /* Stage-level thinking indicator before first token */
        <ChatLoadingState status={currentStageLabel || "Searching repository..."} />
      ) : null}

      <div ref={bottomRef} className="h-2 shrink-0" />
    </div>
  );
}
