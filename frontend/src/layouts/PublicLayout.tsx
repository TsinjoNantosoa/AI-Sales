import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <ChatbotWidget />
      <Toaster position="top-right" richColors />
    </div>
  );
}
