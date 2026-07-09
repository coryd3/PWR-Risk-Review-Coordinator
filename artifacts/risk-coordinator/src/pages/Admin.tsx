import { useState } from "react";
import {
  useListRiskTriggers,
  useListRuleSets,
  useListEmailTemplates,
  useUpdateRiskTrigger,
  useUpdateEmailTemplate,
  useUpdateRuleSet,
  useListUsers,
  useUpdateUserRole,
  useCreateUser,
  getListRiskTriggersQueryKey,
  getListEmailTemplatesQueryKey,
  getListRuleSetsQueryKey,
  getListUsersQueryKey,
  UserRole,
  type ManagedUser,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext, ROLE_LABELS, type UserRole as AppUserRole } from "@/lib/auth";
import { EmailNotificationsAdmin } from "@/components/EmailNotificationsAdmin";

const ROLE_OPTIONS: AppUserRole[] = ["admin", "contributor", "viewer", "requester"];

function UsersAndRoles() {
  const { user: currentUser } = useAuthContext();
  const { data: users, isLoading } = useListUsers();
  const updateRole = useUpdateUserRole();
  const createUser = useCreateUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newRole, setNewRole] = useState<AppUserRole>("contributor");

  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleRoleChange = (target: ManagedUser, role: string) => {
    if (role === target.role) return;
    updateRole.mutate(
      { id: target.id, data: { role: role as UserRole } },
      {
        onSuccess: () => {
          refreshUsers();
          toast({ title: "Role updated" });
        },
        onError: () =>
          toast({ title: "Failed to update role", variant: "destructive" }),
      },
    );
  };

  const handleAddUser = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({ title: "Enter an email address", variant: "destructive" });
      return;
    }
    createUser.mutate(
      {
        data: {
          email: trimmedEmail,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          role: newRole as UserRole,
        },
      },
      {
        onSuccess: () => {
          refreshUsers();
          toast({
            title: "User added",
            description: `${trimmedEmail} will get the ${ROLE_LABELS[newRole]} role the first time they sign in.`,
          });
          setEmail("");
          setFirstName("");
          setLastName("");
          setNewRole("contributor");
        },
        onError: (err) => {
          const status = (err as { status?: number })?.status;
          toast({
            title:
              status === 409
                ? "That email is already added"
                : "Failed to add user",
            description:
              status === 409
                ? "Change their role in the list below instead."
                : undefined,
            variant: "destructive",
          });
        },
      },
    );
  };

  const displayName = (u: ManagedUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users &amp; Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="text-sm font-semibold text-foreground">Add a person</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anyone can sign in on their own and starts as a Requester. Add someone
            here to give them an elevated role the moment they first sign in.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="person@burnsmcd.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">First name</Label>
              <Input
                placeholder="Optional"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last name</Label>
              <Input
                placeholder="Optional"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select
                value={newRole}
                onValueChange={(value) => setNewRole(value as AppUserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={handleAddUser} disabled={createUser.isPending}>
              Add user
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-3">
            {users?.map((u) => (
              <div
                key={u.id}
                className="p-3 border rounded-md text-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate flex items-center gap-2">
                    <span className="truncate">{displayName(u)}</span>
                    {currentUser?.id === u.id && (
                      <Badge variant="outline" className="text-[10px]">You</Badge>
                    )}
                    {!u.lastLoginAt && (
                      <Badge variant="secondary" className="text-[10px]">
                        Pending sign-in
                      </Badge>
                    )}
                  </div>
                  {u.email && (
                    <div className="text-muted-foreground text-xs truncate">{u.email}</div>
                  )}
                </div>
                <Select
                  value={u.role}
                  onValueChange={(value) => handleRoleChange(u, value)}
                  disabled={updateRole.isPending}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {users && users.length === 0 && (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
        <p className="text-muted-foreground mt-1">Manage users and roles, and edit risk triggers, email templates, and rule sets.</p>
      </div>

      <UsersAndRoles />

      <EmailNotificationsAdmin />

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
