import { useListMeetings } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meetings</h1>
        <p className="text-muted-foreground mt-1">All scheduled risk review meetings across active requests.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming & Past Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : meetings && meetings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Scheduled Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map(meeting => (
                    <tr key={meeting.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-primary">{meeting.meetingType}</td>
                      <td className="px-4 py-3">
                        <Link href={`/requests/${meeting.requestId}`}>
                           <span className="hover:underline cursor-pointer font-medium">{meeting.projectName || "Unknown Project"}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {meeting.scheduledStart ? format(new Date(meeting.scheduledStart), "MMM d, yyyy h:mm a") : (meeting.targetDate ? `Target: ${format(new Date(meeting.targetDate), "MMM d, yyyy")}` : "Unscheduled")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{meeting.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No meetings found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}