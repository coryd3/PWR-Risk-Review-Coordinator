import { useRoute, Link } from "wouter";
import { useGetRequest, useClassifyRequest, getGetRequestQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Edit, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function RequestDetail() {
  const [, params] = useRoute("/requests/:id");
  const requestId = params?.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: request, isLoading, isError } = useGetRequest(requestId, {
    query: { enabled: !!requestId, queryKey: getGetRequestQueryKey(requestId) }
  });

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

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/">
          <div className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </div>
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{request.projectName || "Unnamed Project"}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={request.status === "Completed" ? "outline" : "default"}>{request.status}</Badge>
              {request.isMajorOpportunity && <Badge variant="destructive">MAJOR OPPORTUNITY</Badge>}
              <span className="text-muted-foreground text-sm">{request.crmOpportunityNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClassify} disabled={classifyRequest.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${classifyRequest.isPending ? "animate-spin" : ""}`} />
              Re-Classify
            </Button>
            <Link href={`/requests/${requestId}/edit`}>
              <Button size="sm">
                <Edit className="w-4 h-4 mr-2" /> Edit Request
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {request.warnings && request.warnings.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-2 text-sm text-orange-800 dark:text-orange-300">
          <div className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Validation Warnings
          </div>
          <ul className="list-disc list-inside pl-6">
            {request.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Opportunity Details</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Client</div>
                <div className="font-medium">{request.clientName || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Type</div>
                <div className="font-medium">{request.requestType || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">BMCD Contract Value</div>
                <div className="font-medium">{request.bmcdContractValueRaw || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Total Installed Cost</div>
                <div className="font-medium">{request.totalInstalledCostRaw || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Business Line Class</div>
                <div className="font-medium">{request.businessLineClassification || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Created At</div>
                <div className="font-medium">{request.createdAt ? format(new Date(request.createdAt), "PPP") : "—"}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Selected Risk Triggers</h2>
            {request.triggers && request.triggers.length > 0 ? (
              <ul className="space-y-3">
                {request.triggers.map(t => (
                  <li key={t.id} className="text-sm">
                    <span className="font-semibold text-primary mr-2">Trigger {t.triggerNumber}:</span>
                    <span>{t.triggerName}</span>
                    {t.isMajorOpportunityTrigger && <Badge variant="destructive" className="ml-2 text-[10px] py-0">MAJOR</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground text-sm italic">No risk triggers selected.</div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Meetings</h2>
            {request.meetings && request.meetings.length > 0 ? (
              <div className="space-y-4">
                {request.meetings.map(m => (
                  <div key={m.id} className="border border-border rounded-md p-4 flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-primary">{m.meetingType}</div>
                      <div className="text-sm mt-1">{m.subject || "No Subject"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Status: {m.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">No meetings scheduled.</div>
            )}
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Status Workflow</h2>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Status</div>
                <div className="font-medium">{request.status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Next Action</div>
                <div className="font-medium">{request.nextAction || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}