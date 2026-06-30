import { useMemo, useState } from "react";
import { useListRequests, useGetDashboardSummary, useGetConfig } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

type SortKey = "projectName" | "clientName" | "status" | "requestType" | "createdAt";

const ALL = "__all__";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: requests, isLoading: loadingRequests } = useListRequests();
  const { data: config } = useGetConfig();

  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let rows = requests ? [...requests] : [];
    if (statusFilter !== ALL) rows = rows.filter((r) => r.status === statusFilter);
    if (typeFilter !== ALL) rows = rows.filter((r) => r.requestType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.projectName, r.clientName, r.crmOpportunityNumber]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    rows.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [requests, statusFilter, typeFilter, search, sortKey, sortDir]);

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <SummaryCard title="New" value={summary.newRequests} />
          <SummaryCard title="Ready to Schedule" value={summary.readyToSchedule} />
          <SummaryCard title="Pre-Risk Scheduled" value={summary.preRiskScheduled} />
          <SummaryCard title="Formal Risk Scheduled" value={summary.formalRiskScheduled} />
          <SummaryCard title="Final Risk Scheduled" value={summary.finalRiskScheduled} />
          <SummaryCard title="Missing Info" value={summary.missingInfo} variant="warning" />
          <SummaryCard title="Completed" value={summary.completed} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Active Requests</CardTitle>
          <CardDescription>All current risk review requests across the organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input
              placeholder="Search project, client, or CRM #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                {config?.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Types</SelectItem>
                {config?.requestTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loadingRequests ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <SortableTh label="Project" col="projectName" sortKey={sortKey} onSort={toggleSort} />
                    <SortableTh label="Client" col="clientName" sortKey={sortKey} onSort={toggleSort} />
                    <SortableTh label="Status" col="status" sortKey={sortKey} onSort={toggleSort} />
                    <SortableTh label="Type" col="requestType" sortKey={sortKey} onSort={toggleSort} />
                    <SortableTh label="Created" col="createdAt" sortKey={sortKey} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req) => (
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
                        <Badge variant={req.status === "New" ? "default" : req.status === "Final Risk Complete" ? "outline" : "secondary"}>
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
            <div className="text-center py-12 text-muted-foreground">No matching requests found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SortableTh({ label, col, sortKey, onSort }: { label: string; col: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button type="button" onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === col ? "text-primary" : "opacity-40"}`} />
      </button>
    </th>
  );
}

function SummaryCard({ title, value, variant = "default" }: { title: string; value: number; variant?: "default" | "warning" }) {
  return (
    <Card className={`overflow-hidden ${variant === "warning" && value > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}`}>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">{title}</div>
        <div className={`text-3xl font-bold ${variant === "warning" && value > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
