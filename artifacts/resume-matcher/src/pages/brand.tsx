import { useListAnalyses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Fingerprint,
  TrendingUp,
  FileText,
  Target,
  Zap,
  Award,
  Briefcase,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`border shadow-sm ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${highlight ? "bg-primary/20" : "bg-primary/10"}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Brand() {
  const { data: analyses, isLoading } = useListAnalyses();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
        <Fingerprint className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <h2 className="text-xl font-semibold text-foreground">No Brand Data Yet</h2>
        <p className="mt-2 max-w-xs mx-auto text-sm">
          Run your first analysis to start building your professional brand profile.
        </p>
      </div>
    );
  }

  // 1. Keyword Strength Index
  const matchedFreq: Record<string, number> = {};
  const matchedCount: Record<string, number> = {}; // To calculate avg match rate if we had it, but for now just frequency
  
  analyses.forEach(a => {
    const matched = (a.atsKeywordsMatched as string[]) || [];
    matched.forEach(kw => {
      matchedFreq[kw] = (matchedFreq[kw] || 0) + 1;
    });
  });

  const keywordStrengthData = Object.entries(matchedFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({ 
      name, 
      value,
      rate: Math.round((value / analyses.length) * 100)
    }));

  // 2. Skill Gap Map
  const missingFreq: Record<string, number> = {};
  analyses.forEach(a => {
    const missing = (a.atsKeywordsMissing as string[]) || [];
    missing.forEach(kw => {
      missingFreq[kw] = (missingFreq[kw] || 0) + 1;
    });
  });

  const skillGapData = Object.entries(missingFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({ 
      name, 
      value,
      rate: Math.round((value / analyses.length) * 100)
    }));

  // 3. Fit Score Trend
  const trendData = [...analyses]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(a => ({
      date: new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: a.fitScore,
      job: a.jobTitle
    }));

  // 4. Personal Summary Stats
  const totalAnalyses = analyses.length;
  const avgFitScore = Math.round(analyses.reduce((acc, a) => acc + a.fitScore, 0) / totalAnalyses);
  const avgAtsScore = Math.round(analyses.reduce((acc, a) => acc + (a.atsScore || 0), 0) / totalAnalyses);
  const bestScore = Math.max(...analyses.map(a => a.fitScore));
  
  const roleFreq: Record<string, number> = {};
  analyses.forEach(a => {
    roleFreq[a.jobTitle] = (roleFreq[a.jobTitle] || 0) + 1;
  });
  const mostAnalyzedRole = Object.entries(roleFreq).sort((a, b) => b[1] - a[1])[0][0];

  // 5. Top Strengths word cloud (simplified as styled badges/text)
  const strengths = keywordStrengthData.slice(0, 10);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-primary" />
            Brand Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your professional identity quantified across {totalAnalyses} analyses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Analyses" value={totalAnalyses} icon={FileText} sub="Total applications" />
        <StatCard title="Avg Fit" value={`${avgFitScore}%`} icon={Target} sub="Match quality" highlight />
        <StatCard title="Avg ATS" value={`${avgAtsScore}%`} icon={Zap} sub="System readiness" />
        <StatCard title="Peak Match" value={`${bestScore}%`} icon={Award} sub="Highest score" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Fit Score Evolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#888' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#888' }}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2, fill: 'white' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Fit Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> Focus Area
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <div className="mb-4">
              <ScoreCircle score={avgFitScore} size="lg" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground uppercase">Top Target Role</p>
              <p className="text-xl font-bold mt-1 line-clamp-2">{mostAnalyzedRole}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Keyword Strength Index */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Keyword Strength Index</CardTitle>
            <p className="text-xs text-muted-foreground">Most frequent matched keywords across all resumes.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={keywordStrengthData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} occurrences`, 'Count']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {keywordStrengthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${Math.max(0.3, entry.rate / 100)})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Skill Gap Map */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Skill Gap Map</CardTitle>
            <p className="text-xs text-muted-foreground">Top missing keywords — your biggest growth opportunities.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillGapData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} missing`, 'Count']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="#f43f5e">
                    {skillGapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`rgba(244, 63, 94, ${Math.max(0.3, entry.rate / 100)})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Professional Core Strengths
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-wrap justify-center gap-4">
            {strengths.map((s, i) => {
              const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base'];
              const size = sizes[Math.min(i, sizes.length - 1)];
              const opacities = ['opacity-100', 'opacity-90', 'opacity-80', 'opacity-70', 'opacity-60'];
              const opacity = opacities[Math.min(i, opacities.length - 1)];
              
              return (
                <span 
                  key={s.name} 
                  className={`${size} ${opacity} font-bold text-primary transition-all hover:scale-110 cursor-default`}
                >
                  {s.name}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
