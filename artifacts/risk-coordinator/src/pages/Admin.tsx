import { useListRiskTriggers, useListRuleSets, useListEmailTemplates, useGetConfig } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { data: triggers, isLoading: loadingTriggers } = useListRiskTriggers();
  const { data: templates, isLoading: loadingTemplates } = useListEmailTemplates();
  const { data: rules, isLoading: loadingRules } = useListRuleSets();
  const { data: config, isLoading: loadingConfig } = useGetConfig();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Configuration</h1>
        <p className="text-muted-foreground mt-1">System configuration, risk triggers, templates, and rulesets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Risk Triggers</CardTitle>
          </CardHeader>
          <CardContent>
             {loadingTriggers ? <Skeleton className="h-64" /> : (
               <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4">
                 {triggers?.map(t => (
                   <div key={t.id} className="p-3 border rounded-md text-sm">
                     <div className="font-semibold flex items-center justify-between">
                       <span>Trigger {t.triggerNumber}</span>
                       {t.isMajorOpportunityTrigger && <Badge variant="destructive" className="text-[10px]">MAJOR</Badge>}
                     </div>
                     <div className="mt-1 text-foreground">{t.triggerName}</div>
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
                  {templates?.map(t => (
                    <div key={t.id} className="p-3 border rounded-md text-sm">
                      <div className="font-semibold text-primary">{t.templateName}</div>
                      <div className="text-muted-foreground mt-1 text-xs">Subject: {t.subjectTemplate}</div>
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
                  {rules?.map(r => (
                    <div key={r.id} className="p-3 border rounded-md text-sm">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Priority: {r.priority} | Active: {r.active ? "Yes" : "No"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}