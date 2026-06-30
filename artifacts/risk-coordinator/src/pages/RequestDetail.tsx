import { useState } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetRequest, getGetRequestQueryKey, useClassifyRequest,
  useListEmailDrafts, getListEmailDraftsQueryKey, useGenerateEmailDrafts, useUpdateEmailDraft,
  useListNotes, getListNotesQueryKey, useCreateNote,
  useListStatusHistory, getListStatusHistoryQueryKey, useChangeStatus,
  useGenerateCalendarPreview, useCreateMeeting, useUpdateMeeting,
  getConfig
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Edit, AlertCircle, RefreshCw, Plus, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
          <EmailDraftsSection requestId={requestId} />
          <CalendarPreviewSection requestId={requestId} />
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

function EmailDraftsSection({ requestId }: { requestId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: drafts, isLoading } = useListEmailDrafts(requestId, { query: { enabled: !!requestId, queryKey: getListEmailDraftsQueryKey(requestId) } });
  const generateDrafts = useGenerateEmailDrafts();
  const updateDraft = useUpdateEmailDraft();

  const handleGenerate = () => {
    generateDrafts.mutate({ id: requestId, data: {} }, {
      onSuccess: () => {
        toast({ title: "Drafts generated" });
        queryClient.invalidateQueries({ queryKey: getListEmailDraftsQueryKey(requestId) });
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
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generateDrafts.isPending} className="rounded-full">
          <MessageSquare className="w-4 h-4 mr-2" /> Generate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-6">Generated drafts are saved locally for preview and copying. Emails are not sent automatically.</p>
      
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : drafts && drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft: any) => (
            <DraftItem key={draft.id} draft={draft} onSave={(d) => handleSave(draft.id, d)} isSaving={updateDraft.isPending} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic p-4 bg-muted/20 rounded-lg text-center">No drafts generated yet.</div>
      )}
    </div>
  );
}

function DraftItem({ draft, onSave, isSaving }: { draft: any, onSave: (d: any) => void, isSaving: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [to, setTo] = useState(draft.toRecipients || "");
  const [cc, setCc] = useState(draft.ccRecipients || "");
  const [subject, setSubject] = useState(draft.subject || "");
  const [body, setBody] = useState(draft.body || "");

  if (isEditing) {
    return (
      <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
        <div className="flex justify-between items-center mb-2">
          <Badge variant="secondary">{draft.templateType}</Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { onSave({ toRecipients: to, ccRecipients: cc, subject, body }); setIsEditing(false); }} disabled={isSaving} className="rounded-full">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-sm font-medium" />
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
      <div className="flex justify-between items-start mb-2">
        <div className="font-semibold text-sm line-clamp-1">{draft.subject}</div>
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditing(true)}>
          <Edit className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground mb-3 flex gap-2 items-center">
        <Badge variant="outline" className="text-[10px]">{draft.templateType}</Badge>
        <span className="truncate">To: {draft.toRecipients}</span>
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

function CalendarPreviewSection({ requestId }: { requestId: number }) {
  const [meetingType, setMeetingType] = useState("Formal Risk");
  const generatePreview = useGenerateCalendarPreview();
  const [preview, setPreview] = useState<any>(null);

  const handlePreview = () => {
    generatePreview.mutate({ id: requestId, data: { meetingType } }, {
      onSuccess: (data) => setPreview(data),
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Invite Preview</h2>
        <Badge variant="secondary">Preview Only</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-6">See how a calendar invite would look before scheduling. No event will be created.</p>
      
      <div className="flex gap-2 mb-6">
        <Select value={meetingType} onValueChange={setMeetingType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Pre-Risk">Pre-Risk</SelectItem>
            <SelectItem value="Formal Risk">Formal Risk</SelectItem>
            <SelectItem value="Final Risk">Final Risk</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handlePreview} disabled={generatePreview.isPending} className="rounded-full">
          {generatePreview.isPending ? "Loading..." : "Generate"}
        </Button>
      </div>

      {preview && (
        <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-4 animate-in fade-in">
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
  
  const [isOpen, setIsOpen] = useState(false);
  const [meetingType, setMeetingType] = useState("Pre-Risk");
  const [editMeetingId, setEditMeetingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("Scheduled");

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
                <div className="font-bold text-sm text-primary mb-1">{m.meetingType}</div>
                <div className="text-sm font-medium">{m.subject || "No Subject"}</div>
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
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <Badge variant={m.status === "Completed" ? "outline" : "secondary"} className="h-6">{m.status}</Badge>
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
    </div>
  );
}
