import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  apiErrorMessage,
  unknownErrorMessage,
  type ApiErrorPayload,
} from "@/lib/api-error";
import {
  Bell,
  BellRing,
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  Activity,
  PauseCircle,
  PlusCircle,
} from "lucide-react";

interface SearchAlert {
  id: number;
  name: string | null;
  query: string;
  searchType: string;
  userLocation: string | null;
  recentOnly: boolean;
  filters: Record<string, string> | null;
  lastRunAt: string | null;
  lastResultCount: number | null;
  createdAt: string;
  enabled: boolean;
}

type CheckAlertResponse = {
  newResultsCount?: number;
  newCount?: number;
} & ApiErrorPayload;

function dateValue(value: unknown): Date | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTime(value: unknown): number {
  return dateValue(value)?.getTime() ?? 0;
}

function shortDate(value: unknown): string | null {
  const date = dateValue(value);
  return date ? date.toLocaleDateString() : null;
}

function safeCount(value: unknown): number | null {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.round(count) : null;
}

function normalizeAlert(value: unknown): SearchAlert | null {
  if (!value || typeof value !== "object") return null;
  const alert = value as Partial<SearchAlert>;
  if (typeof alert.id !== "number" || typeof alert.query !== "string")
    return null;

  return {
    id: alert.id,
    name: typeof alert.name === "string" ? alert.name : null,
    query: alert.query,
    searchType:
      typeof alert.searchType === "string" ? alert.searchType : "auto",
    userLocation:
      typeof alert.userLocation === "string" ? alert.userLocation : null,
    recentOnly: Boolean(alert.recentOnly),
    filters:
      alert.filters && typeof alert.filters === "object" ? alert.filters : null,
    lastRunAt: typeof alert.lastRunAt === "string" ? alert.lastRunAt : null,
    lastResultCount: safeCount(alert.lastResultCount),
    createdAt: typeof alert.createdAt === "string" ? alert.createdAt : "",
    enabled: Boolean(alert.enabled),
  };
}

export function SearchAlertsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newSearchType, setNewSearchType] = useState("auto");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-alerts");
      const data = (await res.json().catch(() => null)) as
        | SearchAlert[]
        | ApiErrorPayload
        | null;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data as ApiErrorPayload | null,
            "Could not load job alerts.",
          ),
        );
      }
      setAlerts(
        Array.isArray(data)
          ? data
              .map(normalizeAlert)
              .filter((alert): alert is SearchAlert => alert != null)
          : [],
      );
    } catch (err) {
      toast({
        title: "Could not load job alerts",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAlerts();
  }, []);

  const createAlert = async () => {
    if (!newQuery.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/search-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || undefined,
          query: newQuery.trim(),
          searchType: newSearchType,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | SearchAlert
        | ApiErrorPayload
        | null;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data as ApiErrorPayload | null,
            "Could not create this alert.",
          ),
        );
      }
      const alert = normalizeAlert(data);
      if (alert) {
        setAlerts((prev) => [alert, ...prev]);
      } else {
        void fetchAlerts();
      }
      toast({ title: "Alert created" });
      setShowCreate(false);
      setNewQuery("");
      setNewName("");
    } catch (err) {
      toast({
        title: "Could not create alert",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/search-alerts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        throw new Error(apiErrorMessage(data, "Could not remove this alert."));
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Alert removed" });
    } catch (err) {
      toast({
        title: "Could not remove alert",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleAlert = async (id: number, enabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/search-alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = (await res.json().catch(() => null)) as
        | SearchAlert
        | ApiErrorPayload
        | null;
      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data as ApiErrorPayload | null,
            "Could not update this alert.",
          ),
        );
      }
      const updated = normalizeAlert(data);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, ...(updated ?? {}), enabled } : a,
        ),
      );
      toast({ title: enabled ? "Alert enabled" : "Alert disabled" });
    } catch (err) {
      toast({
        title: "Could not update alert",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const checkAlert = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await fetch(`/api/search-alerts/${id}/check`, {
        method: "POST",
      });
      const data = (await res
        .json()
        .catch(() => null)) as CheckAlertResponse | null;
      if (res.ok) {
        const newResultsCount =
          typeof data?.newResultsCount === "number" ? data.newResultsCount : 0;
        const newCount = typeof data?.newCount === "number" ? data.newCount : 0;
        toast({
          title: `${newResultsCount} new results`,
          description: `Found ${newCount} total. ${newResultsCount > 0 ? "Check them out!" : "No new listings since last check."}`,
        });
        void fetchAlerts();
      } else {
        throw new Error(apiErrorMessage(data, "Could not check this alert."));
      }
    } catch (err) {
      toast({
        title: "Check failed",
        description: unknownErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setCheckingId(null);
    }
  };

  const visibleAlerts = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const lastRunDelta = dateTime(b.lastRunAt) - dateTime(a.lastRunAt);
        return (
          lastRunDelta ||
          dateTime(b.createdAt) - dateTime(a.createdAt) ||
          b.id - a.id
        );
      }),
    [alerts],
  );

  const stats = useMemo(
    () => ({
      total: visibleAlerts.length,
      active: visibleAlerts.filter((alert) => alert.enabled).length,
      paused: visibleAlerts.filter((alert) => !alert.enabled).length,
      checked: visibleAlerts.filter((alert) => alert.lastRunAt).length,
    }),
    [visibleAlerts],
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1">
            <BellRing className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Job Alerts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Re-run saved searches and keep fresh opportunities moving into the
              pipeline.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/?panel=jobs")}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            New search
          </Button>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {showCreate ? "Close" : "New alert"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Alerts" value={stats.total} />
        <MetricCard label="Active" value={stats.active} />
        <MetricCard label="Paused" value={stats.paused} />
        <MetricCard label="Checked" value={stats.checked} />
      </div>

      {showCreate && (
        <Card padding="lg" className="bg-surface-1">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_10rem_auto] md:items-end md:p-5">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                Name
              </span>
              <Input
                placeholder="Alert name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                Query
              </span>
              <Input
                placeholder="senior React developer remote"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                Depth
              </span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={newSearchType}
                onChange={(e) => setNewSearchType(e.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="fast">Fast</option>
                <option value="deep">Deep</option>
                <option value="deep-reasoning">Deep reasoning</option>
              </select>
            </label>
            <Button
              onClick={createAlert}
              disabled={!newQuery.trim() || creating}
              className="md:self-end"
            >
              {creating ? "Creating..." : "Create alert"}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : visibleAlerts.length === 0 ? (
        <Empty className="bg-surface-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>No alerts yet</EmptyTitle>
            <EmptyDescription>
              Save repeat searches for roles, markets, or companies you want to
              monitor.
            </EmptyDescription>
          </EmptyHeader>
          {!showCreate && (
            <EmptyContent>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create alert
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const lastCheckedLabel = shortDate(alert.lastRunAt);
            const resultCount = safeCount(alert.lastResultCount);
            return (
              <Card key={alert.id} padding="lg" className="bg-surface-1">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={alert.enabled ? "success" : "secondary"}
                          size="lg"
                          icon={
                            alert.enabled ? (
                              <Activity className="h-3 w-3" />
                            ) : (
                              <PauseCircle className="h-3 w-3" />
                            )
                          }
                        >
                          {alert.enabled ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline" size="lg">
                          {alert.searchType}
                        </Badge>
                        {alert.userLocation && (
                          <Badge variant="outline" size="lg">
                            {alert.userLocation}
                          </Badge>
                        )}
                        {resultCount != null && (
                          <Badge variant="info" size="lg">
                            {resultCount} results
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold leading-snug">
                          {alert.name || alert.query.slice(0, 60)}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {alert.query}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {lastCheckedLabel ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last checked {lastCheckedLabel}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Not checked yet
                          </span>
                        )}
                        {alert.recentOnly && <span>Recent listings only</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAlert(alert.id, !alert.enabled)}
                        disabled={togglingId === alert.id}
                        title={alert.enabled ? "Disable" : "Enable"}
                      >
                        {alert.enabled ? (
                          <BellRing className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Bell className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => checkAlert(alert.id)}
                        disabled={checkingId === alert.id}
                        title="Check for new listings"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${checkingId === alert.id ? "animate-spin" : ""}`}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteAlert(alert.id)}
                        disabled={deletingId === alert.id}
                        title="Remove alert"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm" className="bg-surface-1">
      <CardContent className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
