import {
  useListMeetings,
  getListMeetingsQueryKey,
  useSendMeetingInvite,
  useCancelMeetingInvite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, CalendarX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sendInvite = useSendMeetingInvite();
  const cancelInvite = useCancelMeetingInvite();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });

  const handleSend = (m: any) => {
    const isUpdate = !!m.outlookEventId;
    sendInvite.mutate(
      { id: m.id },
      {
        onSuccess: () => {
          refresh();
          toast({
            title: isUpdate ? "Invite updated" : "Invite sent",
            description: isUpdate
              ? "Attendees will receive the updated meeting details."
              : "Attendees will receive the Outlook calendar invite.",
          });
        },
        onError: (err: any) =>
          toast({
            title: isUpdate ? "Failed to update invite" : "Failed to send invite",
            description: err?.data?.message || err?.message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleCancel = (m: any) => {
    const hadInvite = !!m.outlookEventId;
    if (
      !window.confirm(
        hadInvite
          ? "Cancel this meeting? Attendees will receive an Outlook cancellation."
          : "Cancel this meeting?",
      )
    )
      return;
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
                    <th className="px-4 py-3 font-medium">Invite</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map(meeting => {
                    const canSend = !!meeting.scheduledStart && !!meeting.scheduledEnd;
                    const cancelled = meeting.status === "Cancelled";
                    return (
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
                        <td className="px-4 py-3">
                          {meeting.outlookEventId ? (
                            <Badge variant="secondary">Sent</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not sent</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!cancelled && (
                            <div className="flex justify-end gap-1 flex-wrap">
                              {canSend ? (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleSend(meeting)} disabled={sendInvite.isPending}>
                                  <Send className="w-3.5 h-3.5 mr-1" />
                                  {meeting.outlookEventId ? "Update invite" : "Send invite"}
                                </Button>
                              ) : (
                                <Link href={`/requests/${meeting.requestId}`}>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Schedule</Button>
                                </Link>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleCancel(meeting)} disabled={cancelInvite.isPending}>
                                <CalendarX className="w-3.5 h-3.5 mr-1" /> Cancel
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
