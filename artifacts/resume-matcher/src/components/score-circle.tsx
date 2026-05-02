import React from "react";

interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function ScoreCircle({ score, size = "md", label }: ScoreCircleProps) {
  const sizeMap = {
    sm: { radius: 20, stroke: 4, text: "text-sm", container: "w-12 h-12" },
    md: { radius: 36, stroke: 6, text: "text-2xl", container: "w-24 h-24" },
    lg: { radius: 54, stroke: 8, text: "text-4xl", container: "w-36 h-36" },
  };

  const { radius, stroke, text, container } = sizeMap[size];
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let colorClass = "text-primary";
  if (score >= 80) colorClass = "text-green-500";
  else if (score >= 60) colorClass = "text-yellow-500";
  else if (score < 60 && score > 0) colorClass = "text-red-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${container} flex items-center justify-center`}>
        <svg height="100%" width="100%" className="absolute inset-0 transform -rotate-90">
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="50%"
            cy="50%"
            className="text-muted"
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="50%"
            cy="50%"
            className={`${colorClass} transition-all duration-1000 ease-in-out`}
          />
        </svg>
        <span className={`font-bold tabular-nums ${text} ${colorClass}`}>
          {score}
        </span>
      </div>
      {label && <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>}
    </div>
  );
}