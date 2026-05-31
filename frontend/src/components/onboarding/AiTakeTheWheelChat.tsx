import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AiProposalReview } from "@/components/onboarding/AiProposalReview";
import {
  aiAssistantChat,
  type AiChatMessage,
  type AiChatResponse,
  type AiProposal,
} from "@/api/aiAssistant";

interface Props {
  onApplied: () => void;
  onBack: () => void;
}

export function AiTakeTheWheelChat({ onApplied, onBack }: Props) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [summary, setSummary] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const startedRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function handleResponse(resp: AiChatResponse) {
    console.log("[ai-chat] handling response:", resp);
    if (resp.phase === "questioning" && resp.message) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: resp.message },
      ]);
    } else if (resp.phase === "proposing" && resp.proposal) {
      setProposal(resp.proposal);
      setSummary(resp.message);
    } else {
      setErrorMsg(
        `Unexpected response from AI (phase=${resp.phase}, message=${
          resp.message ? "ok" : "empty"
        }). Please retry.`,
      );
    }
  }

  async function callChat(msgs: AiChatMessage[]) {
    console.log("[ai-chat] callChat firing with", msgs.length, "messages");
    setIsPending(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const resp = await aiAssistantChat(msgs, token);
      console.log("[ai-chat] callChat resolved:", resp);
      handleResponse(resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ai-chat] callChat error:", e);
      setErrorMsg(msg);
    } finally {
      setIsPending(false);
    }
  }

  // Kick off the conversation on mount, exactly once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void callChat([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, isPending]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;
    const next: AiChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    void callChat(next);
  }

  if (proposal) {
    return (
      <AiProposalReview
        proposal={proposal}
        summary={summary}
        onApplied={onApplied}
        onBack={() => setProposal(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-violet-500" />
        Kallio's AI assistant will analyze your data and ask a few questions.
      </div>

      <div
        ref={scrollerRef}
        className="h-72 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "flex justify-start"
                : "flex justify-end"
            }
          >
            <div
              className={
                m.role === "assistant"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm bg-background px-3 py-2 text-sm shadow-sm"
                  : "max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white shadow-sm"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-background px-3 py-2 shadow-sm">
              <Spinner className="h-4 w-4" />
            </div>
          </div>
        )}
        {messages.length === 0 && !isPending && !errorMsg && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Starting…
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your answer…"
          disabled={isPending || messages.length === 0}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button
          onClick={handleSend}
          disabled={isPending || !input.trim() || messages.length === 0}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-start">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
