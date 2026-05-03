import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Board } from "@/pages/board";
import { Analysis } from "@/pages/analysis";
import { History } from "@/pages/history";
import { Stats } from "@/pages/stats";
import { Brand } from "@/pages/brand";
import { SharedAnalysis } from "@/pages/shared";
import { Compare } from "@/pages/compare";
import { Skills } from "@/pages/skills";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function Router() {
  return (
    <Switch>
      <Route path="/share/:token" component={SharedAnalysis} />
      <Route>
        <Layout>
          <ErrorBoundary>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/board" component={Board} />
              <Route path="/analysis/:id" component={Analysis} />
              <Route path="/history" component={History} />
              <Route path="/stats" component={Stats} />
              <Route path="/brand" component={Brand} />
              <Route path="/compare" component={Compare} />
              <Route path="/skills" component={Skills} />
              <Route component={NotFound} />
            </Switch>
          </ErrorBoundary>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
