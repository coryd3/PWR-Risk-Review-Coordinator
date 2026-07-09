import { useEffect, useState } from "react";
import {
  useGetEmailSettings,
  useUpdateEmailSettings,
  useListNotificationSubscribers,
  useCreateNotificationSubscriber,
  useUpdateNotificationSubscriber,
  useDeleteNotificationSubscriber,
  getGetEmailSettingsQueryKey,
  getListNotificationSubscribersQueryKey,
  type NotificationSubscriber,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export function EmailNotificationsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useGetEmailSettings();
  const { data: subscribers, isLoading: loadingSubs } =
    useListNotificationSubscribers();

  const updateSettings = useUpdateEmailSettings();
  const createSub = useCreateNotificationSubscriber();
  const updateSub = useUpdateNotificationSubscriber();
  const deleteSub = useDeleteNotificationSubscriber();

  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setTenantId(settings.tenantId ?? "");
      setClientId(settings.clientId ?? "");
      setSenderAddress(settings.senderAddress ?? "");
      setClientSecret("");
    }
  }, [settings]);

  const refreshSettings = () =>
    queryClient.invalidateQueries({ queryKey: getGetEmailSettingsQueryKey() });
  const refreshSubs = () =>
    queryClient.invalidateQueries({
      queryKey: getListNotificationSubscribersQueryKey(),
    });

  const handleSaveSettings = () => {
    updateSettings.mutate(
      {
        data: {
          enabled,
          tenantId: tenantId.trim() || null,
          clientId: clientId.trim() || null,
          senderAddress: senderAddress.trim() || null,
          // Only send the secret if the admin typed a new one; otherwise the
          // stored secret is left untouched.
          ...(clientSecret.trim() !== ""
            ? { clientSecret: clientSecret.trim() }
            : {}),
        },
      },
      {
        onSuccess: () => {
          refreshSettings();
          setClientSecret("");
          toast({ title: "Email settings saved" });
        },
        onError: () =>
          toast({ title: "Failed to save email settings", variant: "destructive" }),
      },
    );
  };

  const handleAddSubscriber = () => {
    const email = newEmail.trim();
    if (!email) {
      toast({ title: "Enter an email address", variant: "destructive" });
      return;
    }
    createSub.mutate(
      { data: { email, name: newName.trim() || null } },
      {
        onSuccess: () => {
          refreshSubs();
          setNewEmail("");
          setNewName("");
          toast({ title: "Subscriber added" });
        },
        onError: () =>
          toast({ title: "Failed to add subscriber", variant: "destructive" }),
      },
    );
  };

  const handleToggleSubscriber = (sub: NotificationSubscriber, active: boolean) => {
    updateSub.mutate(
      { id: sub.id, data: { active } },
      {
        onSuccess: () => refreshSubs(),
        onError: () =>
          toast({ title: "Failed to update subscriber", variant: "destructive" }),
      },
    );
  };

  const handleDeleteSubscriber = (sub: NotificationSubscriber) => {
    deleteSub.mutate(
      { id: sub.id },
      {
        onSuccess: () => {
          refreshSubs();
          toast({ title: "Subscriber removed" });
        },
        onError: () =>
          toast({ title: "Failed to remove subscriber", variant: "destructive" }),
      },
    );
  };

  const configured =
    !!settings &&
    !!settings.tenantId &&
    !!settings.clientId &&
    settings.clientSecretSet &&
    !!settings.senderAddress;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email Notifications
          {settings?.enabled && configured ? (
            <Badge className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not sending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          When configured, an email is sent to the subscriber list every time a
          new risk review request is submitted. Uses a Microsoft Graph app
          registration (service principal) — enter the credentials from your
          Azure tenant. Notifications never block request submission.
        </p>

        {loadingSettings ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="rounded-md border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Sending enabled
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Turn off to pause all notification emails without losing the
                  configuration.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tenant ID</Label>
                <Input
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client ID (Application ID)</Label>
                <Input
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  placeholder={
                    settings?.clientSecretSet
                      ? "Secret is set — enter a new value to replace it"
                      : "Enter client secret"
                  }
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sender Mailbox</Label>
                <Input
                  type="email"
                  placeholder="riskreview@burnsmcd.com"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                Save settings
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="text-sm font-semibold text-foreground">Subscribers</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            People who receive an email when a new request is submitted.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="person@burnsmcd.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="Optional"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddSubscriber}
                disabled={createSub.isPending}
                variant="outline"
              >
                Add subscriber
              </Button>
            </div>
          </div>

          {loadingSubs ? (
            <Skeleton className="h-24 mt-4" />
          ) : (
            <div className="mt-4 space-y-2">
              {subscribers?.map((s) => (
                <div
                  key={s.id}
                  className="p-3 border rounded-md text-sm flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {s.name || s.email}
                    </div>
                    {s.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {s.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {s.active ? "Active" : "Paused"}
                      </span>
                      <Switch
                        checked={s.active}
                        onCheckedChange={(c) => handleToggleSubscriber(s, c)}
                        disabled={updateSub.isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSubscriber(s)}
                      disabled={deleteSub.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {subscribers && subscribers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No subscribers yet. Add at least one to receive notifications.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
