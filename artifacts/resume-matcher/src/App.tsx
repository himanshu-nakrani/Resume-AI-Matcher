import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Layout } from "@/components/layout";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() =>
  import("@/pages/home").then((m) => ({ default: m.Home })),
);
const Board = lazy(() =>
  import("@/pages/board").then((m) => ({ default: m.Board })),
);
const Analysis = lazy(() =>
  import("@/pages/analysis").then((m) => ({ default: m.Analysis })),
);
const History = lazy(() =>
  import("@/pages/history").then((m) => ({ default: m.History })),
);
const Stats = lazy(() =>
  import("@/pages/stats").then((m) => ({ default: m.Stats })),
);
const Brand = lazy(() =>
  import("@/pages/brand").then((m) => ({ default: m.Brand })),
);
const SharedAnalysis = lazy(() =>
  import("@/pages/shared").then((m) => ({ default: m.SharedAnalysis })),
);
const Compare = lazy(() =>
  import("@/pages/compare").then((m) => ({ default: m.Compare })),
);
const Versions = lazy(() =>
  import("@/pages/versions").then((m) => ({ default: m.Versions })),
);
const UserPage = lazy(() =>
  import("@/pages/user").then((m) => ({ default: m.UserPage })),
);
const SavedJobsPage = lazy(() =>
  import("@/pages/saved-jobs").then((m) => ({ default: m.SavedJobsPage })),
);
const SearchAlertsPage = lazy(() =>
  import("@/pages/search-alerts").then((m) => ({
    default: m.SearchAlertsPage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// One-time cleanup of the legacy client-side API key. The server now reads
// the key from FIREWORKS_API_KEY env; leaving the old value in localStorage
// would keep sensitive data around for no reason.
try {
  localStorage.removeItem("optimatch_deepseek_api_key");
} catch {
  /* ignore */
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/share/:token" component={SharedAnalysis} />
        <Route>
          <Layout>
            <ErrorBoundary>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/board" component={Board} />
                <Route path="/tracker" component={Board} />
                <Route path="/user" component={UserPage} />
                <Route path="/analysis/:id" component={Analysis} />
                <Route path="/history" component={History} />
                <Route path="/stats" component={Stats} />
                <Route path="/brand" component={Brand} />
                <Route path="/compare" component={Compare} />
                <Route path="/versions" component={Versions} />
                <Route path="/saved-jobs" component={SavedJobsPage} />
                <Route path="/alerts" component={SearchAlertsPage} />
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface-1 px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Loading workspace
      </div>
    </div>
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
