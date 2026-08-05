import { useState } from "react";
import { UserPlus, Edit, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/common/Avatar";
import { mockUsers } from "@/mocks/data";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";

export function TeamPage() {
  const { user } = useAuthStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [users, setUsers] = useState(mockUsers);

  const isAdmin = user?.role === "ADMIN";

  const toggleStatus = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));
    toast.success("User status updated.");
  };

  const getRoleBadge = (role: string) => ({
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    SALES_MANAGER: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
    SALES_REPRESENTATIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  }[role] ?? "bg-muted text-muted-foreground");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground">{users.filter((u) => u.status === "active").length} active members</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{users.length}</p>
          <p className="text-xs text-muted-foreground">Total Members</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{users.filter((u) => u.status === "active").length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{(users.reduce((s, u) => s + u.conversionRate, 0) / users.length).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Avg. Conversion</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Member","Role","Status","Leads","Meetings","Conv. Rate","Last Active","Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <UserAvatar firstName={u.firstName} lastName={u.lastName} id={u.id} size="sm" />
                      <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background", u.status === "active" ? "bg-green-500" : "bg-gray-400")} />
                    </div>
                    <div>
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getRoleBadge(u.role))}>
                    {u.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", u.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{u.assignedLeads}</td>
                <td className="px-4 py-3 text-xs">{u.meetings}</td>
                <td className="px-4 py-3 text-xs font-medium">{u.conversionRate}%</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(u.lastActive)}</td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info("Edit user")}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(u.id)}>
                        <Power className={cn("h-3.5 w-3.5", u.status === "active" ? "text-orange-500" : "text-green-500")} />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input placeholder="John" /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input placeholder="Smith" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" placeholder="john@company.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select defaultValue="SALES_REPRESENTATIVE">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALES_REPRESENTATIVE">Sales Representative</SelectItem>
                    <SelectItem value="SALES_MANAGER">Sales Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={() => { toast.success("Invitation sent!"); setInviteOpen(false); }}>Send Invitation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
