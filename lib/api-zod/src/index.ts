// Re-export Zod schemas (runtime values, used by api-server via `.safeParse()`).
export * from "./generated/api";

// Re-export Orval-generated TS types, EXCEPT the six whose names collide with the
// Zod schemas above. For those names, consumers should use `z.infer<typeof X>` or
// the `*Type` aliases re-exported at the bottom of this file.
//
// Replicating Orval's `generated/types/index.ts` minus the colliders:
export * from "./generated/types/analysis";
export * from "./generated/types/analysisOriginalFileType";
export * from "./generated/types/analysisStats";
export * from "./generated/types/analysisStatus";
export * from "./generated/types/createAnalysisBodyOriginalFileType";
export * from "./generated/types/enrichJobBody";
export * from "./generated/types/enrichJobResponse";
export * from "./generated/types/errorResponse";
export * from "./generated/types/fetchJobBody";
export * from "./generated/types/fetchJobResponse";
export * from "./generated/types/generatedContent";
export * from "./generated/types/healthStatus";
export * from "./generated/types/jobSearchAnalysis";
export * from "./generated/types/jobSearchAnalysisEffectiveSearchType";
export * from "./generated/types/jobSearchBody";
export * from "./generated/types/jobSearchBodyFilters";
export * from "./generated/types/jobSearchBodyFiltersCompanySize";
export * from "./generated/types/jobSearchBodyFiltersExperienceLevel";
export * from "./generated/types/jobSearchBodyFiltersJobType";
export * from "./generated/types/jobSearchBodyFiltersRemote";
export * from "./generated/types/jobSearchBodySearchType";
export * from "./generated/types/jobSearchHit";
export * from "./generated/types/jobSearchHitApplyType";
export * from "./generated/types/jobSearchResponse";
export * from "./generated/types/notification";
export * from "./generated/types/notificationType";
export * from "./generated/types/searchMetadata";
export * from "./generated/types/searchMetadataApplyTypeBreakdown";
export * from "./generated/types/searchMetadataRankingStats";
export * from "./generated/types/shareResponse";
export * from "./generated/types/updateAnalysisBodyStatus";

// Aliased TS interfaces for the six conflicting names. Consumers that need the
// structural TS interface (rather than `z.infer` of the Zod schema) can import
// these explicitly. In practice they're rarely needed — most code reaches for
// the Zod schema's inferred type instead.
export type { CreateAnalysisBody as CreateAnalysisBodyType } from "./generated/types/createAnalysisBody";
export type { GenerateCoverLetterBody as GenerateCoverLetterBodyType } from "./generated/types/generateCoverLetterBody";
export type { MarkNotificationReadParams as MarkNotificationReadParamsType } from "./generated/types/markNotificationReadParams";
export type { RewriteBulletBody as RewriteBulletBodyType } from "./generated/types/rewriteBulletBody";
export type { RewriteBulletResponse as RewriteBulletResponseType } from "./generated/types/rewriteBulletResponse";
export type { UpdateAnalysisBody as UpdateAnalysisBodyType } from "./generated/types/updateAnalysisBody";
