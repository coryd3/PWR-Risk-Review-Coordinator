import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import NewRequest from "@/pages/NewRequest";
import RequestDetail from "@/pages/RequestDetail";
import EditRequest from "@/pages/EditRequest";
import Meetings from "@/pages/Meetings";
import Admin from "@/pages/Admin";
import { Layout } from "@/components/Layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/requests/new" component={NewRequest} />
        <Route path="/requests/:id" component={RequestDetail} />
        <Route path="/requests/:id/edit" component={EditRequest} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;