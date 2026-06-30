import { useRoute, Link } from "wouter";
import { useGetRequest } from "@workspace/api-client-react";
import { RequestForm } from "@/components/RequestForm";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditRequest() {
  const [, params] = useRoute("/requests/:id/edit");
  const requestId = params?.id ? parseInt(params.id) : 0;
  
  const { data: request, isLoading, isError } = useGetRequest(requestId, {
    query: { enabled: !!requestId, queryKey: ['getRequest', requestId] }
  });

  if (isLoading) {
    return <div className="p-8 max-w-4xl mx-auto space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (isError || !request) {
    return <div className="p-8 max-w-4xl mx-auto text-destructive">Failed to load request or not found.</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href={`/requests/${requestId}`}>
          <div className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Request
          </div>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Request</h1>
        <p className="text-muted-foreground mt-1">{request.projectName || "Unnamed Project"}</p>
      </div>

      <RequestForm initialData={request} isEdit />
    </div>
  );
}