// client/src/components/project/chat/RepositoryChatDrawer.jsx
//
// Repository AI Chat Drawer in ArchMind AI.
// Integrates with Phase 3 Groq backend, manages multi-conversation history,
// optimistic messaging, citation display, and strict project scoping.

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import ChatHeader from "./ChatHeader";
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import ConversationHistory from "./ConversationHistory";
import ChatErrorState from "./ChatErrorState";
import {
  fetchChatConversations,
  fetchChatConversationHistory,
  createChatConversation,
  sendChatMessage,
  deleteChatConversation,
} from "../../../services/projectService";

export default function RepositoryChatDrawer({
  isOpen,
  onClose,
  projectId,
  project,
}) {
  const { getToken, isLoaded } = useAuth();

  // Conversations State (Project-Scoped)
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTitle, setActiveTitle] = useState("New Conversation");
  const [messages, setMessages] = useState([]);

  // UI State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentStageLabel, setCurrentStageLabel] = useState("");
  const [error, setError] = useState(null);
  const [draftMessage, setDraftMessage] = useState("");

  // Refs for race-condition guards & cancellation
  const abortControllerRef = useRef(null);
  const currentProjectIdRef = useRef(projectId);
  const drawerRef = useRef(null);

  const projectName = project?.name || project?.github?.fullName || "Repository";

  const [prevProjectId, setPrevProjectId] = useState(projectId);

  // ── 1. Project Scoping & Reset (React state adjustment pattern) ─────────────
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    setConversations([]);
    setActiveConversationId(null);
    setActiveTitle("New Conversation");
    setMessages([]);
    setError(null);
    setIsHistoryOpen(false);
  }

  // Abort controller ref cleanup on unmount or project change
  useEffect(() => {
    currentProjectIdRef.current = projectId;
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [projectId]);

  // ── 2. Load Conversation List when drawer opens or projectId changes ────────
  useEffect(() => {
    if (!isOpen || !isLoaded || !projectId) return;

    let ignore = false;
    const controller = new AbortController();

    async function load() {
      const token = await getToken();
      if (!token || ignore) return;
      setIsLoadingHistory(true);

      try {
        const list = await fetchChatConversations(token, projectId, controller.signal);
        if (!ignore) {
          setConversations(list);
        }
      } catch (err) {
        if (!ignore && err.name !== "CanceledError" && err.name !== "AbortError") {
          console.warn("[RepositoryChatDrawer] Failed to load conversations:", err.message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingHistory(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isOpen, projectId, isLoaded, getToken]);

  const refreshConversations = useCallback(async () => {
    if (!isLoaded || !projectId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const list = await fetchChatConversations(token, projectId);
      setConversations(list);
    } catch (err) {
      console.warn("[RepositoryChatDrawer] Failed to refresh conversations:", err.message);
    }
  }, [projectId, isLoaded, getToken]);

  // ── 3. Load Active Conversation History ────────────────────────────────────
  const selectConversation = useCallback(
    async (convId) => {
      if (!convId || convId === activeConversationId) {
        setIsHistoryOpen(false);
        return;
      }

      try {
        setError(null);
        setIsLoadingHistory(true);
        setStreamingContent("");
        setCurrentStageLabel("");
        setActiveConversationId(convId);
        setIsHistoryOpen(false);

        const token = await getToken();
        if (!token) throw new Error("Authentication required.");

        const history = await fetchChatConversationHistory(token, projectId, convId);
        if (currentProjectIdRef.current === projectId) {
          setMessages(history.messages || []);
          setActiveTitle(history.title || "Conversation");
        }
      } catch (err) {
        console.error("[RepositoryChatDrawer] Failed to load conversation history:", err);
        setError(err.response?.data?.error || err.message || "Failed to load conversation history.");
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [activeConversationId, projectId, getToken]
  );

  // ── 4. Start New Chat ──────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setActiveTitle("New Conversation");
    setMessages([]);
    setStreamingContent("");
    setCurrentStageLabel("");
    setError(null);
    setIsHistoryOpen(false);
  }, []);

  // ── 5. Delete Conversation ─────────────────────────────────────────────────
  const handleDeleteConversation = useCallback(
    async (convId) => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required.");

        await deleteChatConversation(token, projectId, convId);

        setConversations((prev) => prev.filter((c) => c.conversationId !== convId));

        if (activeConversationId === convId) {
          handleNewChat();
        }
      } catch (err) {
        console.error("[RepositoryChatDrawer] Delete conversation error:", err);
        setError(err.response?.data?.error || err.message || "Failed to delete conversation.");
      }
    },
    [projectId, activeConversationId, getToken, handleNewChat]
  );

  // ── 6. Send Message with Optimistic Update & Auto-Conversation Creation ────
  const handleSendMessage = useCallback(
    async (messageText) => {
      const trimmed = messageText.trim();
      if (!trimmed || isSending) return;

      const optimisticMsgId = `opt-${Date.now()}`;
      const userMessage = {
        messageId: optimisticMsgId,
        role: "user",
        content: trimmed,
        citations: [],
        metadata: {},
        createdAt: new Date().toISOString(),
      };

      // Optimistically append user message
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      // Create new abort controller for this message exchange
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication session expired.");

        let targetConvId = activeConversationId;

        // Auto-create conversation if none is active
        if (!targetConvId) {
          const newConv = await createChatConversation(
            token,
            projectId,
            trimmed.slice(0, 40) + (trimmed.length > 40 ? "..." : "")
          );
          targetConvId = newConv.conversationId;
          setActiveConversationId(targetConvId);
          setActiveTitle(newConv.title || trimmed.slice(0, 30));
        }

        // Set initial stage before request begins
        setCurrentStageLabel("Searching repository...");
        setStreamingContent("");

        // Send message to Groq Chat endpoint with real-time SSE streaming callbacks
        const responseData = await sendChatMessage(
          token,
          projectId,
          targetConvId,
          trimmed,
          {
            onStage: (label) => setCurrentStageLabel(label),
            onToken: (chunk) => setStreamingContent((prev) => prev + chunk),
            signal: controller.signal,
          }
        );

        // Guard against project or conversation switch during request
        if (currentProjectIdRef.current !== projectId) return;

        setStreamingContent("");
        setCurrentStageLabel("");

        if (responseData && responseData.message) {
          setMessages((prev) => [...prev, responseData.message]);
          if (responseData.title) {
            setActiveTitle(responseData.title);
          }
        }

        // Refresh conversation list in background to update message count and titles
        refreshConversations();
        setDraftMessage("");
      } catch (err) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;

        setStreamingContent("");
        setCurrentStageLabel("");

        console.error("[RepositoryChatDrawer] Send message failed:", err);
        const errMsg =
          err.response?.data?.error || err.message || "Failed to communicate with Repository AI.";
        setError(errMsg);
        // Preserve user text in draft so they can retry without losing their prompt
        setDraftMessage(trimmed);

        // Mark the optimistic message or add failed assistant indicator
        setMessages((prev) => [
          ...prev,
          {
            messageId: `err-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I encountered an issue generating a response. Please check your network and try again.",
            citations: [],
            metadata: { failed: true, error: errMsg },
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, activeConversationId, projectId, getToken, refreshConversations]
  );

  // ── 7. Keyboard Navigation (Escape to Close) ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-label="Repository AI Chat"
        aria-modal="true"
        className="relative z-10 w-full sm:w-[500px] md:w-[540px] lg:w-[580px] h-full bg-[#050811] border-l border-white/[0.08] shadow-2xl flex flex-col justify-between overflow-hidden"
      >
        {/* Chat Drawer Header */}
        <ChatHeader
          projectName={projectName}
          conversationTitle={activeTitle}
          isHistoryOpen={isHistoryOpen}
          conversationCount={conversations.length}
          onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
          onNewChat={handleNewChat}
          onClose={onClose}
        />

        {/* Error Banner */}
        {error && (
          <div className="p-2 border-b border-red-500/20 bg-red-500/5">
            <ChatErrorState
              error={error}
              onRetry={
                draftMessage ? () => handleSendMessage(draftMessage) : null
              }
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* Drawer Body: History slide-over OR Chat message viewport */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {isHistoryOpen ? (
            <ConversationHistory
              conversations={conversations}
              activeConversationId={activeConversationId}
              isLoading={isLoadingHistory}
              onSelectConversation={selectConversation}
              onDeleteConversation={handleDeleteConversation}
              onNewChat={handleNewChat}
            />
          ) : (
            <ChatMessageList
              messages={messages}
              isSending={isSending}
              streamingContent={streamingContent}
              currentStageLabel={currentStageLabel}
              projectName={projectName}
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              onRetryMessage={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === "user");
                if (lastUser) handleSendMessage(lastUser.content);
              }}
            />
          )}
        </div>

        {/* Chat Composer (Input + Send) */}
        {!isHistoryOpen && (
          <ChatComposer
            onSendMessage={handleSendMessage}
            isSending={isSending}
            initialDraft={draftMessage}
            placeholder={`Ask anything about ${projectName}...`}
          />
        )}
      </aside>
    </div>
  );
}
