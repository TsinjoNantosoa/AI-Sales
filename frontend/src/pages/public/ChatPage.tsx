import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Send, User, Loader2, Gauge, ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { conversationService } from "@/services/conversationService";
import { leadService } from "@/services/leadService";
import { publicService } from "@/services/publicService";
import { USE_MOCKS } from "@/lib/constants";
import { getPublicLeadId, getPublicSession } from "@/lib/publicSession";
import type { Lead } from "@/types";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  quickReplies?: string[];
}

const QUALIFICATION_FLOW = [
  {
    message: "Hello! I'm Ava, your AI Sales Assistant.\nI'll help qualify your project. What brings you here today?",
    quickReplies: ["I need AI automation", "I need a CRM integration", "I want to book a meeting", "I have a question"],
  },
  {
    message: "Great choice! What specific business process would you like to automate or improve?",
    quickReplies: ["Lead qualification", "Follow-up emails", "Calendar booking", "Data entry"],
  },
  {
    message: "Which tools are you currently using in your business?",
    quickReplies: ["HubSpot", "Salesforce", "Google Workspace", "None / Manual"],
  },
  {
    message: "What is your estimated budget for this project?",
    quickReplies: ["Less than $1,000", "$1,000 – $3,000", "$3,000 – $5,000", "$5,000 – $10,000", "More than $10,000"],
  },
  {
    message: "When would you like to get started?",
    quickReplies: ["Immediately", "Within 30 days", "Within 3 months"],
  },
  {
    message: "Are you the final decision-maker for this project?",
    quickReplies: ["Yes, I decide", "No, I need approval", "It's a team decision"],
  },
];

export function ChatPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const leadId =
    params.get("leadId") || getPublicLeadId() || sessionStorage.getItem("publicLeadId") || "";

  const [lead, setLead] = useState<Lead | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [score, setScore] = useState(0);
  const [qualified, setQualified] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const bootstrap = useCallback(async () => {
    if (!leadId) {
      setLoading(false);
      return;
    }
    try {
      if (!USE_MOCKS) {
        const session = getPublicSession();
        if (!session?.publicToken) {
          throw new Error("Missing public session");
        }
        const [l, conv] = await Promise.all([
          publicService.getLead(leadId),
          publicService.getOrCreateConversation(leadId),
        ]);
        setLead(l);
        setConversationId(conv.id);
        setScore(l.score);
        setQualified(l.score >= 70);
        setMessages([
          {
            id: "welcome",
            content: `Hi ${l.firstName}! I'm Ava, your AI Sales Assistant.\nI'll help qualify your project for ${l.companyName}. What brings you here today?`,
            sender: "ai",
            timestamp: new Date(),
            quickReplies: QUALIFICATION_FLOW[0].quickReplies,
          },
        ]);
      } else {
        const [l, conv] = await Promise.all([
          leadService.getLead(leadId),
          conversationService.getOrCreateForLead(leadId),
        ]);
        setLead(l);
        setConversationId(conv.id);
        setScore(l.score);
        setQualified(l.score >= 70);
        setMessages([
          {
            id: "welcome",
            content: `Hi ${l.firstName}! I'm Ava, your AI Sales Assistant.\nI'll help qualify your project for ${l.companyName}. What brings you here today?`,
            sender: "ai",
            timestamp: new Date(),
            quickReplies: QUALIFICATION_FLOW[0].quickReplies,
          },
        ]);
        await conversationService.sendMessage(conv.id, QUALIFICATION_FLOW[0].message, "ai");
      }
    } catch {
      toast.error("Lead not found. Please submit a demo request first.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !conversationId || !leadId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      content: text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const nextStep = Math.min(flowStep + 1, QUALIFICATION_FLOW.length);

      if (!USE_MOCKS) {
        const result = await publicService.qualify(conversationId, nextStep, text, leadId);
        setScore(result.qualification.score);
        setLead(result.lead);
        setFlowStep(nextStep);

        let aiContent = result.assistantMessage.content;
        let quickReplies: string[] | undefined;

        if (result.qualification.score >= 70 || nextStep >= QUALIFICATION_FLOW.length) {
          setQualified(true);
          aiContent = `Based on our conversation, I've calculated your lead profile:\n\nLead Score: ${result.qualification.score}/100 — ${result.qualification.temperature} Lead\n\nYou're a strong fit. Would you like to book a discovery call?`;
          quickReplies = ["Yes, book a meeting!", "Send me more info", "Not right now"];
        } else {
          const step = QUALIFICATION_FLOW[Math.min(nextStep, QUALIFICATION_FLOW.length - 1)];
          aiContent = step.message;
          quickReplies = step.quickReplies;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            content: aiContent,
            sender: "ai",
            timestamp: new Date(),
            quickReplies,
          },
        ]);

        if (result.qualification.temperature === "HOT" && result.qualification.score >= 70) {
          toast.success("You're now a hot lead — booking recommended!");
        }
        return;
      }

      const result = await conversationService.applyQualification(
        leadId,
        conversationId,
        nextStep,
        text
      );
      setScore(result.score);
      setLead(result.lead);
      setFlowStep(nextStep);

      let aiContent: string;
      let quickReplies: string[] | undefined;

      if (result.score >= 70 || nextStep >= QUALIFICATION_FLOW.length) {
        setQualified(true);
        aiContent = `Based on our conversation, I've calculated your lead profile:\n\nLead Score: ${result.score}/100 — ${result.temperature} Lead\n\nYou're a strong fit. Would you like to book a discovery call?`;
        quickReplies = ["Yes, book a meeting!", "Send me more info", "Not right now"];
        await conversationService.sendMessage(conversationId, aiContent, "ai");
      } else {
        const step = QUALIFICATION_FLOW[Math.min(nextStep, QUALIFICATION_FLOW.length - 1)];
        aiContent = step.message;
        quickReplies = step.quickReplies;
        await conversationService.sendMessage(conversationId, aiContent, "ai");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: aiContent,
          sender: "ai",
          timestamp: new Date(),
          quickReplies,
        },
      ]);

      if (result.becameHot) {
        toast.success("You're now a hot lead — booking recommended!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat error");
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    if (reply.toLowerCase().includes("book")) {
      navigate(`/book?leadId=${leadId}`);
      return;
    }
    void sendMessage(reply);
  };

  if (!leadId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">No lead linked</h1>
          <p className="text-muted-foreground mb-4">Please submit a demo request first so we can personalize the conversation.</p>
          <Link to="/request-demo"><Button>Request a Demo</Button></Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Ava · AI Sales Assistant</p>
          <p className="text-xs text-muted-foreground truncate">
            {lead ? `${lead.firstName} ${lead.lastName} · ${lead.companyName}` : "Qualification chat"}
          </p>
        </div>
        {qualified && (
          <Button size="sm" onClick={() => navigate(`/book?leadId=${leadId}`)}>
            <Calendar className="h-4 w-4 mr-1" /> Book
          </Button>
        )}
      </header>

      <div className="px-4 py-2 bg-card border-b">
        <div className="flex items-center justify-between mb-1 max-w-2xl mx-auto">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3 text-primary" aria-hidden="true" /> Lead score
          </span>
          <span className="text-xs font-semibold text-primary">{score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden max-w-2xl mx-auto">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className={cn("flex items-end gap-2", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                  msg.sender === "ai" ? "bg-primary" : "bg-muted"
                )}>
                  {msg.sender === "ai" ? <Bot className="h-3.5 w-3.5 text-white" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.sender === "ai" ? "bg-card border rounded-bl-sm" : "bg-primary text-primary-foreground rounded-br-sm"
                )}>
                  {msg.content}
                </div>
              </div>
              {msg.quickReplies && msg === messages[messages.length - 1] && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                  {msg.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => handleQuickReply(reply)}
                      className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-9">
              <Loader2 className="h-4 w-4 animate-spin" /> Ava is typing…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t bg-card p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <Button
            size="icon"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
