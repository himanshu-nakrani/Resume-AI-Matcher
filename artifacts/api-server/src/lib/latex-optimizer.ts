/**
 * Multi-Stage LaTeX Resume Optimizer
 * 
 * Implements the 6-stage optimization process:
 * 1. Structure Analysis - Parse and preserve LaTeX structure
 * 2. Content Extraction - Extract plain text content
 * 3. AI Optimization - Optimize content (plain text only)
 * 4. Reconstruction - Rebuild LaTeX with optimized content
 * 5. Validation - Check for errors
 * 6. Correction - Fix any issues found
 */

import type { OpenAI } from "@workspace/integrations-openai-ai-server";
import { FIREWORKS_DEFAULT_MODEL } from "@workspace/integrations-openai-ai-server";

type ChatCompletionCreateParamsNonStreaming = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
import { validateLatex, type ValidationResult } from "./latex-validator";
import {
  createStructurePreservationMap,
  reconstructLatex,
  extractPlainTextForOptimization,
  validateStructurePreservation,
  type StructurePreservationMap,
} from "./latex-structure-analyzer";
import { parseAiJson } from "./parse-ai-json";

export interface OptimizationContext {
  jobTitle: string;
  companyName: string | null;
  jobDescription: string;
  resumeText: string;
  targetKeywords: string[];
  gaps: string[];
}

export interface OptimizationResult {
  success: boolean;
  optimizedLatex: string;
  validationResult: ValidationResult;
  stages: {
    structureAnalysis: { success: boolean; error?: string };
    contentExtraction: { success: boolean; blockCount: number };
    aiOptimization: { success: boolean; optimizedBlocks: number };
    reconstruction: { success: boolean; structurePreserved: boolean };
    validation: { success: boolean; errorCount: number; warningCount: number };
    correction: { success: boolean; attempts: number };
  };
  metadata: {
    processingTimeMs: number;
    aiTokensUsed?: number;
    correctionAttempts: number;
  };
}

export interface AIClient {
  chat: {
    completions: {
      create: (params: ChatCompletionCreateParamsNonStreaming) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
        usage?: { total_tokens?: number };
      }>;
    };
  };
}

/**
 * Stage 1: Analyze structure and create preservation map
 */
async function stageStructureAnalysis(
  latex: string
): Promise<{ success: boolean; map?: StructurePreservationMap; error?: string }> {
  try {
    const map = createStructurePreservationMap(latex);
    return { success: true, map };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Structure analysis failed',
    };
  }
}

/**
 * Stage 2: Extract plain text content for optimization
 */
function stageContentExtraction(
  map: StructurePreservationMap
): { success: boolean; blocks: Array<{ id: string; type: string; text: string; context: string }>; blockCount: number } {
  const blocks = extractPlainTextForOptimization(map);
  return {
    success: true,
    blocks,
    blockCount: blocks.length,
  };
}

/**
 * Stage 3: AI optimization of plain text content
 */
async function stageAIOptimization(
  aiClient: AIClient,
  blocks: Array<{ id: string; type: string; text: string; context: string }>,
  context: OptimizationContext
): Promise<{ success: boolean; optimizedBlocks?: Map<string, string>; error?: string }> {
  try {
    // Build the optimization prompt
    const prompt = buildOptimizationPrompt(blocks, context);

    const completion = await aiClient.chat.completions.create({
      model: FIREWORKS_DEFAULT_MODEL,
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const optimizedData = parseAiJson<Record<string, string>>(content);

    // Convert to Map
    const optimizedBlocks = new Map<string, string>();
    for (const [id, text] of Object.entries(optimizedData)) {
      optimizedBlocks.set(id, text);
    }

    return { success: true, optimizedBlocks };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI optimization failed',
    };
  }
}

/**
 * Builds the AI optimization prompt (plain text only)
 */
function buildOptimizationPrompt(
  blocks: Array<{ id: string; type: string; text: string; context: string }>,
  context: OptimizationContext
): string {
  const blocksJson = JSON.stringify(blocks, null, 2);

  return `You are an expert resume content optimizer. Your task is to optimize resume content for ATS and impact.

**CRITICAL RULES:**
1. Return ONLY plain text content - NO LaTeX commands, NO formatting, NO special characters
2. Do NOT add \\textbf, \\textit, \\item, or any LaTeX syntax
3. Do NOT use special characters like &, %, $, #, _, {, }, ~, ^
4. Keep the same structure - if input is a bullet point, output is plain text for a bullet
5. Preserve all factual information - do NOT invent experience, dates, or metrics
6. Naturally incorporate relevant keywords where they genuinely fit
7. Use strong action verbs and quantify results where possible
8. Keep content concise and impactful

**Job Context:**
- Job Title: ${context.jobTitle}
- Company: ${context.companyName ?? 'Not specified'}
- Target Keywords: ${context.targetKeywords.slice(0, 10).join(', ')}
- Key Gaps to Address: ${context.gaps.slice(0, 5).join(', ')}

**Content Blocks to Optimize:**
${blocksJson}

**Output Format:**
Return ONLY a JSON object mapping block IDs to optimized plain text content:
{
  "block_0": "optimized plain text for block 0",
  "block_1": "optimized plain text for block 1",
  ...
}

**Example Input Block:**
{
  "id": "block_5",
  "type": "bullet",
  "text": "Worked on backend systems",
  "context": "Section: Experience"
}

**Example Output (CORRECT - plain text only):**
{
  "block_5": "Architected and deployed scalable microservices backend handling 50K+ daily transactions, reducing API response time by 40%"
}

**Example Output (WRONG - contains LaTeX):**
{
  "block_5": "\\textbf{Architected} and deployed scalable \\textit{microservices} backend..."
}

Remember: Return ONLY plain text content. The LaTeX formatting will be added programmatically during reconstruction.`;
}

/**
 * Stage 4: Reconstruct LaTeX with optimized content
 */
function stageReconstruction(
  map: StructurePreservationMap,
  optimizedBlocks: Map<string, string>,
  originalLatex: string
): { success: boolean; latex?: string; structurePreserved: boolean; differences?: string[] } {
  try {
    // Reconstruct with optimized content
    const reconstructed = reconstructLatex(map, optimizedBlocks);

    // Validate structure preservation
    const validation = validateStructurePreservation(originalLatex, reconstructed);

    return {
      success: true,
      latex: reconstructed,
      structurePreserved: validation.isValid,
      differences: validation.differences,
    };
  } catch (error) {
    return {
      success: false,
      structurePreserved: false,
    };
  }
}

/**
 * Stage 5: Validate the reconstructed LaTeX
 */
function stageValidation(latex: string): {
  success: boolean;
  result: ValidationResult;
  errorCount: number;
  warningCount: number;
} {
  const result = validateLatex(latex);

  return {
    success: result.isValid,
    result,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
  };
}

/**
 * Stage 6: Correct validation errors using AI
 */
async function stageCorrection(
  aiClient: AIClient,
  latex: string,
  validationResult: ValidationResult,
  context: OptimizationContext,
  maxAttempts: number = 2
): Promise<{ success: boolean; correctedLatex?: string; attempts: number }> {
  let currentLatex = latex;
  let attempts = 0;

  while (attempts < maxAttempts && !validationResult.isValid) {
    attempts++;

    try {
      const prompt = buildCorrectionPrompt(currentLatex, validationResult, context);

      const completion = await aiClient.chat.completions.create({
        model: FIREWORKS_DEFAULT_MODEL,
        max_completion_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const corrected = extractLatexFromResponse(content);

      // Validate the correction
      const newValidation = validateLatex(corrected);
      
      if (newValidation.isValid || newValidation.errors.length < validationResult.errors.length) {
        currentLatex = corrected;
        validationResult = newValidation;
        
        if (newValidation.isValid) {
          return { success: true, correctedLatex: currentLatex, attempts };
        }
      } else {
        // Correction made things worse, stop
        break;
      }
    } catch (error) {
      break;
    }
  }

  return {
    success: validationResult.isValid,
    correctedLatex: currentLatex,
    attempts,
  };
}

/**
 * Builds the correction prompt
 */
function buildCorrectionPrompt(
  latex: string,
  validationResult: ValidationResult,
  context: OptimizationContext
): string {
  const errorsList = validationResult.errors
    .map(e => `- [${e.type}] ${e.message}${e.line ? ` (line ${e.line})` : ''}${e.suggestion ? `\n  Suggestion: ${e.suggestion}` : ''}`)
    .join('\n');

  return `You are a LaTeX expert fixing compilation errors in a resume.

**Job Context:**
- Job Title: ${context.jobTitle}
- Company: ${context.companyName ?? 'Not specified'}

**Validation Errors Found:**
${errorsList}

**Current LaTeX:**
${latex}

**Instructions:**
1. Fix ALL validation errors listed above
2. Return a COMPLETE, compilable LaTeX document
3. Preserve all factual content about the candidate
4. Do NOT change the document structure or formatting style
5. Only fix the specific errors identified

**Output:**
Return ONLY the corrected LaTeX document as valid JSON:
{"latex": "<complete corrected LaTeX>"}`;
}

/**
 * Extracts LaTeX from AI response
 */
function extractLatexFromResponse(response: string): string {
  const trimmed = response.trim();
  
  // Try to parse as JSON first
  try {
    const parsed = parseAiJson<{ latex?: string }>(trimmed);
    if (typeof parsed.latex === 'string' && parsed.latex.trim()) {
      return parsed.latex.trim();
    }
  } catch {
    // Fall through to direct extraction
  }

  // Remove markdown code fences
  return trimmed
    .replace(/^```(?:latex|tex)?\s*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();
}

/**
 * Main optimization orchestrator
 */
export async function optimizeLatexResume(
  aiClient: AIClient,
  sourceLatex: string,
  context: OptimizationContext
): Promise<OptimizationResult> {
  const startTime = Date.now();
  const stages = {
    structureAnalysis: { success: false, error: undefined as string | undefined },
    contentExtraction: { success: false, blockCount: 0 },
    aiOptimization: { success: false, optimizedBlocks: 0 },
    reconstruction: { success: false, structurePreserved: false },
    validation: { success: false, errorCount: 0, warningCount: 0 },
    correction: { success: false, attempts: 0 },
  };

  try {
    // Stage 1: Structure Analysis
    const structureResult = await stageStructureAnalysis(sourceLatex);
    stages.structureAnalysis = {
      success: structureResult.success,
      error: structureResult.error,
    };

    if (!structureResult.success || !structureResult.map) {
      throw new Error(`Structure analysis failed: ${structureResult.error}`);
    }

    // Stage 2: Content Extraction
    const extractionResult = stageContentExtraction(structureResult.map);
    stages.contentExtraction = {
      success: extractionResult.success,
      blockCount: extractionResult.blockCount,
    };

    // Stage 3: AI Optimization
    const optimizationResult = await stageAIOptimization(
      aiClient,
      extractionResult.blocks,
      context
    );
    stages.aiOptimization = {
      success: optimizationResult.success,
      optimizedBlocks: optimizationResult.optimizedBlocks?.size ?? 0,
    };

    if (!optimizationResult.success || !optimizationResult.optimizedBlocks) {
      throw new Error(`AI optimization failed: ${optimizationResult.error}`);
    }

    // Stage 4: Reconstruction
    const reconstructionResult = stageReconstruction(
      structureResult.map,
      optimizationResult.optimizedBlocks,
      sourceLatex
    );
    stages.reconstruction = {
      success: reconstructionResult.success,
      structurePreserved: reconstructionResult.structurePreserved,
    };

    if (!reconstructionResult.success || !reconstructionResult.latex) {
      throw new Error('Reconstruction failed');
    }

    let finalLatex = reconstructionResult.latex;

    // Stage 5: Validation
    const validationResult = stageValidation(finalLatex);
    stages.validation = {
      success: validationResult.success,
      errorCount: validationResult.errorCount,
      warningCount: validationResult.warningCount,
    };

    // Stage 6: Correction (if needed)
    if (!validationResult.success && validationResult.errorCount > 0) {
      const correctionResult = await stageCorrection(
        aiClient,
        finalLatex,
        validationResult.result,
        context
      );
      stages.correction = {
        success: correctionResult.success,
        attempts: correctionResult.attempts,
      };

      if (correctionResult.success && correctionResult.correctedLatex) {
        finalLatex = correctionResult.correctedLatex;
      }
    } else {
      stages.correction = { success: true, attempts: 0 };
    }

    // Final validation
    const finalValidation = validateLatex(finalLatex);

    return {
      success: finalValidation.isValid,
      optimizedLatex: finalLatex,
      validationResult: finalValidation,
      stages,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        correctionAttempts: stages.correction.attempts,
      },
    };
  } catch (error) {
    // Return partial result with error information
    const errorValidation = validateLatex(sourceLatex);
    
    return {
      success: false,
      optimizedLatex: sourceLatex,
      validationResult: errorValidation,
      stages,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        correctionAttempts: 0,
      },
    };
  }
}

/**
 * Quick optimization check - validates if optimization is likely to succeed
 */
export function canOptimizeLatex(latex: string): { canOptimize: boolean; reason?: string } {
  // Check basic structure
  if (!/\\documentclass\b/.test(latex)) {
    return { canOptimize: false, reason: 'Missing \\documentclass' };
  }

  if (!/\\begin\{document\}/.test(latex)) {
    return { canOptimize: false, reason: 'Missing \\begin{document}' };
  }

  if (!/\\end\{document\}/.test(latex)) {
    return { canOptimize: false, reason: 'Missing \\end{document}' };
  }

  // Check for critical errors
  const validation = validateLatex(latex);
  const criticalErrors = validation.errors.filter(e => e.severity === 'error');

  if (criticalErrors.length > 10) {
    return {
      canOptimize: false,
      reason: `Too many critical errors (${criticalErrors.length}). Please fix major issues first.`,
    };
  }

  return { canOptimize: true };
}
