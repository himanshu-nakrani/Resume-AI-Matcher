import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Timer, ChevronDown, ChevronUp, Play, Square, RotateCcw, CheckCircle2, Star, Clock, Trophy } from "lucide-react";

interface PracticeSession {
  question: string;
  answer: string;
  timeUsed: number;
  score: number;
  feedback: string;
  completedAt: string;
}

interface Props {
  analysisId: number;
  questions: string[];
}

const TIMER_SECONDS = 120;

function getHistory(id: number): PracticeSession[] {
  try {
    return JSON.parse(localStorage.getItem("practice_" + id) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(id: number, sessions: PracticeSession[]) {
  localStorage.setItem("practice_" + id, JSON.stringify(sessions.slice(0, 20)));
}

function scoreAnswer(answer: string): { score: number; feedback: string } {
  const words = answer.trim().split(/\s+/).length;
  const hasSituation = /\b(when|at|during|while|in \d{4}|working at|my previous|my last)\b/i.test(answer);
  const hasTask = /\b(i was|my role|tasked|responsible|needed to|had to)\b/i.test(answer);
  const hasAction = /\b(i did|i built|i led|i created|i implemented|i developed|i managed|i worked)\b/i.test(answer);
  const hasResult = /\b(result|outcome|increased|decreased|improved|saved|reduced|grew|achieved|successfully)\b/i.test(answer);

  let score = 0;
  const tips: string[] = [];

  if (hasSituation) score += 25; else tips.push("Add context: describe the situation or background");
  if (hasTask) score += 25; else tips.push("Clarify your role: what was your specific responsibility?");
  if (hasAction) score += 25; else tips.push("Detail your actions: what specific steps did you take?");
  if (hasResult) score += 25; else tips.push("Quantify results: mention outcomes, metrics, or impact");

  if (words < 50) tips.push("Your answer is brief — aim for 100–200 words for depth");
  if (words > 350) tips.push("Trim for clarity — interviewers prefer concise, focused answers");

  const feedback = tips.length === 0
    ? "Excellent STAR structure! All four components are present and your answer is well-rounded."
    : "Suggestions: " + tips.join(". ") + ".";

  return { score, feedback };
}

export function InterviewPractice({ analysisId, questions }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedQ, setSelectedQ] = useState(0);
  const [mode, setMode] = useState<"idle" | "running" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (open) setHistory(getHistory(analysisId));
  }, [open, analysisId]);

  useEffect(() => {
    if (mode === "running") {
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setMode("done");
            const r = scoreAnswer(answer);
            setResult(r);
            const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
            const newSession: PracticeSession = {
              question: questions[selectedQ],
              answer,
              timeUsed: elapsed,
              score: r.score,
              feedback: r.feedback,
              completedAt: new Date().toISOString(),
            };
            const updated = [newSession, ...getHistory(analysisId)];
            saveHistory(analysisId, updated);
            setHistory(updated);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [mode]);

  const handleStart = () => {
    setAnswer("");
    setResult(null);
    setTimeLeft(TIMER_SECONDS);
    setMode("running");
  };

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setMode("done");
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    const r = scoreAnswer(answer);
    setResult(r);
    const newSession: PracticeSession = {
      question: questions[selectedQ],
      answer,
      timeUsed: elapsed,
      score: r.score,
      feedback: r.feedback,
      completedAt: new Date().toISOString(),
    };
    const updated = [newSession, ...getHistory(analysisId)];
    saveHistory(analysisId, updated);
    setHistory(updated);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setMode("idle");
    setAnswer("");
    setResult(null);
    setTimeLeft(TIMER_SECONDS);
  };

  const pct = (timeLeft / TIMER_SECONDS) * 100;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const urgent = timeLeft <= 30 && mode === "running";

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            Interview Practice
            {history.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">{history.length} sessions</Badge>
            )}
          </CardTitle>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Select question to practice</label>
            <select
              value={selectedQ}
              onChange={(e) => { setSelectedQ(Number(e.target.value)); handleReset(); }}
              disabled={mode === "running"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {questions.map((q, i) => (
                <option key={i} value={i}>{i + 1}. {q.slice(0, 80)}{q.length > 80 ? "…" : ""}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium leading-relaxed">{questions[selectedQ]}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-mono font-semibold tabular-nums ${urgent ? "text-destructive" : ""}`}>
                {mins}:{secs}
              </span>
              <span className="text-xs text-muted-foreground">{TIMER_SECONDS}s limit</span>
            </div>
            <Progress
              value={pct}
              className={`h-1.5 ${urgent ? "[&>div]:bg-destructive" : ""}`}
            />
          </div>

          <Textarea
            placeholder="Start typing your answer using the STAR method (Situation → Task → Action → Result)…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={mode === "idle" || mode === "done"}
            className="min-h-[140px] text-sm resize-none"
          />

          <div className="flex gap-2">
            {mode === "idle" && (
              <Button onClick={handleStart} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Start Timer
              </Button>
            )}
            {mode === "running" && (
              <>
                <Button onClick={handleStop} variant="secondary" className="flex-1">
                  <Square className="w-4 h-4 mr-2" />
                  Submit Answer
                </Button>
              </>
            )}
            {mode === "done" && (
              <Button onClick={handleReset} variant="outline" className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Practice Again
              </Button>
            )}
          </div>

          {result && mode === "done" && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  STAR Score
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${result.score >= s * 25 ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
                    />
                  ))}
                  <span className="text-sm font-semibold ml-1">{result.score}/100</span>
                </div>
              </div>
              <Progress value={result.score} className="h-2" />
              <p className="text-sm text-muted-foreground leading-relaxed">{result.feedback}</p>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Recent practice sessions
              </p>
              <div className="space-y-2">
                {history.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs rounded-lg bg-muted/40 px-3 py-2">
                    <Trophy className={`w-3.5 h-3.5 shrink-0 ${s.score >= 75 ? "text-yellow-500" : s.score >= 50 ? "text-blue-500" : "text-muted-foreground"}`} />
                    <span className="flex-1 text-muted-foreground truncate">{s.question.slice(0, 60)}…</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{s.score}/100</Badge>
                    <span className="text-muted-foreground shrink-0">{s.timeUsed}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
