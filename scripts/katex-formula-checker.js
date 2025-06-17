#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ψ-collapse detection patterns
const MATH_PATTERNS = [
  // Block math: $$ ... $$
  /\$\$([\s\S]*?)\$\$/g,
  // Inline math: $ ... $ (but not escaped \$ or in code blocks)
  /(?<!\\)\$(?!\$)((?:[^$\r\n\\]|\\.)*)(?<!\\)\$/g
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

class KatexFormulaChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.totalFormulas = 0;
  }

  // ψ-scan: recursive file discovery
  scanFiles(pattern = 'docs/**/*.md') {
    try {
      return glob.sync(pattern, { 
        ignore: ['**/node_modules/**', '**/build/**', '**/.git/**']
      });
    } catch (error) {
      console.error(`${colors.red}✗ Error scanning files: ${error.message}${colors.reset}`);
      return [];
    }
  }

  // ψ-parse: extract mathematical formulas
  extractFormulas(content, filePath) {
    const formulas = [];
    
    MATH_PATTERNS.forEach((pattern, patternIndex) => {
      let match;
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(content)) !== null) {
        const formula = match[1] || match[0];
        const startPos = match.index;
        const lineNumber = this.getLineNumber(content, startPos);
        
        formulas.push({
          content: formula,
          type: patternIndex === 0 ? 'block' : 'inline',
          line: lineNumber,
          file: filePath,
          startPos,
          endPos: startPos + match[0].length
        });
        
        this.totalFormulas++;
      }
    });
    
    return formulas;
  }

  // ψ-locate: find line numbers for error reporting
  getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
  }

  // ψ-validate: check for problematic symbols
  validateFormula(formula) {
    const issues = [];
    
    // Check for '&' symbol (causes KaTeX errors in Docusaurus)
    if (formula.content.includes('&')) {
      issues.push({
        type: 'error',
        symbol: '&',
        message: 'Ampersand (&) symbol found in formula - this causes KaTeX compilation errors',
        suggestion: 'Use matrix environments without & or escape properly'
      });
    }
    
    // Check for other potentially problematic patterns
    const problematicPatterns = [
      //{ pattern: /\\\\(?!\s*\]|\s*\}|\s*$)/, symbol: '\\\\', message: 'Double backslash may cause issues outside matrix contexts' },
      { pattern: /\$\$.*\$\$/, symbol: '$$', message: 'Nested $$ delimiters detected' },
      { pattern: /\\begin\{([^}]+)\}(?![^]*\\end\{\1\})/, symbol: '\\begin{}', message: 'Unmatched \\begin{} without corresponding \\end{}' }
    ];
    
    problematicPatterns.forEach(({ pattern, symbol, message }) => {
      if (pattern.test(formula.content)) {
        issues.push({
          type: 'warning',
          symbol,
          message,
          suggestion: 'Review formula structure'
        });
      }
    });
    
    return issues;
  }

  // ψ-analyze: process single file
  checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const formulas = this.extractFormulas(content, filePath);
      
      formulas.forEach(formula => {
        const issues = this.validateFormula(formula);
        
        issues.forEach(issue => {
          const errorData = {
            file: filePath,
            line: formula.line,
            type: formula.type,
            formula: formula.content.trim(),
            issue: issue
          };
          
          if (issue.type === 'error') {
            this.errors.push(errorData);
          } else {
            this.warnings.push(errorData);
          }
        });
      });
      
      return { formulas: formulas.length, errors: 0, warnings: 0 };
    } catch (error) {
      console.error(`${colors.red}✗ Error reading file ${filePath}: ${error.message}${colors.reset}`);
      return { formulas: 0, errors: 1, warnings: 0 };
    }
  }

  // ψ-report: display results
  generateReport() {
    console.log(`\n${colors.bold}${colors.cyan}=== KaTeX Formula Checker Report ===${colors.reset}`);
    console.log(`Total formulas scanned: ${colors.bold}${this.totalFormulas}${colors.reset}`);
    
    if (this.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}✗ ERRORS (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error, index) => {
        console.log(`\n${colors.red}${index + 1}. ${error.file}:${error.line}${colors.reset}`);
        console.log(`   ${colors.yellow}Type:${colors.reset} ${error.type} formula`);
        console.log(`   ${colors.yellow}Issue:${colors.reset} ${error.issue.message}`);
        console.log(`   ${colors.yellow}Symbol:${colors.reset} '${error.issue.symbol}'`);
        console.log(`   ${colors.yellow}Suggestion:${colors.reset} ${error.issue.suggestion}`);
        console.log(`   ${colors.yellow}Formula:${colors.reset} ${error.formula.substring(0, 100)}${error.formula.length > 100 ? '...' : ''}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bold}⚠ WARNINGS (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning, index) => {
        console.log(`\n${colors.yellow}${index + 1}. ${warning.file}:${warning.line}${colors.reset}`);
        console.log(`   Issue: ${warning.issue.message}`);
        console.log(`   Formula: ${warning.formula.substring(0, 80)}${warning.formula.length > 80 ? '...' : ''}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(`\n${colors.green}${colors.bold}✓ All formulas passed validation!${colors.reset}`);
    }
    
    console.log(`\n${colors.cyan}ψ-scan complete.${colors.reset}`);
    
    // Return exit code
    return this.errors.length > 0 ? 1 : 0;
  }

  // ψ-execute: main scanning process
  run(pattern) {
    console.log(`${colors.cyan}${colors.bold}Scanning for KaTeX formulas...${colors.reset}`);
    
    const files = this.scanFiles(pattern);
    console.log(`Found ${files.length} markdown files to scan`);
    
    files.forEach(file => {
      process.stdout.write(`${colors.cyan}.${colors.reset}`);
      this.checkFile(file);
    });
    
    console.log(); // New line after dots
    
    const exitCode = this.generateReport();
    
    if (this.errors.length > 0) {
      console.log(`\n${colors.red}${colors.bold}Build should FAIL due to KaTeX formula errors.${colors.reset}`);
      process.exit(exitCode);
    }
    
    return exitCode;
  }
}

// ψ-main: entry point
if (require.main === module) {
  const checker = new KatexFormulaChecker();
  const pattern = process.argv[2] || 'docs/**/*.md';
  
  console.log(`${colors.bold}KaTeX Formula Checker${colors.reset}`);
  console.log(`Pattern: ${pattern}`);
  
  checker.run(pattern);
}

module.exports = KatexFormulaChecker; 