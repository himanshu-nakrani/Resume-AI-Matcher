import { useEffect, useRef, useState } from "react";

interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE_MAP = {
  sm: { radius: 20, stroke: 4, text: "text-sm", container: "w-12 h-12" },
  md: { radius: 36, stroke: 6, text: "text-2xl", container: "w-24 h-24" },
  lg: { radius: 54, stroke: 6, text: "text-4xl", container: "w-36 h-36" },
} as const;

function colorForScore(score: number): string {
  if (score === 0) return "hsl(var(--muted-foreground))";
  if (score >= 80) return "hsl(var(--success))";
  if (score >= 60) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

const COUNT_UP_DURATION_MS = 200;

export function ScoreCircle({ score, size = "md", label }: ScoreCircleProps) {
  const { radius, stroke, text, container } = SIZE_MAP[size];
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayScore(score);
      return;
    }
    const start = performance.now();
    const from = 0;
    const to = score;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const eased = easeOutExpo(t);
      setDisplayScore(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  const color = colorForScore(score);
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const rounded = Math.round(displayScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${container} flex items-center justify-center`}>
        <svg height="100%" width="100%" className="absolute inset-0 -rotate-90">
          <circle
            stroke="hsl(var(--surface-2))"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="50%"
            cy="50%"
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="50%"
            cy="50%"
          />
        </svg>
        <span
          className={`relative z-10 font-mono font-semibold tabular-nums ${text}`}
          style={{ color }}
        >
          {rounded}
        </span>
      </div>
      {label && (
        <span className="text-[12.5px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
