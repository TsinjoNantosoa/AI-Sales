import { useState, useRef, useEffect } from "react";
import { Bot, X, Minimize2, Send, User, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  quickReplies?: string[];
}

const QUALIFICATION_FLOW = [
  {
    trigger: null,
    message: "Hello! I'm Ava, your AI Sales Assistant. 👋\nHow can I help you today?",
    quickReplies: ["I need AI automation", "I need a CRM integration", "I want to book a meeting", "I have a question"],
  },
  {
    triggers: ["AI automation", "CRM", "book", "question"],
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
  {
    message: "Based on our conversation, I've calculated your lead profile:\n\n✅ Lead Score: **86/100** — Hot Lead 🔥\n\nWould you like to book a discovery call with one of our specialists?",
    quickReplies: ["Yes, book a meeting!", "Send me more info", "Not right now"],
  },
  {
    triggers: ["book", "meeting"],
    message: "Excellent! Click below to choose a time that works for you. Our team will confirm within minutes.",
    quickReplies: ["📅 Book a 30-min call", "📅 Book a 60-min consultation"],
  },
];

let flowStep = 0;

function getAIResponse(userMessage: string): { message: string; quickReplies?: string[] } {
  flowStep = Math.min(flowStep + 1, QUALIFICATION_FLOW.length - 1);
  const step = QUALIFICATION_FLOW[flowStep];
  return { message: step.message, quickReplies: step.quickReplies };
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
        <Bot className="h-3 w-3 text-white" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: QUALIFICATION_FLOW[0].message,
      sender: "ai",
      timestamp: new Date(),
      quickReplies: QUALIFICATION_FLOW[0].quickReplies,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [qualificationProgress, setQualificationProgress] = useState(10);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      content: text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const progress = Math.min(qualificationProgress + 15, 95);
    setQualificationProgress(progress);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    setIsTyping(false);

    const response = getAIResponse(text);
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: response.message,
      sender: "ai",
      timestamp: new Date(),
      quickReplies: response.quickReplies,
    };
    setMessages((prev) => [...prev, aiMsg]);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); flowStep = 0; }}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 group"
        >
          <Bot className="h-6 w-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background animate-pulse-soft" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 w-[360px] bg-card rounded-2xl shadow-2xl border border-border flex flex-col transition-all duration-200",
            isMinimized ? "h-[64px]" : "h-[520px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border rounded-t-2xl bg-primary text-primary-foreground">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Ava</p>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                <p className="text-xs opacity-90">AI Sales Assistant · Online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Qualification Progress */}
              <div className="px-4 py-2 bg-muted/50 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3 text-primary" />
                    Lead profile completion
                  </span>
                  <span className="text-xs font-semibold text-primary">{qualificationProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${qualificationProgress}%` }}
                  />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <div className={cn("flex items-end gap-2", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}>
                      {msg.sender === "ai" && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {msg.sender === "user" && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[240px] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                          msg.sender === "ai"
                            ? "bg-muted text-foreground rounded-bl-sm"
                            : "bg-primary text-primary-foreground rounded-br-sm"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                    {msg.quickReplies && msg === messages[messages.length - 1] && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                        {msg.quickReplies.map((reply) => (
                          <button
                            key={reply}
                            onClick={() => sendMessage(reply)}
                            className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="text-sm h-9"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isTyping}
                  >
                    {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Powered by AI · <button className="text-primary hover:underline" onClick={() => sendMessage("I want to speak to a human")}>Talk to a human</button>
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
