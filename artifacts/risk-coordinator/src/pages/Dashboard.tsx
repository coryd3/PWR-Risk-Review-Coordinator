import { useListRequests, useGetDashboardSummary } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: requests, isLoading: loadingRequests } = useListRequests();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your risk review pipeline.</p>
        </div>
        <Link href="/requests/new">
          <div className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer shadow-sm">
            New Request
          </div>
        </Link>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard title="New Requests" value={summary.newRequests} />
          <SummaryCard title="Ready to Schedule" value={summary.readyToSchedule} />
          <SummaryCard title="Scheduled" value={summary.preRiskScheduled + summary.formalRiskScheduled + summary.finalRiskScheduled} />
          <SummaryCard title="Missing Info" value={summary.missingInfo} variant="warning" />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Active Requests</CardTitle>
          <CardDescription>All current risk review requests across the organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : requests && requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id} className="border-b border-border hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/requests/${req.id}`}>
                          <div className="text-primary hover:underline cursor-pointer group-hover:text-primary/80">
                            {req.projectName || "Unnamed Project"}
                          </div>
                        </Link>
                        {req.crmOpportunityNumber && (
                          <div className="text-xs text-muted-foreground mt-0.5">{req.crmOpportunityNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{req.clientName || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={req.status === "New" ? "default" : req.status === "Completed" ? "outline" : "secondary"}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{req.requestType || "—"}</span>
                          {req.isMajorOpportunity && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">MAJOR</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {req.createdAt ? format(new Date(req.createdAt), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="text-center py-12 text-muted-foreground">
               No active requests found.
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, variant = "default" }: { title: string, value: number, variant?: "default" | "warning" }) {
  return (
    <Card className={`overflow-hidden ${variant === "warning" && value > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}`}>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">{title}</div>
        <div className={`text-4xl font-bold ${variant === "warning" && value > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
