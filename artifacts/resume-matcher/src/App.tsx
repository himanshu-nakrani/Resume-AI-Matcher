import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Analysis } from "@/pages/analysis";
import { History } from "@/pages/history";
import { Stats } from "@/pages/stats";
import { SharedAnalysis } from "@/pages/shared";
import { Compare } from "@/pages/compare";

const queryClient = new QueryClient();

const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function Router() {
  return (
    <Switch>
      <Route path="/share/:token" component={SharedAnalysis} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/analysis/:id" component={Analysis} />
            <Route path="/history" component={History} />
            <Route path="/stats" component={Stats} />
            <Route path="/compare" component={Compare} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
