import { useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight } from "lucide-react";
import type { Analysis } from "@workspace/api-client-react";

interface Props {
  analyses: Analysis[];
}

const STAGES = [
  { key: "applied", label: "Applied", color: "bg-blue-500" },
  { key: "interview", label: "Interview", color: "bg-violet-500" },
  { key: "offer", label: "Offer", color: "bg-emerald-500" },
] as const;

export function FunnelWidget({ analyses }: Props) {
  const [, setLocation] = useLocation();

  const counts = useMemo(() => {
    const total = analyses.length;
    const applied = analyses.filter((a) => ["applied", "interview", "offer"].includes(a.status)).length;
    const interview = analyses.filter((a) => ["interview", "offer"].includes(a.status)).length;
    const offer = analyses.filter((a) => a.status === "offer").length;
    return { total, applied, interview, offer };
  }, [analyses]);

  const rate = (num: number, denom: number) =>
    denom === 0 ? 0 : Math.round((num / denom) * 100);

  const appRate = rate(counts.applied, counts.total);
  const interviewRate = rate(counts.interview, counts.applied);
  const offerRate = rate(counts.offer, counts.interview);

  if (counts.total < 2) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Application Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex flex-col items-center text-center min-w-[72px]">
            <div className="text-2xl font-bold">{counts.total}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Analysed</div>
            <div className="w-full h-2 rounded-full bg-muted mt-2" />
          </div>

          {STAGES.map((stage, i) => {
            const count = counts[stage.key as keyof typeof counts] as number;
            const prevCount = i === 0 ? counts.total : (counts[STAGES[i - 1].key as keyof typeof counts] as number);
            const pct = rate(count, prevCount);
            return (
              <div key={stage.key} className="flex items-center gap-1">
                <div className="flex flex-col items-center">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 mt-0.5 border-primary/30 text-primary"
                  >
                    {pct}%
                  </Badge>
                </div>
                <div className="flex flex-col items-center text-center min-w-[72px]">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stage.label}</div>
                  <div
                    className={`h-2 rounded-full mt-2 transition-all ${stage.color}`}
                    style={{ width: counts.total > 0 ? `${Math.max(8, (count / counts.total) * 100)}%` : "8%", minWidth: 8, maxWidth: "100%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">Apply rate</p>
            <p className="text-base font-semibold">{appRate}%</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">Interview rate</p>
            <p className="text-base font-semibold">{interviewRate}%</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">Offer rate</p>
            <p className="text-base font-semibold">{offerRate}%</p>
          </div>
        </div>

        <button
          onClick={() => setLocation("/stats")}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          View detailed stats →
        </button>
      </CardContent>
    </Card>
  );
}
