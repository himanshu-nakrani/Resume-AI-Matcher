import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, RefreshCw, Trash2, Plus, Search, Clock } from "lucide-react";

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

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-alerts");
      if (res.ok) setAlerts(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const createAlert = async () => {
    if (!newQuery.trim()) return;
    try {
      const res = await fetch("/api/search-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || undefined, query: newQuery, searchType: newSearchType }),
      });
      if (res.ok) {
        toast({ title: "Alert created" });
        setShowCreate(false);
        setNewQuery("");
        setNewName("");
        fetchAlerts();
      }
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const deleteAlert = async (id: number) => {
    const res = await fetch(`/api/search-alerts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Alert removed" });
    }
  };

  const toggleAlert = async (id: number, enabled: boolean) => {
    await fetch(`/api/search-alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
  };

  const checkAlert = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await fetch(`/api/search-alerts/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: `${data.newResultsCount} new results`,
          description: `Found ${data.newCount} total. ${data.newResultsCount > 0 ? "Check them out!" : "No new listings since last check."}`,
        });
        fetchAlerts();
      } else {
        toast({ title: "Check failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Check failed", variant: "destructive" });
    }
    setCheckingId(null);
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">{alerts.length} saved searches</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> {showCreate ? "Cancel" : "New Alert"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <input
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Alert name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Search query (e.g. senior React developer remote)"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
            />
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={newSearchType} onChange={(e) => setNewSearchType(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="fast">Fast</option>
              <option value="deep">Deep</option>
              <option value="deep-reasoning">Deep Reasoning</option>
            </select>
            <Button onClick={createAlert} disabled={!newQuery.trim()}>Create Alert</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No alerts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create an alert to re-check searches for new results</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {alert.enabled ? <BellRing className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4 text-muted-foreground" />}
                      <h3 className="font-semibold">{alert.name || alert.query.slice(0, 60)}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{alert.query}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                      <BadgeSimple>{alert.searchType}</BadgeSimple>
                      {alert.userLocation && <BadgeSimple>{alert.userLocation}</BadgeSimple>}
                      {alert.lastRunAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last checked: {new Date(alert.lastRunAt).toLocaleDateString()}
                        </span>
                      )}
                      {alert.lastResultCount != null && (
                        <span>{alert.lastResultCount} results</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAlert(alert.id, !alert.enabled)}
                      title={alert.enabled ? "Disable" : "Enable"}
                    >
                      {alert.enabled ? <BellRing className="w-3.5 h-3.5 text-primary" /> : <Bell className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => checkAlert(alert.id)}
                      disabled={checkingId === alert.id}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingId === alert.id ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAlert(alert.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeSimple({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">{children}</span>;
}
