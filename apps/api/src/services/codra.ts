export interface CodeIssue {
  line: number
  column?: number
  rule: string
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

export interface ReviewResult {
  issues: CodeIssue[]
  score: number
  summary: string
  rulesChecked: string[]
}

interface Rule {
  name: string
  description: string
  detect: (lines: string[], language: string) => CodeIssue[]
}

const noRawLoops: Rule = {
  name: 'no-raw-loops',
  description: 'Catch hand-written loops that duplicate standard library algorithms',
  detect: (lines, language) => {
    const issues: CodeIssue[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // C++/Java/JS for loops
      if (/\b(for|while)\s*\(/.test(trimmed)) {
        // Check if it's a simple iteration pattern
        if (/for\s*\(\s*(int|let|var|const|auto)\s+\w+\s*=\s*0\s*;/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'no-raw-loops',
            severity: 'warning',
            message: 'Raw loop detected. Consider using std::for_each, std::transform, std::accumulate, or range-based for.',
            suggestion: language === 'cpp' ? 'Use std::transform or std::for_each' : 'Use array methods (map, forEach, reduce)',
          })
        }
        
        // While true loops
        if (/while\s*\(\s*true\s*\)/.test(trimmed) || /while\s*\(\s*1\s*\)/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'no-raw-loops',
            severity: 'info',
            message: 'Infinite loop detected. Consider using std::ranges or structured iteration.',
          })
        }
      }
      
      // Manual string concatenation in loops
      if (/\+\=/.test(trimmed) && /\bfor\b/.test(lines.slice(Math.max(0, i - 2), i + 1).join('\n'))) {
        if (/\bstring\b|\bstr\b|\btext\b|\bresult\b/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'no-raw-loops',
            severity: 'warning',
            message: 'Manual string concatenation in loop. Consider using std::ostringstream, StringBuilder, or join().',
            suggestion: 'Use std::ostringstream (C++) or Array.join() (JS)',
          })
        }
      }
    }
    
    return issues
  },
}

const offByOne: Rule = {
  name: 'off-by-one',
  description: 'Detect common boundary errors',
  detect: (lines) => {
    const issues: CodeIssue[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Array access with potential off-by-one
      if (/\w+\s*\[\s*\w+\s*\+\s*1\s*\]/.test(trimmed) && /\bfor\b/.test(lines.slice(Math.max(0, i - 3), i + 1).join('\n'))) {
        issues.push({
          line: i + 1,
          rule: 'off-by-one',
          severity: 'warning',
          message: 'Array access with +1 in loop. Verify boundary condition.',
        })
      }
      
      // Length comparison issues
      if (/[<>]=?\s*\w+\.length\s*[-+]\s*1/.test(trimmed)) {
        issues.push({
          line: i + 1,
          rule: 'off-by-one',
          severity: 'info',
          message: 'Boundary comparison with ±1. Double-check loop termination.',
        })
      }
    }
    
    return issues
  },
}

const modernize: Rule = {
  name: 'modernize',
  description: 'Suggest modern language alternatives',
  detect: (lines, language) => {
    const issues: CodeIssue[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      if (language === 'cpp') {
        // NULL vs nullptr
        if (/\bNULL\b/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'modernize',
            severity: 'info',
            message: 'Use nullptr instead of NULL in C++.',
            suggestion: 'Replace NULL with nullptr',
          })
        }
        
        // Raw pointers vs smart pointers
        if (/\bnew\s+\w+/.test(trimmed) && !/\bunique_ptr|shared_ptr|make_unique|make_shared/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'modernize',
            severity: 'warning',
            message: 'Raw pointer allocation. Consider using std::unique_ptr or std::shared_ptr.',
            suggestion: 'Use std::make_unique<T>() or std::make_shared<T>()',
          })
        }
        
        // auto keyword
        if (/\b(auto|int|float|double|char|bool)\s+\w+\s*=/.test(trimmed)) {
          if (/=.*\(/.test(trimmed) && !/\bauto\b/.test(trimmed)) {
            issues.push({
              line: i + 1,
              rule: 'modernize',
              severity: 'info',
              message: 'Consider using auto for type deduction.',
              suggestion: 'Replace explicit type with auto',
            })
          }
        }
      }
      
      if (language === 'javascript' || language === 'typescript') {
        // var vs let/const
        if (/\bvar\s+/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'modernize',
            severity: 'warning',
            message: 'Use let or const instead of var.',
            suggestion: 'Replace var with let or const',
          })
        }
        
        // function vs arrow
        if (/\bfunction\s*\w*\s*\(/.test(trimmed) && !/\bclass\b/.test(lines.slice(Math.max(0, i - 5), i + 1).join('\n'))) {
          issues.push({
            line: i + 1,
            rule: 'modernize',
            severity: 'info',
            message: 'Consider using arrow function syntax.',
            suggestion: 'Convert to const fn = () => {}',
          })
        }
      }
    }
    
    return issues
  },
}

const memorySafety: Rule = {
  name: 'memory-safety',
  description: 'Detect potential memory issues',
  detect: (lines, language) => {
    const issues: CodeIssue[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      if (language === 'cpp') {
        // Raw array access without bounds checking
        if (/\w+\s*\[\s*\w+\s*\]/.test(trimmed) && !/\b\.at\(/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'memory-safety',
            severity: 'info',
            message: 'Array access without bounds check. Consider using .at() for safe access.',
          })
        }
        
        // Delete without null check
        if (/\bdelete\s+/.test(trimmed)) {
          issues.push({
            line: i + 1,
            rule: 'memory-safety',
            severity: 'info',
            message: 'Manual memory deallocation. Consider using smart pointers.',
          })
        }
      }
    }
    
    return issues
  },
}

const rules: Rule[] = [noRawLoops, offByOne, modernize, memorySafety]

export function reviewCode(input: {
  code: string
  language?: string
  rules?: string[]
}): ReviewResult {
  const lines = input.code.split('\n')
  const language = input.language || 'javascript'
  const requestedRules = input.rules || rules.map(r => r.name)
  
  const allIssues: CodeIssue[] = []
  const rulesChecked: string[] = []
  
  for (const rule of rules) {
    if (requestedRules.includes(rule.name)) {
      const issues = rule.detect(lines, language)
      allIssues.push(...issues)
      rulesChecked.push(rule.name)
    }
  }
  
  // Sort by line number
  allIssues.sort((a, b) => a.line - b.line)
  
  // Calculate score (100 = perfect, deductions for issues)
  const deductions = allIssues.reduce((sum, issue) => {
    switch (issue.severity) {
      case 'error': return sum + 15
      case 'warning': return sum + 8
      case 'info': return sum + 2
      default: return sum
    }
  }, 0)
  const score = Math.max(0, 100 - deductions)
  
  // Generate summary
  const errors = allIssues.filter(i => i.severity === 'error').length
  const warnings = allIssues.filter(i => i.severity === 'warning').length
  const infos = allIssues.filter(i => i.severity === 'info').length
  
  let summary = `Reviewed ${lines.length} lines of ${language} code. `
  if (errors === 0 && warnings === 0) {
    summary += 'No significant issues found.'
  } else {
    summary += `Found ${errors} errors, ${warnings} warnings, ${infos} suggestions.`
  }
  
  return {
    issues: allIssues,
    score,
    summary,
    rulesChecked,
  }
}
