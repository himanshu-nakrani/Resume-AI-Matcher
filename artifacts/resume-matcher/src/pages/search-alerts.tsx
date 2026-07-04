import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, type ApiErrorPayload } from "@/lib/api-error";
import { Bell, BellRing, RefreshCw, Trash2, Plus, Clock } from "lucide-react";

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
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
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
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
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
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
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
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
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
        description:
          err instanceof Error ? err.message : "Try again in a moment.",
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

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visibleAlerts.length} saved searches
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" />{" "}
          {showCreate ? "Cancel" : "New Alert"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Alert name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Search query (e.g. senior React developer remote)"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
            />
            <select
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={newSearchType}
              onChange={(e) => setNewSearchType(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="fast">Fast</option>
              <option value="deep">Deep</option>
              <option value="deep-reasoning">Deep Reasoning</option>
            </select>
            <Button
              onClick={createAlert}
              disabled={!newQuery.trim() || creating}
            >
              {creating ? "Creating..." : "Create Alert"}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : visibleAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No alerts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create an alert to re-check searches for new results
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const lastCheckedLabel = shortDate(alert.lastRunAt);
            const resultCount = safeCount(alert.lastResultCount);
            return (
              <Card key={alert.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {alert.enabled ? (
                          <BellRing className="w-4 h-4 text-primary" />
                        ) : (
                          <Bell className="w-4 h-4 text-muted-foreground" />
                        )}
                        <h3 className="font-semibold">
                          {alert.name || alert.query.slice(0, 60)}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {alert.query}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                        <BadgeSimple>{alert.searchType}</BadgeSimple>
                        {alert.userLocation && (
                          <BadgeSimple>{alert.userLocation}</BadgeSimple>
                        )}
                        {lastCheckedLabel && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last checked: {lastCheckedLabel}
                          </span>
                        )}
                        {resultCount != null && (
                          <span>{resultCount} results</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAlert(alert.id, !alert.enabled)}
                        disabled={togglingId === alert.id}
                        title={alert.enabled ? "Disable" : "Enable"}
                      >
                        {alert.enabled ? (
                          <BellRing className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
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
                          className={`w-3.5 h-3.5 ${checkingId === alert.id ? "animate-spin" : ""}`}
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
                        <Trash2 className="w-3.5 h-3.5" />
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

function BadgeSimple({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}
