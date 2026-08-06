import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { leadService } from "@/services/leadService";
import { teamService } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";
import type { Lead } from "@/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  companyName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  serviceInterest: z.string().min(1, "Required"),
  source: z.string().optional(),
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  timeline: z.string().optional(),
  needDescription: z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
  assignedUserId: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

export function LeadFormModal({ open, onOpenChange, lead }: Props) {
  const qc = useQueryClient();
  const isEdit = !!lead;

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
    enabled: open,
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (lead) {
      reset({
        firstName: lead.firstName,
        lastName: lead.lastName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        country: lead.country,
        language: lead.language,
        serviceInterest: lead.serviceInterest,
        source: lead.source,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        timeline: lead.timeline,
        needDescription: lead.needDescription,
        estimatedValue: lead.estimatedValue,
        assignedUserId: lead.assignedUserId,
        priority: lead.priority,
        status: lead.status,
        tags: lead.tags.join(", "),
      });
    } else {
      reset({});
    }
  }, [lead, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        phone: data.phone,
        country: data.country || "",
        language: data.language || "en",
        source: (data.source as Lead["source"]) || "Manual",
        status: (data.status as Lead["status"]) || "NEW",
        temperature: "COLD" as Lead["temperature"],
        score: 0,
        priority: data.priority || "Medium",
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        consentGiven: true,
      };
      if (isEdit && lead) {
        return leadService.updateLead(lead.id, payload);
      }
      return leadService.createLead(payload as Omit<Lead, "id" | "createdAt" | "updatedAt">);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      toast.success(isEdit ? "Lead updated successfully." : "Lead created successfully.");
      onOpenChange(false);
    },
    onError: () => toast.error("Something went wrong."),
  });

  const SERVICES = ["AI Automation", "CRM Automation", "RAG Chatbot", "n8n Workflow Development", "Odoo Integration", "Custom Software Development", "Other"];
  const STATUSES: Lead["status"][] = ["NEW","CONTACTED","QUALIFYING","QUALIFIED","MEETING_SCHEDULED","PROPOSAL_SENT","NEGOTIATION","WON","LOST","INACTIVE"];
  const salesUsers = users.filter((u) => u.role !== "ADMIN");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lead" : "New Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <Tabs defaultValue="contact">
            <TabsList className="mb-4">
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input {...register("firstName")} placeholder="John" />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input {...register("lastName")} placeholder="Smith" />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Company *</Label>
                <Input {...register("companyName")} placeholder="ABC Consulting" />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" {...register("email")} placeholder="john@company.com" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" {...register("phone")} placeholder="+1 555 000 0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input {...register("country")} placeholder="United States" />
                </div>
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select onValueChange={(v) => setValue("language", v)}>
                    <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="opportunity" className="space-y-4">
              <div className="space-y-1.5">
                <Label>Service Interest *</Label>
                <Select onValueChange={(v) => setValue("serviceInterest", v)} defaultValue={lead?.serviceInterest}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {errors.serviceInterest && <p className="text-xs text-destructive">{errors.serviceInterest.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Budget Min ($)</Label>
                  <Input type="number" {...register("budgetMin")} placeholder="1000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Budget Max ($)</Label>
                  <Input type="number" {...register("budgetMax")} placeholder="5000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Estimated Value ($)</Label>
                  <Input type="number" {...register("estimatedValue")} placeholder="3500" />
                </div>
                <div className="space-y-1.5">
                  <Label>Timeline</Label>
                  <Select onValueChange={(v) => setValue("timeline", v)}>
                    <SelectTrigger><SelectValue placeholder="Select timeline" /></SelectTrigger>
                    <SelectContent>
                      {["Immediately","Within 30 days","Within 3 months","More than 3 months"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Need Description</Label>
                <Textarea {...register("needDescription")} placeholder="Describe the client's needs..." rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <div className="space-y-1.5">
                <Label>Assign To</Label>
                <Select onValueChange={(v) => setValue("assignedUserId", v)} defaultValue={lead?.assignedUserId}>
                  <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                  <SelectContent>
                    {salesUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select onValueChange={(v) => setValue("priority", v as Lead["priority"])} defaultValue={lead?.priority || "Medium"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Low","Medium","High","Urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select onValueChange={(v) => setValue("status", v)} defaultValue={lead?.status || "NEW"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input {...register("tags")} placeholder="AI, Priority, Enterprise" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea {...register("notes")} placeholder="Internal notes..." rows={3} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : isEdit ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
