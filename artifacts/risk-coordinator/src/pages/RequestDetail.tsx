import { useState } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetRequest, getGetRequestQueryKey, useClassifyRequest,
  useListEmailDrafts, getListEmailDraftsQueryKey, useGenerateEmailDrafts, useUpdateEmailDraft,
  useListNotes, getListNotesQueryKey, useCreateNote,
  useListStatusHistory, getListStatusHistoryQueryKey, useChangeStatus,
  useGenerateCalendarPreview, useCreateMeeting, useUpdateMeeting,
  useSendMeetingInvite, useCancelMeetingInvite,
  getConfig
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Edit, AlertCircle, RefreshCw, Plus, MessageSquare, User, Mail, CalendarPlus, Send, CalendarX } from "lucide-react";
import { openInOutlook, downloadInvite } from "@/lib/outlook";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function RequestDetail() {
  const [, params] = useRoute("/requests/:id");
  const requestId = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: request, isLoading, isError } = useGetRequest(requestId, {
    query: { enabled: !!requestId, queryKey: getGetRequestQueryKey(requestId) }
  });

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: () => getConfig() });

  const classifyRequest = useClassifyRequest();

  if (isLoading) {
    return <div className="p-8 max-w-6xl mx-auto space-y-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (isError || !request) {
    return <div className="p-8 text-destructive">Failed to load request or not found.</div>;
  }

  const handleClassify = () => {
    classifyRequest.mutate({ id: requestId }, {
      onSuccess: () => {
        toast({ title: "Classification updated" });
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      },
      onError: () => toast({ title: "Classification failed", variant: "destructive" })
    });
  };

  const attendeesByRole = request.attendees?.reduce((acc, att) => {
    const role = att.role || "Unknown";
    if (!acc[role]) acc[role] = [];
    acc[role].push(att);
    return acc;
  }, {} as Record<string, typeof request.attendees>);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/">
          <div className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer transition-colors font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </div>
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-sans)" }}>{request.projectName || "Unnamed Project"}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={request.status === "Completed" ? "outline" : "default"} className="px-3 py-1 rounded-full">{request.status}</Badge>
              {request.isMajorOpportunity && <Badge variant="destructive" className="px-3 py-1 rounded-full">MAJOR OPPORTUNITY</Badge>}
              <span className="text-muted-foreground text-sm font-medium">{request.crmOpportunityNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClassify} disabled={classifyRequest.isPending} className="rounded-full">
              <RefreshCw className={`w-4 h-4 mr-2 ${classifyRequest.isPending ? "animate-spin" : ""}`} />
              Re-Classify
            </Button>
            <Link href={`/requests/${requestId}/edit`}>
              <Button size="sm" className="rounded-full">
                <Edit className="w-4 h-4 mr-2" /> Edit Request
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {request.warnings && request.warnings.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 space-y-2 text-sm text-orange-800 dark:text-orange-300">
          <div className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Validation Warnings
          </div>
          <ul className="list-disc list-inside pl-6 space-y-1">
            {request.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6 tracking-tight">Opportunity Details</h2>
            <div className="grid grid-cols-2 gap-y-6 gap-x-6 text-sm">
              <div>
                <div className="text-muted-foreground mb-1 font-medium">Client</div>
                <div className="font-medium text-foreground">{request.clientName || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 font-medium">Type</div>
                <div className="font-medium text-foreground">{request.requestType || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 font-medium">BMCD Contract Value</div>
                <div className="font-medium text-foreground">{request.bmcdContractValueRaw || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 font-medium">Total Installed Cost</div>
                <div className="font-medium text-foreground">{request.totalInstalledCostRaw || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 font-medium">Business Line Class</div>
                <div className="font-medium text-foreground">{request.businessLineClassification || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 font-medium">Created At</div>
                <div className="font-medium text-foreground">{request.createdAt ? format(new Date(request.createdAt), "PPP") : "—"}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6 tracking-tight">Selected Risk Triggers</h2>
            {request.triggers && request.triggers.length > 0 ? (
              <ul className="space-y-4">
                {request.triggers.map(t => (
                  <li key={t.id} className="text-sm flex items-start p-3 bg-muted/30 rounded-lg">
                    <span className="font-bold text-primary mr-3 mt-0.5">#{t.triggerNumber}</span>
                    <div className="flex-1">
                      <span className="font-medium">{t.triggerName}</span>
                      {t.isMajorOpportunityTrigger && <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1.5 rounded-sm">MAJOR</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No risk triggers selected.</div>
            )}
          </div>

          <AttendeesSection attendeesByRole={attendeesByRole || {}} />
          
          <NotesSection requestId={requestId} />

        </div>

        <div className="space-y-8">
          <StatusWorkflowSection request={request} config={config} />
          <MeetingsSection request={request} config={config} />
          <EmailDraftsSection requestId={requestId} config={config} />
          <CalendarPreviewSection requestId={requestId} requestType={request.requestType} />
        </div>
      </div>
    </div>
  );
}

function StatusWorkflowSection({ request, config }: { request: any, config: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(request.status || "");
  const [nextAction, setNextAction] = useState(request.nextAction || "");
  const [notes, setNotes] = useState("");
  const changeStatus = useChangeStatus();

  const { data: history } = useListStatusHistory(request.id, {
    query: { enabled: !!request.id, queryKey: getListStatusHistoryQueryKey(request.id) }
  });

  const handleUpdate = () => {
    changeStatus.mutate({ id: request.id, data: { newStatus, nextAction: nextAction || undefined, notes: notes || undefined } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });
        queryClient.invalidateQueries({ queryKey: getListStatusHistoryQueryKey(request.id) });
        setIsOpen(false);
        setNotes("");
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" })
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight">Workflow Status</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary" className="rounded-full">Update</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Status</DialogTitle>
              <DialogDescription>Change the current status and next action for this request.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {config?.statuses?.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>) || <SelectItem value={request.status}>{request.status}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Select value={nextAction} onValueChange={setNextAction}>
                  <SelectTrigger><SelectValue placeholder="Select next action (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {config?.nextActions?.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why is this changing?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={handleUpdate} disabled={changeStatus.isPending || !newStatus} className="rounded-full">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-muted/30 p-4 rounded-xl">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-bold">Current Status</div>
          <div className="font-semibold text-lg text-primary">{request.status}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-bold">Next Action</div>
          <div className="font-medium">{request.nextAction || "—"}</div>
        </div>
      </div>

      {history && history.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Recent History</h3>
          <div className="space-y-3">
            {history.slice(0, 3).map((h: any) => (
              <div key={h.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/40" />
                  <span className="font-medium text-foreground">{h.newStatus}</span>
                  <span className="text-muted-foreground text-xs">{h.changedAt ? format(new Date(h.changedAt), "MMM d") : ""}</span>
                </div>
                {h.notes && <div className="ml-4 mt-1 text-muted-foreground text-xs italic">{h.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendeesSection({ attendeesByRole }: { attendeesByRole: Record<string, any[]> }) {
  if (Object.keys(attendeesByRole || {}).length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 tracking-tight">Attendees & Stakeholders</h2>
        <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No attendees recorded.</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-6 tracking-tight">Attendees & Stakeholders</h2>
      <div className="space-y-6">
        {Object.entries(attendeesByRole).map(([role, attendees]) => (
          <div key={role}>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">{role}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attendees.map(att => (
                <div key={att.id} className="flex items-start gap-3 p-3 border border-border/50 rounded-xl bg-card">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{att.name || "Unknown"}</div>
                    {att.email && <div className="text-xs text-muted-foreground truncate">{att.email}</div>}
                    <div className="flex gap-2 mt-1.5">
                      {att.isRequired && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Required</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailDraftsSection({ requestId, config }: { requestId: number, config: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: drafts, isLoading } = useListEmailDrafts(requestId, { query: { enabled: !!requestId, queryKey: getListEmailDraftsQueryKey(requestId) } });
  const generateDrafts = useGenerateEmailDrafts();
  const updateDraft = useUpdateEmailDraft();

  const templateTypes: string[] = config?.templateTypes ?? [];
  const draftStatuses: string[] = config?.draftStatuses ?? [];
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const toggleType = (t: string) =>
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleGenerate = () => {
    const data = selectedTypes.length > 0 ? { templateTypes: selectedTypes } : {};
    generateDrafts.mutate({ id: requestId, data }, {
      onSuccess: () => {
        toast({ title: "Drafts generated" });
        queryClient.invalidateQueries({ queryKey: getListEmailDraftsQueryKey(requestId) });
        setIsGenOpen(false);
        setSelectedTypes([]);
      },
      onError: () => toast({ title: "Failed to generate drafts", variant: "destructive" })
    });
  };

  const handleSave = (id: number, data: any) => {
    updateDraft.mutate({ id, data }, {
      onSuccess: () => {
        toast({ title: "Draft saved" });
        queryClient.invalidateQueries({ queryKey: getListEmailDraftsQueryKey(requestId) });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" })
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Email Drafts</h2>
        <Dialog open={isGenOpen} onOpenChange={setIsGenOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full">
              <MessageSquare className="w-4 h-4 mr-2" /> Generate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Email Drafts</DialogTitle>
              <DialogDescription>Select which templates to generate. Leave all unchecked to use the recommended defaults for this request type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {templateTypes.map((t) => (
                <label key={t} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox checked={selectedTypes.includes(t)} onCheckedChange={() => toggleType(t)} />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGenOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={handleGenerate} disabled={generateDrafts.isPending} className="rounded-full">Generate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-xs text-muted-foreground mb-6">Use "Open in Outlook" to launch a pre-filled message in your mail client. Drafts are saved here for reference; nothing is sent automatically.</p>
      
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : drafts && drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft: any) => (
            <DraftItem key={draft.id} draft={draft} draftStatuses={draftStatuses} onSave={(d) => handleSave(draft.id, d)} isSaving={updateDraft.isPending} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No drafts generated yet.</div>
      )}
    </div>
  );
}

function DraftItem({ draft, draftStatuses, onSave, isSaving }: { draft: any, draftStatuses: string[], onSave: (d: any) => void, isSaving: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [to, setTo] = useState(draft.toRecipients || "");
  const [cc, setCc] = useState(draft.ccRecipients || "");
  const [from, setFrom] = useState(draft.fromRecipients || "");
  const [subject, setSubject] = useState(draft.subject || "");
  const [body, setBody] = useState(draft.body || "");
  const [status, setStatus] = useState(draft.status || "Draft");

  const statusOptions = draftStatuses.length > 0 ? draftStatuses : ["Draft", "Sent Manually"];

  if (isEditing) {
    return (
      <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
        <div className="flex justify-between items-center mb-2">
          <Badge variant="secondary">{draft.templateType}</Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { onSave({ toRecipients: to, ccRecipients: cc, fromRecipients: from, subject, body, status }); setIsEditing(false); }} disabled={isSaving} className="rounded-full">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">CC</Label>
          <Input value={cc} onChange={e => setCc(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-sm font-medium" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Body</Label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} className="min-h-[120px] text-sm font-mono leading-relaxed" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="font-semibold text-sm line-clamp-1">{draft.subject}</div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs rounded-full"
            onClick={() => openInOutlook({ to: draft.toRecipients, cc: draft.ccRecipients, subject: draft.subject, body: draft.body })}
          >
            <Mail className="w-3.5 h-3.5 mr-1" /> Open in Outlook
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditing(true)}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-3 flex gap-2 items-center flex-wrap">
        <Badge variant="outline" className="text-[10px]">{draft.templateType}</Badge>
        <Badge variant={draft.status === "Sent Manually" ? "default" : "secondary"} className="text-[10px]">{draft.status}</Badge>
        {draft.fromRecipients && <span className="truncate">From: {draft.fromRecipients}</span>}
        <span className="truncate">To: {draft.toRecipients}</span>
        {draft.ccRecipients && <span className="truncate">CC: {draft.ccRecipients}</span>}
      </div>
      <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 p-2 rounded whitespace-pre-wrap font-mono">
        {draft.body}
      </div>
    </div>
  );
}

function NotesSection({ requestId }: { requestId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: notes, isLoading } = useListNotes(requestId, { query: { enabled: !!requestId, queryKey: getListNotesQueryKey(requestId) } });
  const createNote = useCreateNote();
  const [newNote, setNewNote] = useState("");

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createNote.mutate({ id: requestId, data: { noteText: newNote } }, {
      onSuccess: () => {
        setNewNote("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(requestId) });
      },
      onError: () => toast({ title: "Failed to add note", variant: "destructive" })
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-6 tracking-tight">Notes & Comments</h2>
      
      <div className="flex gap-2 mb-6">
        <Input placeholder="Add a new note..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddNote()} className="bg-muted/20 rounded-full" />
        <Button onClick={handleAddNote} disabled={!newNote.trim() || createNote.isPending} className="rounded-full">Add</Button>
      </div>

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-4">
          {notes.map((note: any) => (
            <div key={note.id} className="p-4 border border-border/50 rounded-xl bg-card">
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-sm">{note.createdBy || "System"}</div>
                <div className="text-xs text-muted-foreground">{note.createdAt ? format(new Date(note.createdAt), "MMM d, h:mm a") : ""}</div>
              </div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{note.noteText}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No notes yet.</div>
      )}
    </div>
  );
}

function CalendarPreviewSection({ requestId, requestType }: { requestId: number, requestType?: string | null }) {
  const generatePreview = useGenerateCalendarPreview();
  const [preview, setPreview] = useState<any>(null);

  // Only Pre-Risk reviews receive a calendar invite. Formal/Final stages are
  // scheduled by Corporate Risk, so no invite is generated here.
  const isPreRisk = (requestType ?? "").toLowerCase().includes("pre-risk");
  if (!isPreRisk) return null;

  const handlePreview = () => {
    generatePreview.mutate({ id: requestId, data: { meetingType: "Pre-Risk" } }, {
      onSuccess: (data) => setPreview(data),
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Pre-Risk Invite Preview</h2>
        <Badge variant="secondary">Preview Only</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-6">See how the Pre-Risk calendar invite would look before scheduling. No event will be created.</p>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <Button variant="outline" onClick={handlePreview} disabled={generatePreview.isPending} className="rounded-full">
          {generatePreview.isPending ? "Loading..." : "Generate Pre-Risk Preview"}
        </Button>
        {preview && (
          <Button onClick={() => downloadInvite(preview)} disabled={!preview.start} className="rounded-full">
            <CalendarPlus className="w-4 h-4 mr-2" /> Download Outlook invite (.ics)
          </Button>
        )}
        {preview && !preview.start && (
          <span className="text-xs text-muted-foreground">Set a Pre-Risk Target Date to enable the invite.</span>
        )}
      </div>

      {preview && (
        <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-4 animate-in fade-in">
          {preview.organizer && (
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Organizer</div>
              <div className="text-sm">{preview.organizer}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Subject</div>
            <div className="font-medium text-sm">{preview.subject}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Required Attendees</div>
            <div className="text-sm">{preview.requiredAttendees?.join(", ") || "None"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Body Preview</div>
            <div className="text-xs font-mono bg-muted/30 p-2 rounded whitespace-pre-wrap max-h-40 overflow-auto">{preview.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingsSection({ request, config }: { request: any, config: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const sendInvite = useSendMeetingInvite();
  const cancelInvite = useCancelMeetingInvite();

  const [isOpen, setIsOpen] = useState(false);
  const [meetingType, setMeetingType] = useState("Pre-Risk");
  const [editMeetingId, setEditMeetingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("Scheduled");
  const [inviteMeeting, setInviteMeeting] = useState<any | null>(null);
  const [inviteStart, setInviteStart] = useState("");
  const [inviteEnd, setInviteEnd] = useState("");
  const [inviteSubject, setInviteSubject] = useState("");

  const toLocalInput = (iso: string | null | undefined) =>
    iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";

  const openInviteDialog = (m: any) => {
    setInviteMeeting(m);
    setInviteStart(toLocalInput(m.scheduledStart));
    setInviteEnd(toLocalInput(m.scheduledEnd));
    setInviteSubject(m.subject || `${m.meetingType} Risk Review - ${request.projectName || ""}`.trim());
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });

  const handleSendInvite = () => {
    if (!inviteMeeting) return;
    if (!inviteStart || !inviteEnd) {
      toast({ title: "Pick a start and end time first", variant: "destructive" });
      return;
    }
    if (new Date(inviteEnd) <= new Date(inviteStart)) {
      toast({ title: "End time must be after the start time", variant: "destructive" });
      return;
    }
    const isUpdate = !!inviteMeeting.outlookEventId;
    updateMeeting.mutate(
      {
        id: inviteMeeting.id,
        data: {
          scheduledStart: new Date(inviteStart).toISOString(),
          scheduledEnd: new Date(inviteEnd).toISOString(),
          subject: inviteSubject || null,
        },
      },
      {
        onSuccess: () => {
          sendInvite.mutate(
            { id: inviteMeeting.id },
            {
              onSuccess: () => {
                refresh();
                setInviteMeeting(null);
                toast({
                  title: isUpdate ? "Invite updated" : "Invite sent",
                  description: isUpdate
                    ? "Attendees will receive the updated meeting details."
                    : "Attendees will receive the Outlook calendar invite.",
                });
              },
              onError: (err: any) => {
                refresh();
                toast({
                  title: isUpdate ? "Failed to update invite" : "Failed to send invite",
                  description: err?.data?.message || err?.message,
                  variant: "destructive",
                });
              },
            },
          );
        },
        onError: () => toast({ title: "Failed to save meeting time", variant: "destructive" }),
      },
    );
  };

  const handleCancelMeeting = (m: any) => {
    const hadInvite = !!m.outlookEventId;
    if (!window.confirm(
      hadInvite
        ? "Cancel this meeting? Attendees will receive an Outlook cancellation."
        : "Cancel this meeting?",
    )) return;
    cancelInvite.mutate(
      { id: m.id },
      {
        onSuccess: () => {
          refresh();
          toast({
            title: "Meeting cancelled",
            description: hadInvite
              ? "An Outlook cancellation was sent to attendees."
              : undefined,
          });
        },
        onError: (err: any) =>
          toast({
            title: "Failed to cancel meeting",
            description: err?.data?.message || err?.message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleAddMeeting = () => {
    createMeeting.mutate({ id: request.id, data: { meetingType, status: "Scheduled" } }, {
      onSuccess: () => {
        toast({ title: "Meeting added" });
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });
        setIsOpen(false);
      },
      onError: () => toast({ title: "Failed to add meeting", variant: "destructive" })
    });
  };

  const handleUpdateMeeting = (mId: number) => {
    updateMeeting.mutate({ id: mId, data: { status: editStatus } }, {
      onSuccess: () => {
        toast({ title: "Meeting updated" });
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });
        setEditMeetingId(null);
      },
      onError: () => toast({ title: "Failed to update meeting", variant: "destructive" })
    });
  };

  const handleReschedule = (m: any) => {
    updateMeeting.mutate(
      { id: m.id, data: { rescheduledCount: (m.rescheduledCount ?? 0) + 1, status: "Needs Scheduling" } },
      {
        onSuccess: () => {
          toast({ title: "Marked for reschedule" });
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });
        },
        onError: () => toast({ title: "Failed to reschedule", variant: "destructive" })
      }
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight">Meetings</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full h-8"><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Meeting Record</DialogTitle>
              <DialogDescription>Add a basic meeting record to track scheduling status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Meeting Type</Label>
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {config?.meetingTypes?.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>) || (
                      <>
                        <SelectItem value="Pre-Risk">Pre-Risk</SelectItem>
                        <SelectItem value="Formal Risk">Formal Risk</SelectItem>
                        <SelectItem value="Final Risk">Final Risk</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-full">Cancel</Button>
              <Button onClick={handleAddMeeting} disabled={createMeeting.isPending} className="rounded-full">Add Meeting</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {request.meetings && request.meetings.length > 0 ? (
        <div className="space-y-3">
          {request.meetings.map((m: any) => (
            <div key={m.id} className="border border-border/60 rounded-xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center group bg-card gap-2">
              <div>
                <div className="font-bold text-sm text-primary mb-1 flex items-center gap-2">
                  {m.meetingType}
                  {m.outlookEventId && (
                    <Badge variant="outline" className="text-[10px] font-normal">Invite sent</Badge>
                  )}
                </div>
                <div className="text-sm font-medium">{m.subject || "No Subject"}</div>
                {m.scheduledStart && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(m.scheduledStart), "MMM d, yyyy h:mm a")}
                    {m.scheduledEnd ? ` - ${format(new Date(m.scheduledEnd), "h:mm a")}` : ""}
                  </div>
                )}
                {(m.rescheduledCount ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Rescheduled {m.rescheduledCount}x</div>
                )}
              </div>
              
              {editMeetingId === m.id ? (
                <div className="flex gap-2 items-center mt-2 sm:mt-0">
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {config?.meetingStatuses?.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>) || (
                        <>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleUpdateMeeting(m.id)} disabled={updateMeeting.isPending} className="rounded-full h-8">Save</Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditMeetingId(null)} className="h-8 w-8"><AlertCircle className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                  <Badge variant={m.status === "Completed" ? "outline" : "secondary"} className="h-6">{m.status}</Badge>
                  {m.status !== "Cancelled" && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => openInviteDialog(m)} disabled={sendInvite.isPending || updateMeeting.isPending}>
                      <Send className="w-3.5 h-3.5 mr-1" /> {m.outlookEventId ? "Update invite" : "Send invite"}
                    </Button>
                  )}
                  {m.status !== "Cancelled" && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleCancelMeeting(m)} disabled={cancelInvite.isPending}>
                      <CalendarX className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleReschedule(m)} disabled={updateMeeting.isPending}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reschedule
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditMeetingId(m.id); setEditStatus(m.status); }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No meetings scheduled.</div>
      )}

      {/* Send / update Outlook invite */}
      <Dialog open={!!inviteMeeting} onOpenChange={(o) => !o && setInviteMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteMeeting?.outlookEventId ? "Update Outlook Invite" : "Send Outlook Invite"}</DialogTitle>
            <DialogDescription>
              {inviteMeeting?.outlookEventId
                ? "Attendees will receive an updated meeting from Outlook."
                : "Creates a calendar event and sends invites to all attendees on this request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={inviteSubject} onChange={(e) => setInviteSubject(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" value={inviteStart} onChange={(e) => setInviteStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" value={inviteEnd} onChange={(e) => setInviteEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setInviteMeeting(null)}>Close</Button>
            <Button className="rounded-full" onClick={handleSendInvite} disabled={sendInvite.isPending || updateMeeting.isPending}>
              <Send className="w-4 h-4 mr-1" />
              {inviteMeeting?.outlookEventId ? "Send update" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
