/**
 * LaTeX Validation Library
 * 
 * Provides comprehensive validation for LaTeX resume documents including:
 * - Syntax validation (balanced braces, environments, commands)
 * - Structure validation (document class, begin/end document)
 * - ATS-friendly pattern checking
 * - Special character escaping validation
 * - Package compatibility checks
 */

export interface ValidationError {
  type: 'syntax' | 'structure' | 'ats' | 'character' | 'package' | 'warning';
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  context?: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    totalLines: number;
    braceBalance: number;
    environmentCount: number;
    commandCount: number;
  };
}

/**
 * Validates balanced braces in LaTeX content
 */
function validateBraceBalance(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = latex.split('\n');
  let globalBalance = 0;
  const stack: Array<{ char: string; line: number; col: number }> = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let inComment = false;

    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const prevChar = col > 0 ? line[col - 1] : '';

      // Skip comments
      if (char === '%' && prevChar !== '\\') {
        inComment = true;
        break;
      }

      if (inComment) continue;

      // Skip escaped braces
      if (prevChar === '\\' && (char === '{' || char === '}')) {
        continue;
      }

      if (char === '{' && prevChar !== '\\') {
        globalBalance++;
        stack.push({ char: '{', line: lineNum + 1, col: col + 1 });
      } else if (char === '}' && prevChar !== '\\') {
        globalBalance--;
        if (stack.length > 0) {
          stack.pop();
        } else {
          errors.push({
            type: 'syntax',
            severity: 'error',
            message: 'Unmatched closing brace',
            line: lineNum + 1,
            column: col + 1,
            context: line.trim(),
            suggestion: 'Remove this closing brace or add a matching opening brace',
          });
        }
      }
    }
  }

  // Report unclosed braces
  if (stack.length > 0) {
    for (const brace of stack) {
      errors.push({
        type: 'syntax',
        severity: 'error',
        message: 'Unclosed opening brace',
        line: brace.line,
        column: brace.col,
        suggestion: 'Add a matching closing brace',
      });
    }
  }

  return errors;
}

/**
 * Validates LaTeX environments (begin/end pairs)
 */
function validateEnvironments(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = latex.split('\n');
  const envStack: Array<{ name: string; line: number }> = [];

  const beginRegex = /\\begin\{([^}]+)\}/g;
  const endRegex = /\\end\{([^}]+)\}/g;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comments
    if (line.trim().startsWith('%')) continue;

    // Find all \begin commands
    let match;
    while ((match = beginRegex.exec(line)) !== null) {
      envStack.push({ name: match[1], line: lineNum + 1 });
    }

    // Find all \end commands
    beginRegex.lastIndex = 0; // Reset regex
    while ((match = endRegex.exec(line)) !== null) {
      const envName = match[1];
      if (envStack.length === 0) {
        errors.push({
          type: 'syntax',
          severity: 'error',
          message: `Unmatched \\end{${envName}}`,
          line: lineNum + 1,
          context: line.trim(),
          suggestion: `Add a matching \\begin{${envName}} before this line`,
        });
      } else {
        const lastEnv = envStack.pop()!;
        if (lastEnv.name !== envName) {
          errors.push({
            type: 'syntax',
            severity: 'error',
            message: `Environment mismatch: \\begin{${lastEnv.name}} closed with \\end{${envName}}`,
            line: lineNum + 1,
            context: line.trim(),
            suggestion: `Change to \\end{${lastEnv.name}} or fix the \\begin command at line ${lastEnv.line}`,
          });
        }
      }
    }
  }

  // Report unclosed environments
  for (const env of envStack) {
    errors.push({
      type: 'syntax',
      severity: 'error',
      message: `Unclosed environment: \\begin{${env.name}}`,
      line: env.line,
      suggestion: `Add \\end{${env.name}} before the end of the document`,
    });
  }

  return errors;
}

/**
 * Validates document structure (documentclass, begin/end document)
 */
function validateDocumentStructure(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for \documentclass
  if (!/\\documentclass\b/.test(latex)) {
    errors.push({
      type: 'structure',
      severity: 'error',
      message: 'Missing \\documentclass command',
      suggestion: 'Add \\documentclass{article} or similar at the beginning of the document',
    });
  }

  // Check for \begin{document}
  if (!/\\begin\{document\}/.test(latex)) {
    errors.push({
      type: 'structure',
      severity: 'error',
      message: 'Missing \\begin{document}',
      suggestion: 'Add \\begin{document} after the preamble',
    });
  }

  // Check for \end{document}
  if (!/\\end\{document\}/.test(latex)) {
    errors.push({
      type: 'structure',
      severity: 'error',
      message: 'Missing \\end{document}',
      suggestion: 'Add \\end{document} at the end of the document',
    });
  }

  // Check order: documentclass should come before begin{document}
  const docclassMatch = latex.match(/\\documentclass/);
  const beginDocMatch = latex.match(/\\begin\{document\}/);
  if (docclassMatch && beginDocMatch) {
    if (docclassMatch.index! > beginDocMatch.index!) {
      errors.push({
        type: 'structure',
        severity: 'error',
        message: '\\documentclass must come before \\begin{document}',
        suggestion: 'Move \\documentclass to the beginning of the file',
      });
    }
  }

  return errors;
}

/**
 * Validates special character escaping
 */
function validateSpecialCharacters(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = latex.split('\n');

  // Characters that should be escaped in LaTeX
  const specialChars = ['&', '%', '$', '#', '_', '{', '}', '~', '^'];
  const specialCharRegex = /[&%$#_{}~^]/g;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comments
    if (line.trim().startsWith('%')) continue;

    // Skip lines that are likely in verbatim or code environments
    if (/\\begin\{(verbatim|lstlisting|minted)\}/.test(line)) continue;

    let match;
    while ((match = specialCharRegex.exec(line)) !== null) {
      const char = match[0];
      const col = match.index;
      const prevChar = col > 0 ? line[col - 1] : '';

      // Check if character is escaped
      if (prevChar !== '\\') {
        // Some characters are OK in certain contexts
        if (char === '&' && /\\begin\{(tabular|array)/.test(latex.slice(0, latex.indexOf(line)))) {
          continue; // & is OK in tables
        }

        errors.push({
          type: 'character',
          severity: 'warning',
          message: `Unescaped special character '${char}'`,
          line: lineNum + 1,
          column: col + 1,
          context: line.trim(),
          suggestion: `Escape with backslash: \\${char}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validates LaTeX commands syntax
 */
function validateCommands(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = latex.split('\n');

  // Common LaTeX commands that require arguments
  const commandsRequiringArgs = [
    'textbf', 'textit', 'emph', 'section', 'subsection',
    'title', 'author', 'date', 'usepackage', 'documentclass',
    'href', 'url', 'cite', 'ref', 'label'
  ];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comments
    if (line.trim().startsWith('%')) continue;

    for (const cmd of commandsRequiringArgs) {
      const regex = new RegExp(`\\\\${cmd}(?!\\{)`, 'g');
      let match;
      while ((match = regex.exec(line)) !== null) {
        errors.push({
          type: 'syntax',
          severity: 'error',
          message: `Command \\${cmd} requires arguments`,
          line: lineNum + 1,
          column: match.index + 1,
          context: line.trim(),
          suggestion: `Add braces: \\${cmd}{...}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Checks for problematic packages that may cause compilation issues
 */
function validatePackages(latex: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Packages that are problematic with Tectonic/XeTeX
  const problematicPackages = [
    { name: 'fontawesome5', reason: 'May cause compilation errors with Tectonic', alternative: 'Use plain text or fontawesome' },
    { name: 'pdfpages', reason: 'Not supported in XeTeX', alternative: 'Remove or use alternative' },
    { name: 'pstricks', reason: 'Not compatible with XeTeX', alternative: 'Use TikZ instead' },
  ];

  // pdfTeX-specific commands
  const pdftexCommands = [
    { cmd: 'pdfgentounicode', reason: 'pdfTeX-only command, not supported in XeTeX/Tectonic' },
    { cmd: 'glyphtounicode', reason: 'pdfTeX-only command, not supported in XeTeX/Tectonic' },
  ];

  for (const pkg of problematicPackages) {
    const regex = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{${pkg.name}\\}`, 'g');
    if (regex.test(latex)) {
      errors.push({
        type: 'package',
        severity: 'warning',
        message: `Package '${pkg.name}' may cause issues: ${pkg.reason}`,
        suggestion: pkg.alternative,
      });
    }
  }

  for (const cmd of pdftexCommands) {
    const regex = new RegExp(`\\\\${cmd.cmd}\\b`, 'g');
    if (regex.test(latex)) {
      errors.push({
        type: 'package',
        severity: 'warning',
        message: `Command \\${cmd.cmd} is not supported: ${cmd.reason}`,
        suggestion: 'Remove this command',
      });
    }
  }

  return errors;
}

/**
 * Checks for ATS-unfriendly patterns
 */
function validateATSFriendliness(latex: string): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Check for complex formatting that ATS may not parse
  const atsUnfriendlyPatterns = [
    { pattern: /\\rotatebox/g, message: 'Rotated text may not be parsed by ATS' },
    { pattern: /\\scalebox/g, message: 'Scaled text may not be parsed correctly by ATS' },
    { pattern: /\\colorbox/g, message: 'Colored backgrounds may reduce ATS readability' },
    { pattern: /\\fcolorbox/g, message: 'Colored boxes may reduce ATS readability' },
    { pattern: /\\includegraphics/g, message: 'Images are typically ignored by ATS' },
    { pattern: /\\begin\{picture\}/g, message: 'Picture environments are not ATS-friendly' },
  ];

  for (const { pattern, message } of atsUnfriendlyPatterns) {
    if (pattern.test(latex)) {
      warnings.push({
        type: 'ats',
        severity: 'warning',
        message,
        suggestion: 'Consider using simpler formatting for better ATS compatibility',
      });
    }
  }

  // Check for excessive use of custom commands
  const customCommandCount = (latex.match(/\\newcommand/g) || []).length;
  if (customCommandCount > 5) {
    warnings.push({
      type: 'ats',
      severity: 'warning',
      message: `Document contains ${customCommandCount} custom commands`,
      suggestion: 'Excessive custom commands may reduce ATS compatibility',
    });
  }

  return warnings;
}

/**
 * Main validation function
 */
export function validateLatex(latex: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Run all validation checks
  errors.push(...validateBraceBalance(latex));
  errors.push(...validateEnvironments(latex));
  errors.push(...validateDocumentStructure(latex));
  errors.push(...validateCommands(latex));
  
  const charErrors = validateSpecialCharacters(latex);
  warnings.push(...charErrors);
  
  const pkgErrors = validatePackages(latex);
  warnings.push(...pkgErrors);
  
  const atsWarnings = validateATSFriendliness(latex);
  warnings.push(...atsWarnings);

  // Calculate stats
  const lines = latex.split('\n');
  const braceBalance = (latex.match(/(?<!\\)\{/g) || []).length - (latex.match(/(?<!\\)\}/g) || []).length;
  const environmentCount = (latex.match(/\\begin\{/g) || []).length;
  const commandCount = (latex.match(/\\[a-zA-Z]+/g) || []).length;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalLines: lines.length,
      braceBalance,
      environmentCount,
      commandCount,
    },
  };
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('ERRORS:');
    for (const error of result.errors) {
      const location = error.line ? ` (line ${error.line}${error.column ? `, col ${error.column}` : ''})` : '';
      lines.push(`  [${error.type}] ${error.message}${location}`);
      if (error.context) {
        lines.push(`    Context: ${error.context}`);
      }
      if (error.suggestion) {
        lines.push(`    Suggestion: ${error.suggestion}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWARNINGS:');
    for (const warning of result.warnings) {
      const location = warning.line ? ` (line ${warning.line}${warning.column ? `, col ${warning.column}` : ''})` : '';
      lines.push(`  [${warning.type}] ${warning.message}${location}`);
      if (warning.suggestion) {
        lines.push(`    Suggestion: ${warning.suggestion}`);
      }
    }
  }

  lines.push('\nSTATS:');
  lines.push(`  Total lines: ${result.stats.totalLines}`);
  lines.push(`  Brace balance: ${result.stats.braceBalance}`);
  lines.push(`  Environments: ${result.stats.environmentCount}`);
  lines.push(`  Commands: ${result.stats.commandCount}`);

  return lines.join('\n');
}

/**
 * Quick validation check - returns true if LaTeX is valid
 */
export function isValidLatex(latex: string): boolean {
  const result = validateLatex(latex);
  return result.isValid;
}
