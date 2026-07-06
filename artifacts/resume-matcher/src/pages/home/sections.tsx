import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bookmark,
  ChevronDown,
  Search,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import type { Analysis } from "@workspace/api-client-react";
import { JobSearchBodySearchType } from "@workspace/api-client-react";
import type { JobSearchResponse } from "@workspace/api-client-react";
import { JobDetailModal } from "@/components/job-detail-modal";
import {
  getHostname,
  cleanJobText,
  jobSnippets,
  jobBadges,
  formatPublishedDate,
} from "./helpers";
import type { JobSearchHit } from "./helpers";

// ---------------------------------------------------------------------------
// RecentAnalysesStrip
// ---------------------------------------------------------------------------

interface RecentAnalysesStripProps {
  analyses: Analysis[] | undefined;
}

export function RecentAnalysesStrip({ analyses }: RecentAnalysesStripProps) {
  const [, setLocation] = useLocation();
  if (!analyses || analyses.length === 0) return null;
  return (
    <section className="mt-10 min-w-0 overflow-hidden">
      <h2 className="text-[15px] font-semibold mb-3">Recent analyses</h2>
      <div className="-mx-1 flex max-w-full gap-3 overflow-x-auto px-1 pb-2">
        {analyses.slice(0, 5).map((a) => (
          <Card
            key={a.id}
            padding="sm"
            className="shrink-0 w-[200px] cursor-pointer hover:border-border-strong transition-colors"
            onClick={() => setLocation(`/analysis/${a.id}`)}
          >
            <CardContent className="flex items-center gap-3">
              <ScoreCircle score={a.fitScore} size="sm" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{a.jobTitle}</p>
                {a.companyName && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.companyName}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// JobSearchSection
// ---------------------------------------------------------------------------

interface JobSearchSectionProps {
  exaQuery: string;
  setExaQuery: (v: string) => void;
  exaRecent: boolean;
  setExaRecent: (v: boolean) => void;
  exaSkipHeuristics: boolean;
  setExaSkipHeuristics: (v: boolean) => void;
  exaType: JobSearchBodySearchType;
  setExaType: (v: JobSearchBodySearchType) => void;
  exaNumResults: number;
  setExaNumResults: (v: number) => void;
  exaUserLocation: string;
  setExaUserLocation: (v: string) => void;
  exaResults: JobSearchResponse | null;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  exaExperienceLevel: string;
  setExaExperienceLevel: (v: string) => void;
  exaJobType: string;
  setExaJobType: (v: string) => void;
  exaRemote: string;
  setExaRemote: (v: string) => void;
  exaSalaryMin: string;
  setExaSalaryMin: (v: string) => void;
  exaIndustry: string;
  setExaIndustry: (v: string) => void;
  exaCompanySize: string;
  setExaCompanySize: (v: string) => void;
  detailHit: JobSearchHit | null;
  setDetailHit: (v: JobSearchHit | null) => void;
  detailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
  loadingMore: boolean;
  matchScores: Map<string, { score: number; loading: boolean }>;
  isSearchPending: boolean;
  isFetchJobPending: boolean;
  hasResumeText: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
  onLoadMore: () => void;
  onSaveJob: (hit: JobSearchHit) => void;
  onPreScreen: (hit: JobSearchHit) => void;
  onImportJd: (url: string) => void;
}

export function JobSearchSection({
  exaQuery,
  setExaQuery,
  exaRecent,
  setExaRecent,
  exaSkipHeuristics,
  setExaSkipHeuristics,
  exaType,
  setExaType,
  exaNumResults,
  setExaNumResults,
  exaUserLocation,
  setExaUserLocation,
  exaResults,
  showFilters,
  setShowFilters,
  exaExperienceLevel,
  setExaExperienceLevel,
  exaJobType,
  setExaJobType,
  exaRemote,
  setExaRemote,
  exaSalaryMin,
  setExaSalaryMin,
  exaIndustry,
  setExaIndustry,
  exaCompanySize,
  setExaCompanySize,
  detailHit,
  setDetailHit,
  detailOpen,
  setDetailOpen,
  loadingMore,
  matchScores,
  isSearchPending,
  isFetchJobPending,
  hasResumeText,
  isOpen,
  onOpenChange,
  onSearch,
  onLoadMore,
  onSaveJob,
  onPreScreen,
  onImportJd,
}: JobSearchSectionProps) {
  const activeFilterCount = [
    exaExperienceLevel,
    exaJobType,
    exaRemote,
    exaSalaryMin,
    exaIndustry,
    exaCompanySize,
  ].filter(Boolean).length;

  return (
    <>
      <details
        id="job-search"
        className="mt-10 group"
        open={isOpen}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer rounded-md border border-border bg-surface-1 px-4 py-3 hover:bg-surface-2 transition-colors marker:hidden list-none">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-[15px] font-semibold">Find similar roles</span>
          <span className="text-[12px] text-muted-foreground">
            Search jobs that match your input
          </span>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted-foreground">
            Describe the role in natural language; the server infers location,
            remote intent, and recency, then asks Exa with a job-focused system
            prompt and query variants. Configure{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              EXA_API_KEY
            </code>{" "}
            on the API server.
          </p>
          <label htmlFor="job-search-query" className="sr-only">
            Job search query
          </label>
          <Textarea
            id="job-search-query"
            className="min-h-[100px] text-sm"
            placeholder='e.g. "senior TypeScript backend engineer remote EU startup job posting"'
            value={exaQuery}
            onChange={(e) => setExaQuery(e.target.value)}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="job-search-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters{" "}
            {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </Button>

          {showFilters && (
            <div
              id="job-search-filters"
              className="flex flex-wrap gap-2 items-end p-3 border rounded-md bg-muted/20"
            >
              <div className="space-y-1">
                <label
                  htmlFor="job-search-experience"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Experience
                </label>
                <select
                  id="job-search-experience"
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={exaExperienceLevel}
                  onChange={(e) => setExaExperienceLevel(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="entry">Entry Level</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead / Staff</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-search-job-type"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Job Type
                </label>
                <select
                  id="job-search-job-type"
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={exaJobType}
                  onChange={(e) => setExaJobType(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="full-time">Full-time</option>
                  <option value="contract">Contract</option>
                  <option value="part-time">Part-time</option>
                  <option value="internship">Internship</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-search-remote"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Remote
                </label>
                <select
                  id="job-search-remote"
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={exaRemote}
                  onChange={(e) => setExaRemote(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-search-min-salary"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Min Salary ($)
                </label>
                <input
                  id="job-search-min-salary"
                  className="flex h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
                  placeholder="e.g. 100000"
                  value={exaSalaryMin}
                  onChange={(e) => setExaSalaryMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-search-industry"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Industry
                </label>
                <input
                  id="job-search-industry"
                  className="flex h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
                  placeholder="e.g. fintech"
                  value={exaIndustry}
                  onChange={(e) => setExaIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="job-search-company-size"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Company Size
                </label>
                <select
                  id="job-search-company-size"
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={exaCompanySize}
                  onChange={(e) => setExaCompanySize(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="startup">Startup</option>
                  <option value="mid-size">Mid-size</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label
                htmlFor="job-search-mode"
                className="text-xs font-medium text-muted-foreground"
              >
                Search mode
              </label>
              <select
                id="job-search-mode"
                className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm"
                value={exaType}
                onChange={(e) =>
                  setExaType(e.target.value as JobSearchBodySearchType)
                }
              >
                {Object.values(JobSearchBodySearchType).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="job-search-results"
                className="text-xs font-medium text-muted-foreground"
              >
                Results
              </label>
              <select
                id="job-search-results"
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={exaNumResults}
                onChange={(e) => setExaNumResults(Number(e.target.value))}
              >
                {[5, 8, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="job-search-country"
                className="text-xs font-medium text-muted-foreground"
              >
                Country (optional)
              </label>
              <Input
                id="job-search-country"
                className="h-9 w-20 uppercase"
                maxLength={2}
                placeholder="US"
                value={exaUserLocation}
                onChange={(e) => setExaUserLocation(e.target.value)}
              />
            </div>
            <label
              htmlFor="job-search-prefer-recent"
              className="flex items-center gap-2 text-sm cursor-pointer pb-1"
            >
              <input
                id="job-search-prefer-recent"
                type="checkbox"
                className="rounded border-input"
                checked={exaRecent}
                onChange={(e) => setExaRecent(e.target.checked)}
              />{" "}
              Prefer recent
            </label>
            <label
              htmlFor="job-search-raw-query"
              className="flex items-center gap-2 text-sm cursor-pointer pb-1"
            >
              <input
                id="job-search-raw-query"
                type="checkbox"
                className="rounded border-input"
                checked={exaSkipHeuristics}
                onChange={(e) => setExaSkipHeuristics(e.target.checked)}
              />{" "}
              Raw query
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={onSearch}
              disabled={isSearchPending}
            >
              {isSearchPending ? "Searching…" : "Search jobs"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>auto</strong> may upgrade to <strong>deep</strong> for long
            or multi-signal prompts; <strong>deep-reasoning</strong> can take
            tens of seconds.
          </p>

          {exaResults?.analysis && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {exaResults.analysis.intentSummary}
              </p>
              <p className="text-muted-foreground">
                Exa type:{" "}
                <span className="font-mono">
                  {exaResults.analysis.effectiveSearchType}
                </span>
                {exaResults.analysis.inferredLocation ? (
                  <>
                    {" "}
                    · region{" "}
                    <span className="font-mono">
                      {exaResults.analysis.inferredLocation}
                    </span>
                  </>
                ) : null}
              </p>
              <p
                className="text-muted-foreground line-clamp-2"
                title={exaResults.analysis.optimizedQuery}
              >
                Query sent: {exaResults.analysis.optimizedQuery}
              </p>
            </div>
          )}

          {exaResults?.metadata &&
            (() => {
              const meta = exaResults.metadata;
              const duration = meta.searchDurationMs ?? 0;
              const ranking = meta.rankingStats ?? {
                highQuality: 0,
                mediumQuality: 0,
                filtered: 0,
              };
              const apply = meta.applyTypeBreakdown ?? {
                ats: 0,
                external: 0,
                unknown: 0,
              };
              const cities = meta.cities ?? [];
              const companies = meta.companies ?? [];
              return (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">
                    Search analytics
                  </p>
                  <p className="text-muted-foreground">
                    Found {meta.totalFound} results ·{" "}
                    {duration < 1000
                      ? `${duration}ms`
                      : `${(duration / 1000).toFixed(1)}s`}
                    {meta.cachedResult ? " · cached" : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Quality: {ranking.highQuality} high ·{" "}
                    {ranking.mediumQuality} medium · {ranking.filtered} filtered
                  </p>
                  <p className="text-muted-foreground">
                    Apply: {apply.ats} easy · {apply.external} external ·{" "}
                    {apply.unknown} unknown
                  </p>
                  {cities.length > 0 && (
                    <p className="text-muted-foreground">
                      Cities: {cities.join(", ")}
                    </p>
                  )}
                  {companies.length > 0 && (
                    <p className="text-muted-foreground">
                      Companies: {companies.join(", ")}
                    </p>
                  )}
                </div>
              );
            })()}

          {exaResults && exaResults.results.length > 0 && (
            <ul className="space-y-3 pt-2 border-t">
              {exaResults.results.map((hit) => {
                const source = getHostname(hit.url);
                const snippets = jobSnippets(hit);
                const badges = jobBadges(hit);
                const published = formatPublishedDate(hit.publishedDate);
                const matchInfo = matchScores.get(hit.url);
                const jobLabel = cleanJobText(hit.title);
                return (
                  <li
                    key={hit.url}
                    className="group rounded-lg border bg-card p-4 text-sm transition-all duration-200 hover:border-primary/50 cursor-pointer"
                    onClick={() => {
                      setDetailHit(hit);
                      setDetailOpen(true);
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {hit.favicon ? (
                            <img
                              src={hit.favicon}
                              alt=""
                              className="h-5 w-5 rounded-sm"
                            />
                          ) : null}
                          <Badge
                            variant="outline"
                            className="max-w-[220px] truncate font-normal"
                          >
                            {source}
                          </Badge>
                          {hit.applyType === "ats" && (
                            <Badge
                              variant="secondary"
                              className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-[11px]"
                            >
                              Easy Apply
                            </Badge>
                          )}
                          {hit.salary && (
                            <Badge
                              variant="secondary"
                              className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-[11px]"
                            >
                              {hit.salary}
                            </Badge>
                          )}
                          {matchInfo &&
                            !matchInfo.loading &&
                            matchInfo.score > 0 && (
                              <Badge
                                variant="secondary"
                                className={
                                  matchInfo.score >= 70
                                    ? "text-green-700 bg-green-50 border-green-200"
                                    : matchInfo.score >= 45
                                      ? "text-amber-700 bg-amber-50 border-amber-200"
                                      : "text-red-700 bg-red-50 border-red-200"
                                }
                              >
                                {matchInfo.score}% match
                              </Badge>
                            )}
                          {published ? (
                            <span className="text-xs text-muted-foreground">
                              Posted {published}
                            </span>
                          ) : null}
                        </div>
                        <a
                          href={hit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-start gap-1.5 text-base font-semibold leading-snug text-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{cleanJobText(hit.title)}</span>
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                        </a>
                        {badges.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {badges.map((badge) => (
                              <Badge
                                key={`${hit.url}-${badge}`}
                                variant="secondary"
                                className="text-[11px] font-medium"
                              >
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!matchInfo && hasResumeText && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-[11px]"
                            onClick={() => onPreScreen(hit)}
                            aria-label={`Estimate match for ${jobLabel}`}
                          >
                            Match
                          </Button>
                        )}
                        {matchInfo?.loading && (
                          <span className="text-[11px] text-muted-foreground px-2">
                            ...
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onSaveJob(hit)}
                          title={`Save ${jobLabel}`}
                          aria-label={`Save ${jobLabel}`}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onImportJd(hit.url)}
                          disabled={isFetchJobPending}
                          aria-label={`Import job description for ${jobLabel}`}
                        >
                          {isFetchJobPending ? "..." : "Import JD"}
                        </Button>
                      </div>
                    </div>
                    {snippets.length > 0 ? (
                      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                        {snippets.map((snippet, i) => (
                          <p key={`${hit.url}-snippet-${i}`}>{snippet}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Click to view details, or import into the job
                        description form.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {exaResults && exaResults.results.length === 0 && (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              No results. Try a broader query or a different search mode.
            </p>
          )}

          {exaResults?.hasMore && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              <ChevronDown className="w-4 h-4 mr-1.5" />{" "}
              {loadingMore ? "Loading..." : "Load more results"}
            </Button>
          )}
        </div>
      </details>

      <JobDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        hit={detailHit}
        onImport={onImportJd}
        matchScore={
          detailHit ? (matchScores.get(detailHit.url)?.score ?? null) : null
        }
        matchLoading={
          detailHit ? (matchScores.get(detailHit.url)?.loading ?? false) : false
        }
      />
    </>
  );
}
