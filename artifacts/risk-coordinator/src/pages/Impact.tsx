import { useGetUsageSummary, useListUsageEvents } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, DollarSign, Activity } from "lucide-react";
import { format } from "date-fns";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const hoursFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export default function Impact() {
  const { data: summary, isLoading: loadingSummary } = useGetUsageSummary();
  const { data: events, isLoading: loadingEvents } = useListUsageEvents({ limit: 25 });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Impact</h1>
        <p className="text-muted-foreground mt-1">
          Time and cost saved versus manual effort, tracked across the tool.
        </p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Hours Saved"
            value={hoursFmt.format(summary.totalHoursSaved)}
            icon={Clock}
          />
          <MetricCard
            title="Dollars Saved"
            value={currency.format(summary.totalDollarsSaved)}
            subtitle={`Based on ${currency.format(summary.rate)}/hr burdened labor`}
            icon={DollarSign}
          />
          <MetricCard
            title="Actions Tracked"
            value={summary.totalEvents.toLocaleString()}
            icon={Activity}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Savings by Action</CardTitle>
          <CardDescription>Where the tool is delivering the most value.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : summary && summary.byAction.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium text-right">Count</th>
                    <th className="px-4 py-3 font-medium text-right">Units</th>
                    <th className="px-4 py-3 font-medium text-right">Hours Saved</th>
                    <th className="px-4 py-3 font-medium text-right">Dollars Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byAction.map((row) => (
                    <tr key={row.action} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.usageUnits.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{hoursFmt.format(row.hoursSaved)}</td>
                      <td className="px-4 py-3 text-right font-medium">{currency.format(row.dollarsSaved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No usage recorded yet. Impact will appear here as the tool is used.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>The latest tracked actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingEvents ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium text-right">Minutes Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {ev.createdAt ? format(new Date(ev.createdAt), "MMM d, yyyy h:mm a") : "—"}
                      </td>
                      <td className="px-4 py-3">{ev.usage}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.username || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.source}</td>
                      <td className="px-4 py-3 text-right">{ev.minutesSaved.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No activity yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-2">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
