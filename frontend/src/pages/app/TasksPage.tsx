import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, AlertTriangle, Trash2, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/EmptyState";
import { PriorityBadge } from "@/components/common/StatusBadge";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { taskService } from "@/services/taskService";
import { mockUsers, mockLeads } from "@/mocks/data";
import type { Task } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { isPast, isToday } from "date-fns";
import { useAuthStore } from "@/stores/authStore";

export function TasksPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: "", description: "", leadId: "",
    assignedUserId: user?.id ?? "u1", priority: "Medium", dueDate: "",
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: taskService.getTasks,
  });

  const completeMutation = useMutation({
    mutationFn: taskService.completeTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task completed!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: taskService.deleteTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted."); },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newTask) => {
      const lead = mockLeads.find((l) => l.id === data.leadId);
      const assignee = mockUsers.find((u) => u.id === data.assignedUserId);
      return taskService.createTask({
        title: data.title,
        description: data.description,
        leadId: data.leadId || undefined,
        leadName: lead ? `${lead.firstName} ${lead.lastName}` : undefined,
        assignedUserId: data.assignedUserId,
        assignedUserName: assignee ? `${assignee.firstName} ${assignee.lastName}` : "Unknown",
        priority: data.priority as Task["priority"],
        status: "To Do",
        dueDate: data.dueDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created.");
      setCreateOpen(false);
      setNewTask({ title: "", description: "", leadId: "", assignedUserId: user?.id ?? "u1", priority: "Medium", dueDate: "" });
    },
  });

  if (isLoading) return <PageLoader />;

  const myTasks = tasks.filter((t) => t.assignedUserId === user?.id);
  const todayTasks = tasks.filter((t) => isToday(new Date(t.dueDate)) && t.status !== "Completed");
  const overdueTasks = tasks.filter((t) => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== "Completed" && t.status !== "Cancelled");
  const completedTasks = tasks.filter((t) => t.status === "Completed");

  const isOverdue = (t: Task) => overdueTasks.includes(t);

  const TaskCard = ({ task }: { task: Task }) => (
    <div className={cn(
      "bg-card border border-border rounded-xl p-3 sm:p-4 flex items-start gap-3",
      "hover:shadow-sm transition-all duration-150",
      task.status === "Completed" && "opacity-60",
      isOverdue(task) && "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5"
    )}>
      {/* Checkbox */}
      <button
        onClick={() => task.status !== "Completed" && completeMutation.mutate(task.id)}
        disabled={task.status === "Completed"}
        className={cn(
          "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
          task.status === "Completed"
            ? "bg-emerald-500 border-emerald-500 cursor-default"
            : "border-muted-foreground/40 hover:border-primary"
        )}
        aria-label="Complete task"
      >
        {task.status === "Completed" && <Check className="h-3 w-3 text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium leading-snug",
          task.status === "Completed" && "line-through text-muted-foreground"
        )}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 hidden sm:block">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {task.leadName && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
              {task.leadName}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{task.assignedUserName}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <PriorityBadge priority={task.priority} />
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-medium",
          isOverdue(task) ? "text-red-500" : "text-muted-foreground"
        )}>
          {isOverdue(task) && <AlertTriangle className="h-3 w-3" />}
          {formatDate(task.dueDate, "MMM d")}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {task.status !== "Completed" && (
              <DropdownMenuItem onClick={() => completeMutation.mutate(task.id)}>
                <Check className="h-4 w-4 mr-2 text-emerald-500" />Complete
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => setDeleteId(task.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const VIEWS = [
    { value: "all", label: "All", tasks },
    { value: "my", label: "Mine", tasks: myTasks },
    { value: "today", label: "Today", tasks: todayTasks },
    { value: "overdue", label: "Overdue", tasks: overdueTasks, danger: overdueTasks.length > 0 },
    { value: "done", label: "Done", tasks: completedTasks },
  ];

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            {tasks.filter((t) => t.status !== "Completed").length} active
            {overdueTasks.length > 0 && <span className="text-red-500 ml-1">· {overdueTasks.length} overdue</span>}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 h-9 self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "My Tasks", count: myTasks.filter((t) => t.status !== "Completed").length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Today", count: todayTasks.length, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
          { label: "Overdue", count: overdueTasks.length, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Completed", count: completedTasks.length, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-xl border border-border p-3 sm:p-4 text-center", stat.bg)}>
            <p className={cn("text-xl sm:text-2xl font-bold", stat.color)}>{stat.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto gap-1 mb-2">
          {VIEWS.map((v) => (
            <TabsTrigger
              key={v.value}
              value={v.value}
              className={cn("text-xs gap-1.5", v.danger && "data-[state=inactive]:text-red-500")}
            >
              {v.label}
              {v.tasks.length > 0 && (
                <span className={cn(
                  "min-w-[18px] h-[18px] px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  v.danger ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"
                )}>
                  {v.tasks.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {VIEWS.map(({ value, tasks: taskList }) => (
          <TabsContent key={value} value={value}>
            {taskList.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={value === "overdue" ? "No overdue tasks" : "No tasks here"}
                description="All clear!"
                action={{ label: "Create Task", onClick: () => setCreateOpen(true) }}
              />
            ) : (
              <div className="space-y-2">
                {taskList.map((task) => <TaskCard key={task.id} task={task} />)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Create Task Modal ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low","Medium","High","Urgent"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={newTask.assignedUserId} onValueChange={(v) => setNewTask({ ...newTask, assignedUserId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mockUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Related Lead</Label>
              <Select value={newTask.leadId} onValueChange={(v) => setNewTask({ ...newTask, leadId: v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {mockLeads.slice(0, 10).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.firstName} {l.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newTask)}
                disabled={!newTask.title || !newTask.dueDate || createMutation.isPending}
              >
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Task"
        description="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
