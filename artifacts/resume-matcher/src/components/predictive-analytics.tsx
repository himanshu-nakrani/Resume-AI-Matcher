import { useState } from "react";
import { usePredictOffer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CheckCircle2, XCircle, Zap, ChevronDown, ChevronRight } from "lucide-react";

const RATING_CONFIG = {
  strong: { label: "Strong Odds", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800", ring: "#16a34a" },
  good:   { label: "Good Odds",   color: "text-blue-600 dark:text-blue-400",  bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",   ring: "#2563eb" },
  fair:   { label: "Fair Odds",   color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", ring: "#d97706" },
  weak:   { label: "Weak Odds",   color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",       ring: "#dc2626" },
} as const;

function ProbabilityGauge({ value, rating }: { value: number; rating: keyof typeof RATING_CONFIG }) {
  const cfg = RATING_CONFIG[rating] ?? RATING_CONFIG.fair;
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - value / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle
            cx="56" cy="56" r={r}
            fill="none"
            stroke={cfg.ring}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color: cfg.ring }}>{value}%</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">offer odds</span>
        </div>
      </div>
      <Badge variant="outline" className={"text-xs font-semibold px-3 py-1 " + cfg.bg + " " + cfg.color}>
        {cfg.label}
      </Badge>
    </div>
  );
}

interface Props {
  analysisId: number;
  fitScore: number;
}

export function PredictiveAnalytics({ analysisId, fitScore }: Props) {
  const [open, setOpen] = useState(false);
  const predict = usePredictOffer();

  const handlePredict = () => {
    if (!predict.data) {
      predict.mutate({ id: analysisId });
    }
    setOpen(true);
  };

  const data = predict.data;
  const rating = (data?.rating ?? "fair") as keyof typeof RATING_CONFIG;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Offer Predictor
          <span className="text-xs font-normal text-muted-foreground">(AI estimate)</span>
        </CardTitle>
        <div className="flex items-center gap-2 no-print">
          {data && (
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen((p) => !p)}
              aria-label="Toggle"
            >
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <Button
            size="sm"
            variant={data ? "outline" : "default"}
            onClick={handlePredict}
            disabled={predict.isPending}
          >
            {predict.isPending ? "Predicting..." : data ? "Re-predict" : "Predict Odds"}
          </Button>
        </div>
      </CardHeader>

      {predict.isPending && (
        <CardContent className="pt-0">
          <div className="flex flex-col items-center gap-4 py-4">
            <Skeleton className="w-32 h-32 rounded-full" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </CardContent>
      )}

      {data && open && !predict.isPending && (
        <CardContent className="pt-0 space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ProbabilityGauge value={data.probability} rating={rating} />
            <div className="flex-1 space-y-3">
              {data.summary && (
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{data.summary}"</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Helping odds
                  </p>
                  <ul className="space-y-1">
                    {(data.strengthFactors ?? []).map((f, i) => (
                      <li key={i} className="text-muted-foreground pl-2 border-l-2 border-green-300 dark:border-green-700">{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Hurting odds
                  </p>
                  <ul className="space-y-1">
                    {(data.riskFactors ?? []).map((f, i) => (
                      <li key={i} className="text-muted-foreground pl-2 border-l-2 border-red-300 dark:border-red-700">{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {(data.actionItems ?? []).length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Actions to improve your odds
              </p>
              <ul className="space-y-1">
                {data.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <span className="font-bold text-amber-500 shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}

      {!data && !predict.isPending && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground py-4">
            Click "Predict Odds" to get an AI-powered estimate of your offer likelihood based on your fit score, ATS score, strengths, and gaps.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
