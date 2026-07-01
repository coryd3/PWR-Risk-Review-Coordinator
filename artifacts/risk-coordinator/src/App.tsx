import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import NewRequest from "@/pages/NewRequest";
import RequestDetail from "@/pages/RequestDetail";
import EditRequest from "@/pages/EditRequest";
import Meetings from "@/pages/Meetings";
import Admin from "@/pages/Admin";
import Impact from "@/pages/Impact";
import Import from "@/pages/Import";
import { Layout } from "@/components/Layout";
import { AuthProvider, useAuthContext } from "@/lib/auth";
import logoUrl from "@/assets/brand/logo-bmcd-white.svg";

const queryClient = new QueryClient();

function Router() {
  const { can } = useAuthContext();
  const canView = can("view");

  return (
    <Layout>
      <Switch>
        {canView && <Route path="/" component={Dashboard} />}
        {!canView && can("createRequest") && (
          <Route path="/">{() => <Redirect to="/requests/new" />}</Route>
        )}
        {can("createRequest") && <Route path="/requests/new" component={NewRequest} />}
        {can("contribute") && <Route path="/requests/:id/edit" component={EditRequest} />}
        {canView && <Route path="/requests/:id" component={RequestDetail} />}
        {canView && <Route path="/meetings" component={Meetings} />}
        {can("admin") && <Route path="/impact" component={Impact} />}
        {can("admin") && <Route path="/import" component={Import} />}
        {can("admin") && <Route path="/admin" component={Admin} />}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function LoginScreen() {
  const { login } = useAuthContext();
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-sidebar p-6">
      <div className="w-full max-w-md rounded-2xl border border-sidebar-border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-6 text-center">
          <img src={logoUrl} alt="Burns & McDonnell" className="w-40 h-auto rounded-md bg-sidebar p-3" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              PWR Risk Review Coordinator
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in to continue. Access is granted based on your assigned role.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={login}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuthContext();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthGate>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
