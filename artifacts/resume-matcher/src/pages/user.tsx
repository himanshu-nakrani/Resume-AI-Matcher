import { useMemo, useState } from "react";
import { useListAnalyses } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, CheckCircle2, Mail, Save, Target, UserRound } from "lucide-react";

const USER_STORAGE_KEY = "optimatch_user_profile";

type UserProfile = {
  userName: string;
  userEmail: string;
};

export function UserPage() {
  const { toast } = useToast();
  const { data: analyses, isLoading, error } = useListAnalyses();
  const savedProfile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) ?? "{}") as Partial<UserProfile>;
    } catch {
      return {};
    }
  }, []);

  const [profile, setProfile] = useState<UserProfile>({
    userName: savedProfile.userName ?? "",
    userEmail: savedProfile.userEmail ?? "",
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
        userName: profile.userName.trim(),
        userEmail: profile.userEmail.trim(),
      }));
      setProfile((current) => ({
        userName: current.userName.trim(),
        userEmail: current.userEmail.trim(),
      }));
      setSaved(true);
      toast({ title: "Profile saved", description: "Your optimizer defaults were updated on this device." });
      setTimeout(() => setSaved(false), 1500);
    } catch {
      toast({
        title: "Could not save profile",
        description: "Your browser blocked local storage. Check site permissions and try again.",
        variant: "destructive",
      });
    }
  };

  const optimizedCount = analyses?.length ?? 0;
  const activeCount = analyses?.filter((item) => !["selected", "rejected"].includes(item.status ?? "")).length ?? 0;
  const averageFit = optimizedCount > 0
    ? Math.round((analyses ?? []).reduce((sum, item) => sum + item.fitScore, 0) / optimizedCount)
    : 0;
  const profileComplete = Boolean(profile.userName.trim() && profile.userEmail.trim());
  const statsError = error instanceof Error ? error.message : null;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={profileComplete ? "default" : "secondary"} className="gap-1.5">
                {profileComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                {profileComplete ? "Profile ready" : "Profile incomplete"}
              </Badge>
              <span className="text-xs text-muted-foreground">Stored locally on this browser</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Workspace profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep your name and email ready for resume optimization, cover letters, and tracker exports.
            </p>
          </div>

          <div className="border-t border-border bg-background/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default identity</p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.userName.trim() || "No name saved"}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile.userEmail.trim() || "No email saved"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          icon={BarChart3}
          label="Optimized resumes"
          value={optimizedCount}
          loading={isLoading}
          muted={Boolean(statsError)}
        />
        <MetricCard
          icon={Target}
          label="Average fit score"
          value={`${averageFit}%`}
          loading={isLoading}
          muted={Boolean(statsError) || optimizedCount === 0}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Active applications"
          value={activeCount}
          loading={isLoading}
          muted={Boolean(statsError)}
        />
      </div>
      {statsError && (
        <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Could not load workspace stats. {statsError}
        </div>
      )}

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Profile details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These values prefill the optimizer form and stay on this device.
              </p>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Local profile
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={profile.userName}
                onChange={(event) => setProfile((current) => ({ ...current, userName: event.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={profile.userEmail}
                onChange={(event) => setProfile((current) => ({ ...current, userEmail: event.target.value }))}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} className="gap-2" disabled={!profile.userName.trim() || !profile.userEmail.trim()}>
            <Save className="h-4 w-4" />
            {saved ? "Saved" : "Save profile"}
            </Button>
            {!profileComplete && (
              <p className="text-xs text-muted-foreground">Add both fields to enable one-click saving.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
  muted,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  loading: boolean;
  muted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className={`mt-1 text-3xl font-semibold tracking-tight ${muted ? "text-muted-foreground" : ""}`}>
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
