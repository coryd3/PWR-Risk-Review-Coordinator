import { useState } from "react";
import {
  useListRiskTriggers,
  useListRuleSets,
  useListEmailTemplates,
  useUpdateRiskTrigger,
  useUpdateEmailTemplate,
  useUpdateRuleSet,
  getListRiskTriggersQueryKey,
  getListEmailTemplatesQueryKey,
  getListRuleSetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const { data: triggers, isLoading: loadingTriggers } = useListRiskTriggers();
  const { data: templates, isLoading: loadingTemplates } = useListEmailTemplates();
  const { data: rules, isLoading: loadingRules } = useListRuleSets();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTrigger = useUpdateRiskTrigger();
  const updateTemplate = useUpdateEmailTemplate();
  const updateRule = useUpdateRuleSet();

  const [editTrigger, setEditTrigger] = useState<any | null>(null);
  const [editTemplate, setEditTemplate] = useState<any | null>(null);
  const [editRule, setEditRule] = useState<any | null>(null);

  const invalidate = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Configuration</h1>
        <p className="text-muted-foreground mt-1">View and edit risk triggers, email templates, and rule sets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Risk Triggers</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTriggers ? <Skeleton className="h-64" /> : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {triggers?.map((t) => (
                  <div key={t.id} className="p-3 border rounded-md text-sm flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <span>Trigger {t.triggerNumber}</span>
                        {t.isMajorOpportunityTrigger && <Badge variant="destructive" className="text-[10px]">MAJOR</Badge>}
                        {!t.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      <div className="mt-1 text-foreground">{t.triggerName}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditTrigger({ ...t })}>Edit</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? <Skeleton className="h-32" /> : (
                <div className="space-y-3">
                  {templates?.map((t) => (
                    <div key={t.id} className="p-3 border rounded-md text-sm flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-primary flex items-center gap-2">
                          {t.templateName}
                          {!t.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">Subject: {t.subjectTemplate}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditTemplate({ ...t })}>Edit</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rule Sets</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRules ? <Skeleton className="h-32" /> : (
                <div className="space-y-3">
                  {rules?.map((r) => (
                    <div key={r.id} className="p-3 border rounded-md text-sm flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">Priority: {r.priority} | Active: {r.active ? "Yes" : "No"}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditRule({ ...r })}>Edit</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Risk Trigger */}
      <Dialog open={!!editTrigger} onOpenChange={(o) => !o && setEditTrigger(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Risk Trigger</DialogTitle></DialogHeader>
          {editTrigger && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trigger Name</Label>
                <Input value={editTrigger.triggerName ?? ""} onChange={(e) => setEditTrigger({ ...editTrigger, triggerName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editTrigger.triggerDescription ?? ""} onChange={(e) => setEditTrigger({ ...editTrigger, triggerDescription: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Major Opportunity Trigger</Label>
                <Switch checked={!!editTrigger.isMajorOpportunityTrigger} onCheckedChange={(c) => setEditTrigger({ ...editTrigger, isMajorOpportunityTrigger: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={!!editTrigger.active} onCheckedChange={(c) => setEditTrigger({ ...editTrigger, active: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTrigger(null)}>Cancel</Button>
            <Button
              disabled={updateTrigger.isPending}
              onClick={() => {
                updateTrigger.mutate({
                  id: editTrigger.id,
                  data: {
                    triggerName: editTrigger.triggerName,
                    triggerDescription: editTrigger.triggerDescription || null,
                    isMajorOpportunityTrigger: editTrigger.isMajorOpportunityTrigger,
                    active: editTrigger.active,
                  },
                }, {
                  onSuccess: () => { invalidate(getListRiskTriggersQueryKey()); toast({ title: "Risk trigger updated" }); setEditTrigger(null); },
                  onError: () => toast({ title: "Failed to update trigger", variant: "destructive" }),
                });
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Template */}
      <Dialog open={!!editTemplate} onOpenChange={(o) => !o && setEditTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Email Template</DialogTitle></DialogHeader>
          {editTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={editTemplate.templateName ?? ""} onChange={(e) => setEditTemplate({ ...editTemplate, templateName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={editTemplate.subjectTemplate ?? ""} onChange={(e) => setEditTemplate({ ...editTemplate, subjectTemplate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea rows={8} value={editTemplate.bodyTemplate ?? ""} onChange={(e) => setEditTemplate({ ...editTemplate, bodyTemplate: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={!!editTemplate.active} onCheckedChange={(c) => setEditTemplate({ ...editTemplate, active: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancel</Button>
            <Button
              disabled={updateTemplate.isPending}
              onClick={() => {
                updateTemplate.mutate({
                  id: editTemplate.id,
                  data: {
                    templateName: editTemplate.templateName,
                    subjectTemplate: editTemplate.subjectTemplate,
                    bodyTemplate: editTemplate.bodyTemplate,
                    active: editTemplate.active,
                  },
                }, {
                  onSuccess: () => { invalidate(getListEmailTemplatesQueryKey()); toast({ title: "Email template updated" }); setEditTemplate(null); },
                  onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
                });
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Set */}
      <Dialog open={!!editRule} onOpenChange={(o) => !o && setEditRule(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Rule Set</DialogTitle></DialogHeader>
          {editRule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editRule.name ?? ""} onChange={(e) => setEditRule({ ...editRule, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={editRule.priority ?? 0} onChange={(e) => setEditRule({ ...editRule, priority: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={!!editRule.active} onCheckedChange={(c) => setEditRule({ ...editRule, active: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRule(null)}>Cancel</Button>
            <Button
              disabled={updateRule.isPending}
              onClick={() => {
                updateRule.mutate({
                  id: editRule.id,
                  data: { name: editRule.name, priority: editRule.priority, active: editRule.active },
                }, {
                  onSuccess: () => { invalidate(getListRuleSetsQueryKey()); toast({ title: "Rule set updated" }); setEditRule(null); },
                  onError: () => toast({ title: "Failed to update rule set", variant: "destructive" }),
                });
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
