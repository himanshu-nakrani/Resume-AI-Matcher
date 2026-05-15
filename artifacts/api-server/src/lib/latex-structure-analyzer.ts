/**
 * LaTeX Structure Analyzer
 * 
 * Analyzes and extracts the structure of LaTeX resume documents.
 * Separates content from formatting to enable safe AI optimization.
 */

export interface LatexSection {
  type: 'section' | 'subsection' | 'item' | 'text' | 'command' | 'environment';
  name?: string;
  content: string;
  startLine: number;
  endLine: number;
  children?: LatexSection[];
  metadata?: Record<string, unknown>;
}

export interface LatexStructure {
  preamble: string;
  documentClass: string;
  packages: Array<{ name: string; options?: string }>;
  sections: LatexSection[];
  footer: string;
  metadata: {
    hasHeader: boolean;
    hasFooter: boolean;
    sectionCount: number;
    itemCount: number;
  };
}

export interface ContentBlock {
  id: string;
  type: 'heading' | 'bullet' | 'paragraph' | 'contact';
  plainText: string;
  originalLatex: string;
  context: {
    section?: string;
    subsection?: string;
    position: number;
  };
}

export interface StructurePreservationMap {
  structure: LatexStructure;
  contentBlocks: ContentBlock[];
  reconstructionTemplate: string;
}

/**
 * Extracts the preamble (everything before \begin{document})
 */
function extractPreamble(latex: string): { preamble: string; body: string } {
  const beginDocMatch = latex.match(/\\begin\{document\}/);
  if (!beginDocMatch) {
    return { preamble: '', body: latex };
  }

  const preambleEnd = beginDocMatch.index! + beginDocMatch[0].length;
  return {
    preamble: latex.slice(0, preambleEnd),
    body: latex.slice(preambleEnd),
  };
}

/**
 * Extracts document class
 */
function extractDocumentClass(preamble: string): string {
  const match = preamble.match(/\\documentclass(?:\[([^\]]*)\])?\{([^}]+)\}/);
  if (!match) return '';
  
  const options = match[1] ? `[${match[1]}]` : '';
  return `\\documentclass${options}{${match[2]}}`;
}

/**
 * Extracts all packages from preamble
 */
function extractPackages(preamble: string): Array<{ name: string; options?: string }> {
  const packages: Array<{ name: string; options?: string }> = [];
  const regex = /\\usepackage(?:\[([^\]]*)\])?\{([^}]+)\}/g;
  
  let match;
  while ((match = regex.exec(preamble)) !== null) {
    const options = match[1] || undefined;
    const names = match[2].split(',').map(n => n.trim());
    
    for (const name of names) {
      packages.push({ name, options });
    }
  }
  
  return packages;
}

/**
 * Extracts sections from document body
 */
function extractSections(body: string): LatexSection[] {
  const sections: LatexSection[] = [];
  const lines = body.split('\n');
  
  let currentSection: LatexSection | null = null;
  let currentSubsection: LatexSection | null = null;
  let lineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNum = i + 1;

    // Skip comments and empty lines
    if (line.trim().startsWith('%') || line.trim() === '') continue;

    // Check for \end{document}
    if (/\\end\{document\}/.test(line)) break;

    // Check for section
    const sectionMatch = line.match(/\\section\*?\{([^}]+)\}/);
    if (sectionMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endLine = lineNum - 1;
        sections.push(currentSection);
      }

      currentSection = {
        type: 'section',
        name: sectionMatch[1],
        content: line,
        startLine: lineNum,
        endLine: lineNum,
        children: [],
      };
      currentSubsection = null;
      continue;
    }

    // Check for subsection
    const subsectionMatch = line.match(/\\subsection\*?\{([^}]+)\}/);
    if (subsectionMatch) {
      const subsection: LatexSection = {
        type: 'subsection',
        name: subsectionMatch[1],
        content: line,
        startLine: lineNum,
        endLine: lineNum,
        children: [],
      };

      if (currentSection) {
        currentSection.children!.push(subsection);
        currentSubsection = subsection;
      } else {
        sections.push(subsection);
        currentSubsection = subsection;
      }
      continue;
    }

    // Check for itemize/enumerate environments
    const beginItemMatch = line.match(/\\begin\{(itemize|enumerate)\}/);
    if (beginItemMatch) {
      const envType = beginItemMatch[1];
      const items: string[] = [];
      let envEndLine = lineNum;

      // Collect all items in this environment
      for (let j = i + 1; j < lines.length; j++) {
        const itemLine = lines[j];
        if (/\\end\{(itemize|enumerate)\}/.test(itemLine)) {
          envEndLine = j + 1;
          i = j;
          break;
        }
        if (itemLine.trim().startsWith('\\item')) {
          items.push(itemLine);
        }
      }

      const envSection: LatexSection = {
        type: 'environment',
        name: envType,
        content: items.join('\n'),
        startLine: lineNum,
        endLine: envEndLine,
        children: items.map((item, idx) => ({
          type: 'item',
          content: item,
          startLine: lineNum + idx + 1,
          endLine: lineNum + idx + 1,
        })),
      };

      if (currentSubsection) {
        currentSubsection.children!.push(envSection);
      } else if (currentSection) {
        currentSection.children!.push(envSection);
      } else {
        sections.push(envSection);
      }
      continue;
    }

    // Regular text content
    if (line.trim() && !line.trim().startsWith('\\')) {
      const textSection: LatexSection = {
        type: 'text',
        content: line,
        startLine: lineNum,
        endLine: lineNum,
      };

      if (currentSubsection) {
        currentSubsection.children!.push(textSection);
      } else if (currentSection) {
        currentSection.children!.push(textSection);
      } else {
        sections.push(textSection);
      }
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.endLine = lineNum;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Converts LaTeX to plain text by removing commands and formatting
 */
function latexToPlainText(latex: string): string {
  return latex
    // Remove comments
    .replace(/%.*$/gm, '')
    // Remove common formatting commands but keep content
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    .replace(/\\textit\{([^}]+)\}/g, '$1')
    .replace(/\\emph\{([^}]+)\}/g, '$1')
    .replace(/\\underline\{([^}]+)\}/g, '$1')
    .replace(/\\texttt\{([^}]+)\}/g, '$1')
    // Remove href but keep link text
    .replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1')
    .replace(/\\url\{([^}]+)\}/g, '$1')
    // Remove item markers
    .replace(/\\item\s*/g, '• ')
    // Remove other common commands
    .replace(/\\[a-zA-Z]+\*?\{([^}]+)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\*?\s+/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts content blocks for AI optimization
 */
function extractContentBlocks(sections: LatexSection[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let blockId = 0;

  function processSection(section: LatexSection, context: { section?: string; subsection?: string }) {
    const newContext = { ...context };

    if (section.type === 'section') {
      newContext.section = section.name;
      newContext.subsection = undefined;
    } else if (section.type === 'subsection') {
      newContext.subsection = section.name;
    }

    // Extract content from this section
    if (section.type === 'section' || section.type === 'subsection') {
      blocks.push({
        id: `block_${blockId++}`,
        type: 'heading',
        plainText: section.name || '',
        originalLatex: section.content,
        context: { ...newContext, position: blocks.length },
      });
    } else if (section.type === 'item') {
      const plainText = latexToPlainText(section.content);
      blocks.push({
        id: `block_${blockId++}`,
        type: 'bullet',
        plainText,
        originalLatex: section.content,
        context: { ...newContext, position: blocks.length },
      });
    } else if (section.type === 'text') {
      const plainText = latexToPlainText(section.content);
      if (plainText.length > 0) {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'paragraph',
          plainText,
          originalLatex: section.content,
          context: { ...newContext, position: blocks.length },
        });
      }
    }

    // Process children
    if (section.children) {
      for (const child of section.children) {
        processSection(child, newContext);
      }
    }
  }

  for (const section of sections) {
    processSection(section, {});
  }

  return blocks;
}

/**
 * Creates a reconstruction template with placeholders
 */
function createReconstructionTemplate(
  structure: LatexStructure,
  contentBlocks: ContentBlock[]
): string {
  const lines: string[] = [];

  // Add preamble
  lines.push(structure.preamble);
  lines.push('');

  // Add content with placeholders
  for (const block of contentBlocks) {
    lines.push(`{{${block.id}}}`);
  }

  // Add footer
  lines.push('');
  lines.push(structure.footer);

  return lines.join('\n');
}

/**
 * Main structure analysis function
 */
export function analyzeLatexStructure(latex: string): LatexStructure {
  const { preamble, body } = extractPreamble(latex);
  const documentClass = extractDocumentClass(preamble);
  const packages = extractPackages(preamble);
  const sections = extractSections(body);

  // Extract footer (everything after last section until \end{document})
  const endDocMatch = latex.match(/\\end\{document\}/);
  const footer = endDocMatch ? latex.slice(endDocMatch.index!) : '\\end{document}';

  // Calculate metadata
  let itemCount = 0;
  function countItems(section: LatexSection) {
    if (section.type === 'item') itemCount++;
    if (section.children) {
      section.children.forEach(countItems);
    }
  }
  sections.forEach(countItems);

  return {
    preamble,
    documentClass,
    packages,
    sections,
    footer,
    metadata: {
      hasHeader: /\\fancyhead/.test(preamble) || /\\lhead/.test(preamble),
      hasFooter: /\\fancyfoot/.test(preamble) || /\\lfoot/.test(preamble),
      sectionCount: sections.filter(s => s.type === 'section').length,
      itemCount,
    },
  };
}

/**
 * Creates a structure preservation map for safe optimization
 */
export function createStructurePreservationMap(latex: string): StructurePreservationMap {
  const structure = analyzeLatexStructure(latex);
  const contentBlocks = extractContentBlocks(structure.sections);
  const reconstructionTemplate = createReconstructionTemplate(structure, contentBlocks);

  return {
    structure,
    contentBlocks,
    reconstructionTemplate,
  };
}

/**
 * Reconstructs LaTeX from optimized content blocks
 */
export function reconstructLatex(
  preservationMap: StructurePreservationMap,
  optimizedBlocks: Map<string, string>
): string {
  let result = preservationMap.reconstructionTemplate;

  // Replace placeholders with optimized content
  for (const block of preservationMap.contentBlocks) {
    const optimizedContent = optimizedBlocks.get(block.id);
    if (optimizedContent !== undefined) {
      result = result.replace(`{{${block.id}}}`, optimizedContent);
    } else {
      // Fallback to original if optimization failed
      result = result.replace(`{{${block.id}}}`, block.originalLatex);
    }
  }

  return result;
}

/**
 * Extracts plain text content for AI optimization
 */
export function extractPlainTextForOptimization(
  preservationMap: StructurePreservationMap
): Array<{ id: string; type: string; text: string; context: string }> {
  return preservationMap.contentBlocks.map(block => ({
    id: block.id,
    type: block.type,
    text: block.plainText,
    context: [
      block.context.section && `Section: ${block.context.section}`,
      block.context.subsection && `Subsection: ${block.context.subsection}`,
    ].filter(Boolean).join(', '),
  }));
}

/**
 * Validates that structure is preserved after reconstruction
 */
export function validateStructurePreservation(
  original: string,
  reconstructed: string
): { isValid: boolean; differences: string[] } {
  const originalStructure = analyzeLatexStructure(original);
  const reconstructedStructure = analyzeLatexStructure(reconstructed);

  const differences: string[] = [];

  // Check document class
  if (originalStructure.documentClass !== reconstructedStructure.documentClass) {
    differences.push('Document class changed');
  }

  // Check package count
  if (originalStructure.packages.length !== reconstructedStructure.packages.length) {
    differences.push(`Package count changed: ${originalStructure.packages.length} → ${reconstructedStructure.packages.length}`);
  }

  // Check section count
  if (originalStructure.metadata.sectionCount !== reconstructedStructure.metadata.sectionCount) {
    differences.push(`Section count changed: ${originalStructure.metadata.sectionCount} → ${reconstructedStructure.metadata.sectionCount}`);
  }

  // Check preamble structure (should be identical)
  const originalPreambleLines = originalStructure.preamble.split('\n').filter(l => l.trim());
  const reconstructedPreambleLines = reconstructedStructure.preamble.split('\n').filter(l => l.trim());
  
  if (originalPreambleLines.length !== reconstructedPreambleLines.length) {
    differences.push('Preamble structure changed');
  }

  return {
    isValid: differences.length === 0,
    differences,
  };
}
