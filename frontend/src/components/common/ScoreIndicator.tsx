import { cn, getScoreColor, getScoreBg } from "@/lib/utils";

interface ScoreProps {
  score: number;
  showBar?: boolean;
  size?: "sm" | "md";
}

export function ScoreIndicator({ score, showBar = false, size = "sm" }: ScoreProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-bold tabular-nums", size === "sm" ? "text-sm" : "text-base", getScoreColor(score))}>
        {score}
      </span>
      {showBar && (
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getScoreBg(score))}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  );
}
