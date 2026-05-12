import { useMemo, useState } from "react";
import { useListAnalyses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Save, UserRound } from "lucide-react";

const USER_STORAGE_KEY = "optimatch_user_profile";
const DEEPSEEK_KEY_STORAGE_KEY = "optimatch_deepseek_api_key";

type UserProfile = {
  userName: string;
  userEmail: string;
};

export function UserPage() {
  const { data: analyses } = useListAnalyses();
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
  const [apiKey, setApiKey] = useState(localStorage.getItem(DEEPSEEK_KEY_STORAGE_KEY) ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    if (apiKey) localStorage.setItem(DEEPSEEK_KEY_STORAGE_KEY, apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const optimizedCount = analyses?.length ?? 0;
  const selectedCount = analyses?.filter((item) => item.status === "selected").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Page</h1>
        <p className="text-muted-foreground mt-1">
          Manage your local profile and DeepSeek API key for resume optimization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Optimized resumes</p>
            <p className="text-3xl font-bold mt-1">{optimizedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Selected applications</p>
            <p className="text-3xl font-bold mt-1">{selectedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">API key</p>
            <Badge variant={apiKey ? "secondary" : "outline"} className="mt-2">
              {apiKey ? "Saved locally" : "Not configured"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> DeepSeek API Key
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Stored in this browser only and sent to the API when you optimize a resume.
            </p>
          </div>
          <Button onClick={save} className="gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Saved" : "Save profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
