import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator, ChevronDown, ChevronUp, Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SCRIPT_TEMPLATES = [
  {
    scenario: "Opening ask",
    script: "Thank you so much for the offer — I'm genuinely excited about this opportunity. Based on my research and the value I bring, I was hoping we could discuss a base salary closer to [TARGET]. Is there flexibility there?",
  },
  {
    scenario: "Counteroffer",
    script: "I really appreciate you sharing that context. Given my [YEARS] years of experience in [SKILL_AREA] and the immediate impact I can make on [PROJECT], would you be able to meet me at [COUNTER]?",
  },
  {
    scenario: "Non-salary benefits",
    script: "If the base salary has a firm cap, I'd love to explore other components — an additional [X] days PTO, a signing bonus, or an earlier performance review at 6 months would make a meaningful difference.",
  },
  {
    scenario: "Final close",
    script: "I want to make this work — this role is my top choice. If you can get to [TARGET], I'm ready to sign today. Can we make that happen?",
  },
  {
    scenario: "Holding firm",
    script: "I understand the constraints, and I genuinely want to join the team. My minimum to leave my current position is [FLOOR]. I hope we can find a way to get there.",
  },
];

interface Props {
  currentSalary?: number;
  currency?: string;
}

export function NegotiationCalculator({ currentSalary, currency = "USD" }: Props) {
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(currentSalary ? String(currentSalary) : "");
  const [target, setTarget] = useState("");
  const [floor, setFloor] = useState("");
  const [activeScript, setActiveScript] = useState<number | null>(null);

  const offerNum = parseFloat(offer.replace(/,/g, "")) || 0;
  const targetNum = parseFloat(target.replace(/,/g, "")) || 0;
  const floorNum = parseFloat(floor.replace(/,/g, "")) || 0;

  const diff = targetNum - offerNum;
  const pct = offerNum > 0 ? ((diff / offerNum) * 100).toFixed(1) : "0";
  const midpoint = offerNum > 0 && targetNum > 0 ? Math.round((offerNum + targetNum) / 2) : 0;

  const fmt = (n: number) =>
    n > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : "—";

  const fillScript = (s: string) =>
    s
      .replace("[TARGET]", targetNum > 0 ? fmt(targetNum) : "[TARGET]")
      .replace("[COUNTER]", midpoint > 0 ? fmt(midpoint) : "[COUNTER]")
      .replace("[FLOOR]", floorNum > 0 ? fmt(floorNum) : "[FLOOR]");

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Negotiation Calculator
          </CardTitle>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-6">
          {/* Calculator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Their Offer</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 120,000"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Your Target</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 140,000"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Walk-away Floor</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 125,000"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              />
            </div>
          </div>

          {offerNum > 0 && targetNum > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Offer", value: fmt(offerNum) },
                { label: "Target", value: fmt(targetNum) },
                { label: "Gap", value: fmt(Math.abs(diff)), sub: diff >= 0 ? "+" + pct + "%" : pct + "%" },
                { label: "Midpoint", value: fmt(midpoint) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-sm mt-0.5">{item.value}</p>
                  {item.sub && (
                    <Badge variant={diff >= 0 ? "default" : "destructive"} className="text-[10px] mt-1 px-1.5 py-0">
                      {diff >= 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" />}
                      {item.sub}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {floorNum > 0 && offerNum > 0 && (
            <div className={`text-sm rounded-lg px-4 py-3 flex items-start gap-2 ${
              offerNum >= floorNum
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            }`}>
              {offerNum >= floorNum
                ? <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                : <Minus className="w-4 h-4 shrink-0 mt-0.5" />}
              {offerNum >= floorNum
                ? "Offer is above your walk-away floor — negotiate from a position of strength."
                : `Offer is ${fmt(floorNum - offerNum)} below your floor — pushing to target is essential.`}
            </div>
          )}

          {/* Script templates */}
          <div>
            <p className="text-sm font-medium mb-3">Negotiation Scripts</p>
            <div className="space-y-2">
              {SCRIPT_TEMPLATES.map((tmpl, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveScript(activeScript === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
                    aria-expanded={activeScript === i}
                  >
                    <span>{tmpl.scenario}</span>
                    {activeScript === i ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  {activeScript === i && (
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed italic">"{fillScript(tmpl.script)}"</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(fillScript(tmpl.script))}
                      >
                        Copy script
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
