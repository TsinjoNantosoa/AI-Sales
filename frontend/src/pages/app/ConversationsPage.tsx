import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Send, User, ArrowRightLeft, X, MessageSquare, Loader2,
  Search, ArrowLeft, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/common/Avatar";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { conversationService } from "@/services/conversationService";
import type { Conversation } from "@/types";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";

type Filter = "all" | "open" | "waiting" | "assigned" | "ai_handled" | "human_handoff" | "closed";

const STATUS_DOT: Record<Conversation["status"], string> = {
  open: "bg-emerald-500",
  waiting: "bg-amber-500",
  assigned: "bg-blue-500",
  ai_handled: "bg-purple-500",
  human_handoff: "bg-red-500",
  closed: "bg-slate-400",
};

export function ConversationsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // Mobile: show list (false) or chat (true)
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id, user?.role],
    queryFn: () => conversationService.getConversations({
      currentUserId: user?.id,
      role: user?.role,
    }),
  });

  const selectedConv = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (conversations.length > 0 && !selectedId) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages, isTyping]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      conversationService.sendMessage(selectedId!, content, "agent"),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 1200));
      await conversationService.getAIResponse(selectedId!, messageInput);
      setIsTyping(false);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: () => conversationService.requestHandoff(selectedId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conversations"] }); toast.success("Transferred to human agent."); },
  });

  const closeMutation = useMutation({
    mutationFn: () => conversationService.closeConversation(selectedId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conversations"] }); toast.success("Conversation closed."); },
  });

  const filteredConvs = conversations.filter((c) => {
    const matchFilter = filter === "all" || c.status === filter;
    const matchSearch = !search || `${c.leadName} ${c.leadCompany}`.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowChat(true); // on mobile, push to chat view
  };

  const handleSend = () => {
    if (!messageInput.trim() || !selectedId) return;
    sendMutation.mutate(messageInput);
    setMessageInput("");
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen overflow-hidden">
      {/* ── Conversation List ── */}
      <div className={cn(
        "flex flex-col border-r border-border shrink-0",
        "w-full sm:w-[300px] md:w-[320px]",
        // Mobile: hide list when showing chat
        showChat ? "hidden sm:flex" : "flex"
      )}>
        {/* List Header */}
        <div className="p-3 border-b border-border space-y-2 shrink-0">
          <h2 className="font-semibold text-foreground">Conversations</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all","open","waiting","assigned","ai_handled","human_handoff","closed"].map((f) => (
                <SelectItem key={f} value={f} className="text-xs capitalize">{f.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations" description="No conversations match your filter." />
          ) : filteredConvs.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={cn(
                "w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors",
                selectedId === c.id && "bg-primary/5 border-l-2 border-l-primary"
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="relative shrink-0">
                  <UserAvatar
                    firstName={c.leadName.split(" ")[0]}
                    lastName={c.leadName.split(" ")[1] || ""}
                    id={c.leadId}
                    size="sm"
                  />
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                    STATUS_DOT[c.status]
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={cn("text-sm truncate", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>{c.leadName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.leadCompany}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 opacity-70">{c.lastMessage}</p>
                  {c.humanHandoffRequested && (
                    <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">⚡ Handoff requested</span>
                  )}
                </div>
                {c.unreadCount > 0 && (
                  <span className="h-5 min-w-[20px] px-1 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden min-w-0",
        // Mobile: show only when chat selected
        !showChat ? "hidden sm:flex" : "flex"
      )}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border bg-card shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => setShowChat(false)}
                className="sm:hidden h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                aria-label="Back to list"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="relative shrink-0">
                <UserAvatar
                  firstName={selectedConv.leadName.split(" ")[0]}
                  lastName={selectedConv.leadName.split(" ")[1] || ""}
                  id={selectedConv.leadId}
                  size="sm"
                />
                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background", STATUS_DOT[selectedConv.status])} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{selectedConv.leadName}</p>
                  {selectedConv.humanHandoffRequested && (
                    <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0 animate-pulse-soft">
                      Handoff
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{selectedConv.leadCompany} · {selectedConv.channel}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex h-7 text-xs gap-1"
                  onClick={() => handoffMutation.mutate()}
                >
                  <ArrowRightLeft className="h-3 w-3" /> Handoff
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex h-7 text-xs gap-1"
                  onClick={() => closeMutation.mutate()}
                >
                  <X className="h-3 w-3" /> Close
                </Button>
                {/* Mobile actions dropdown */}
                <div className="sm:hidden">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {selectedConv.messages.map((msg) => (
                <div key={msg.id} className={cn("flex items-end gap-2", msg.sender === "user" ? "flex-row" : "flex-row-reverse")}>
                  {msg.sender === "ai" && (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  {msg.sender === "agent" && (
                    <UserAvatar
                      firstName={msg.senderName?.split(" ")[0] || "A"}
                      lastName={msg.senderName?.split(" ")[1] || ""}
                      id="agent"
                      size="xs"
                    />
                  )}
                  {msg.sender === "user" && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[75%] sm:max-w-[60%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    msg.sender === "user"
                      ? "bg-muted text-foreground rounded-bl-sm"
                      : msg.sender === "ai"
                      ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-foreground rounded-br-sm border border-blue-100 dark:border-blue-800/30"
                      : "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100 rounded-br-sm"
                  )}>
                    {msg.senderName && msg.sender !== "user" && (
                      <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.senderName}</p>
                    )}
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] opacity-40 mt-1 text-right">{timeAgo(msg.timestamp)}</p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-end gap-2 flex-row-reverse">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl px-4 py-3 flex items-center gap-1 border border-blue-100 dark:border-blue-800/30">
                    <span className="typing-dot h-2 w-2 rounded-full bg-blue-500" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-blue-500" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-border bg-card shrink-0">
              {selectedConv.status !== "closed" ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message…"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sendMutation.isPending}
                    size="icon"
                    className="shrink-0"
                  >
                    {sendMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">This conversation is closed.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Choose a conversation from the list to view messages."
            />
          </div>
        )}
      </div>

      {/* ── Lead Info Panel (desktop only) ── */}
      {selectedConv && (
        <div className="hidden lg:flex w-[220px] xl:w-[240px] border-l border-border flex-col p-4 bg-muted/10 shrink-0 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">Lead Info</h3>
          <div className="space-y-3">
            <Link to={`/app/leads/${selectedConv.leadId}`} className="block">
              <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors -mx-2">
                <UserAvatar
                  firstName={selectedConv.leadName.split(" ")[0]}
                  lastName={selectedConv.leadName.split(" ")[1] || ""}
                  id={selectedConv.leadId}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{selectedConv.leadName}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedConv.leadCompany}</p>
                </div>
              </div>
            </Link>
            {[
              { label: "Email", value: selectedConv.leadEmail },
              { label: "Channel", value: selectedConv.channel },
              { label: "Status", value: selectedConv.status.replace("_", " ") },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="text-xs mt-0.5 break-all capitalize">{item.value}</p>
              </div>
            ))}
            {selectedConv.summary && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">AI Summary</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedConv.summary}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
