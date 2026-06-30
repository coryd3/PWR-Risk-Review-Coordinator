import { useLocation } from "wouter";
import { useGetConfig, useListRiskTriggers, useCreateRequest, useUpdateRequest, getGetRequestQueryKey, getListRequestsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const attendeeSchema = z.object({
  role: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

const formSchema = z.object({
  requesterName: z.string().optional(),
  requesterEmail: z.string().email().optional().or(z.literal("")),
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
  preRiskTargetDate: z.string().optional(),
  formalRiskTargetDate: z.string().optional(),
  formalRiskDiscussionDate: z.string().optional(),
  finalRiskTargetDate: z.string().optional(),
  proposalDueDate: z.string().optional(),
  preRiskLead: z.string().optional(),
  formalRiskLead: z.string().optional(),
  status: z.string().optional(),
  nextAction: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  triggerIds: z.array(z.number()).optional(),
  attendees: z.array(attendeeSchema).optional(),
});

type RequestFormValues = z.infer<typeof formSchema>;

interface RequestFormProps {
  initialData?: any;
  isEdit?: boolean;
}

function toDateInput(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
      preRiskTargetDate: toDateInput(initialData?.preRiskTargetDate),
      formalRiskTargetDate: toDateInput(initialData?.formalRiskTargetDate),
      formalRiskDiscussionDate: toDateInput(initialData?.formalRiskDiscussionDate),
      finalRiskTargetDate: toDateInput(initialData?.finalRiskTargetDate),
      proposalDueDate: toDateInput(initialData?.proposalDueDate),
      preRiskLead: initialData?.preRiskLead || "",
      formalRiskLead: initialData?.formalRiskLead || "",
      status: initialData?.status || "New",
      nextAction: initialData?.nextAction || "",
      owner: initialData?.owner || "",
      notes: initialData?.notes || "",
      triggerIds: initialData?.triggers?.map((t: any) => t.id) || [],
      attendees: (initialData?.attendees || []).map((a: any) => ({
        role: a.role || "",
        name: a.name || "",
        email: a.email || "",
      })),
    },
  });

  const { fields: attendeeFields, append: appendAttendee, remove: removeAttendee } = useFieldArray({
    control: form.control,
    name: "attendees",
  });

  if (loadingConfig || loadingTriggers) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const roleOptions = config?.attendeeRoles ?? [];

  const onSubmit = (values: RequestFormValues) => {
    const clean = <T,>(v: T) => (v === "" ? undefined : v);
    const data = {
      ...values,
      requesterEmail: clean(values.requesterEmail),
      preRiskTargetDate: clean(values.preRiskTargetDate),
      formalRiskTargetDate: clean(values.formalRiskTargetDate),
      formalRiskDiscussionDate: clean(values.formalRiskDiscussionDate),
      finalRiskTargetDate: clean(values.finalRiskTargetDate),
      proposalDueDate: clean(values.proposalDueDate),
      requestType: clean(values.requestType),
      riskIdentificationStatus: clean(values.riskIdentificationStatus),
      attendees: (values.attendees || [])
        .filter((a) => a.role && (a.name || a.email))
        .map((a) => ({ role: a.role, name: a.name || undefined, email: a.email || undefined })),
    };

    if (isEdit && initialData) {
      updateRequest.mutate(
        { id: initialData.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(initialData.id) });
            queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            toast({ title: "Request updated" });
            setLocation(`/requests/${initialData.id}`);
          },
          onError: () => toast({ title: "Failed to update request", variant: "destructive" }),
        },
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
        },
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 bg-card p-6 rounded-lg border border-border shadow-sm">
        <section className="space-y-4">
          <h3 className="font-medium text-lg">Project Information</h3>
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
              <FormItem><FormLabel>Requester Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="crmOpportunityNumber" render={({ field }) => (
              <FormItem><FormLabel>CRM Opportunity #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="contractReviewRvwNumber" render={({ field }) => (
              <FormItem><FormLabel>Contract Review RVW #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="requestType" render={({ field }) => (
              <FormItem>
                <FormLabel>Request Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {config?.requestTypes.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="riskIdentificationStatus" render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Identification Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {config?.riskIdentificationStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-lg">Contract Values</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="bmcdContractValueRaw" render={({ field }) => (
              <FormItem><FormLabel>BMCD Contract Value</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="totalInstalledCostRaw" render={({ field }) => (
              <FormItem><FormLabel>Total Installed Cost</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="isEpcPrime" render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal cursor-pointer">EPC Prime (Burns &amp; McDonnell is the prime contractor)</FormLabel>
            </FormItem>
          )} />
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-lg">Business Lines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {config?.businessLines.map((bl) => (
              <FormField
                key={bl}
                control={form.control}
                name="businessLines"
                render={({ field }) => {
                  const checked = field.value?.includes(bl);
                  return (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            c
                              ? field.onChange([...(field.value || []), bl])
                              : field.onChange((field.value || []).filter((v) => v !== bl))
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">{bl}</FormLabel>
                    </FormItem>
                  );
                }}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-lg">Scheduling Targets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="proposalDueDate" render={({ field }) => (
              <FormItem><FormLabel>Proposal Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="preRiskTargetDate" render={({ field }) => (
              <FormItem><FormLabel>Pre-Risk Target Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="formalRiskTargetDate" render={({ field }) => (
              <FormItem><FormLabel>Formal Risk Target Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="formalRiskDiscussionDate" render={({ field }) => (
              <FormItem><FormLabel>Formal Risk Discussion Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="finalRiskTargetDate" render={({ field }) => (
              <FormItem><FormLabel>Final Risk Target Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="preRiskLead" render={({ field }) => (
              <FormItem><FormLabel>Pre-Risk Lead</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="formalRiskLead" render={({ field }) => (
              <FormItem><FormLabel>Formal Risk Lead</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-lg">Risk Triggers</h3>
          <div className="grid grid-cols-1 gap-2">
            {triggers?.map((trigger) => (
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
                          onCheckedChange={(checked) =>
                            checked
                              ? field.onChange([...(field.value || []), trigger.id])
                              : field.onChange((field.value || []).filter((val) => val !== trigger.id))
                          }
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
        </section>

        <section className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-lg">Attendees by Role</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => appendAttendee({ role: roleOptions[0] ?? "", name: "", email: "" })}>
              <Plus className="w-4 h-4 mr-1" /> Add Attendee
            </Button>
          </div>
          {attendeeFields.length === 0 && (
            <p className="text-sm text-muted-foreground">No attendees added yet.</p>
          )}
          <div className="space-y-3">
            {attendeeFields.map((af, index) => (
              <div key={af.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_auto] gap-3 items-end rounded-md border p-3">
                <FormField control={form.control} name={`attendees.${index}.role`} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`attendees.${index}.name`} render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`attendees.${index}.email`} render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeAttendee(index)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="font-medium text-lg">Notes</h3>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormControl><Textarea rows={4} {...field} /></FormControl></FormItem>
          )} />
        </section>

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
