import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import type { LeadTemperature, LeadStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = "MMM d, yyyy") {
  return format(new Date(date), pattern);
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function getTemperatureColor(temp: LeadTemperature) {
  return {
    HOT: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800",
    WARM: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800",
    COLD: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800",
  }[temp];
}

export function getStatusColor(status: LeadStatus) {
  const map: Record<LeadStatus, string> = {
    NEW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    QUALIFYING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    QUALIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    MEETING_SCHEDULED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    PROPOSAL_SENT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    NEGOTIATION: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    LOST: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    INACTIVE: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  return map[status];
}

export function getScoreColor(score: number) {
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-blue-600 dark:text-blue-400";
}

export function getScoreBg(score: number) {
  if (score >= 80) return "bg-red-500";
  if (score >= 60) return "bg-orange-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-blue-500";
}

export function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    Urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return map[priority] ?? map.Low;
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function getAvatarColor(id: string) {
  const colors = [
    "bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500",
    "bg-pink-500","bg-teal-500","bg-indigo-500","bg-cyan-500",
  ];
  const idx = id.charCodeAt(id.length - 1) % colors.length;
  return colors[idx];
}

export function truncate(str: string, maxLen: number) {
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
