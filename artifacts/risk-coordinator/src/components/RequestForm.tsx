import { useLocation } from "wouter";
import { useGetConfig, useListRiskTriggers, useCreateRequest, useUpdateRequest, getGetRequestQueryKey, getListRequestsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  requesterName: z.string().optional(),
  requesterEmail: z.string().email().optional().or(z.literal('')),
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  crmOpportunityNumber: z.string().optional(),
  bmcdContractValueRaw: z.string().optional(),
  totalInstalledCostRaw: z.string().optional(),
  businessLines: z.array(z.string()).optional(),
  contractReviewRvwNumber: z.string().optional(),
  isEpcPrime: z.boolean().optional(),
  requestType: z.string().optional(),
  riskIdentificationStatus: z.string().optional(),
  status: z.string().optional(),
  nextAction: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  triggerIds: z.array(z.number()).optional(),
});

type RequestFormValues = z.infer<typeof formSchema>;

interface RequestFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function RequestForm({ initialData, isEdit }: RequestFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading: loadingConfig } = useGetConfig();
  const { data: triggers, isLoading: loadingTriggers } = useListRiskTriggers();

  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requesterName: initialData?.requesterName || "",
      requesterEmail: initialData?.requesterEmail || "",
      clientName: initialData?.clientName || "",
      projectName: initialData?.projectName || "",
      crmOpportunityNumber: initialData?.crmOpportunityNumber || "",
      bmcdContractValueRaw: initialData?.bmcdContractValueRaw || "",
      totalInstalledCostRaw: initialData?.totalInstalledCostRaw || "",
      businessLines: initialData?.businessLines || [],
      contractReviewRvwNumber: initialData?.contractReviewRvwNumber || "",
      isEpcPrime: initialData?.isEpcPrime || false,
      requestType: initialData?.requestType || "",
      riskIdentificationStatus: initialData?.riskIdentificationStatus || "",
      status: initialData?.status || "New",
      nextAction: initialData?.nextAction || "",
      owner: initialData?.owner || "",
      notes: initialData?.notes || "",
      triggerIds: initialData?.triggers?.map((t: any) => t.id) || [],
    },
  });

  if (loadingConfig || loadingTriggers) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const onSubmit = (data: RequestFormValues) => {
    if (isEdit && initialData) {
      updateRequest.mutate(
        { id: initialData.id, data },
        {
          onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(initialData.id) });
            queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            toast({ title: "Request updated" });
            setLocation(`/requests/${initialData.id}`);
          },
          onError: () => toast({ title: "Failed to update request", variant: "destructive" }),
        }
      );
    } else {
      createRequest.mutate(
        { data },
        {
          onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            toast({ title: "Request created" });
            setLocation(`/requests/${res.id}`);
          },
          onError: () => toast({ title: "Failed to create request", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="projectName" render={({ field }) => (
            <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="clientName" render={({ field }) => (
            <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="requesterName" render={({ field }) => (
            <FormItem><FormLabel>Requester Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="requesterEmail" render={({ field }) => (
            <FormItem><FormLabel>Requester Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="crmOpportunityNumber" render={({ field }) => (
            <FormItem><FormLabel>CRM Opportunity #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          
          <FormField control={form.control} name="requestType" render={({ field }) => (
            <FormItem>
              <FormLabel>Request Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {config?.requestTypes.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )} />

          <FormField control={form.control} name="bmcdContractValueRaw" render={({ field }) => (
            <FormItem><FormLabel>BMCD Contract Value</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          
          <FormField control={form.control} name="totalInstalledCostRaw" render={({ field }) => (
            <FormItem><FormLabel>Total Installed Cost</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="font-medium text-lg">Risk Triggers</h3>
          <div className="grid grid-cols-1 gap-2">
            {triggers?.map(trigger => (
              <FormField
                key={trigger.id}
                control={form.control}
                name="triggerIds"
                render={({ field }) => {
                  const isChecked = field.value?.includes(trigger.id);
                  return (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...(field.value || []), trigger.id])
                              : field.onChange((field.value || []).filter((val) => val !== trigger.id));
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal cursor-pointer">
                          <span className="font-semibold mr-2">{trigger.triggerNumber}.</span>
                          {trigger.triggerName}
                        </FormLabel>
                      </div>
                    </FormItem>
                  );
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setLocation(isEdit && initialData ? `/requests/${initialData.id}` : "/")}>
            Cancel
          </Button>
          <Button type="submit" disabled={createRequest.isPending || updateRequest.isPending}>
            {isEdit ? "Save Changes" : "Create Request"}
          </Button>
        </div>
      </form>
    </Form>
  );
}