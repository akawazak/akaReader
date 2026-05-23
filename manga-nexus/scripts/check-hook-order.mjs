import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/App.jsx',
  'src/components/reader/Reader.jsx',
];

const hookNames = ['useCallback', 'useMemo', 'useEffect'];
const ignoredDependencyNames = new Set([
  'true', 'false', 'null', 'undefined',
]);

const countChar = (value, char) => {
  let count = 0;
  for (const part of value) if (part === char) count += 1;
  return count;
};

const collectHookCall = (lines, startIndex) => {
  let text = '';
  let parens = 0;
  let started = false;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    text += `${line}\n`;
    parens += countChar(line, '(') - countChar(line, ')');
    if (line.includes('useCallback') || line.includes('useMemo') || line.includes('useEffect')) {
      started = true;
    }
    if (started && parens <= 0) return { text, endIndex: i };
  }

  return { text, endIndex: lines.length - 1 };
};

const getDependencyNames = (hookText) => {
  const matches = [...hookText.matchAll(/,\s*\[([^\[\]]*)\]\s*\)\s*;?/g)];
  const depsMatch = matches.at(-1);
  if (!depsMatch) return [];
  return [...depsMatch[1].matchAll(/\b[A-Za-z_$][\w$]*\b/g)]
    .map(match => match[0])
    .filter(name => !ignoredDependencyNames.has(name));
};

let failed = false;

const findComponentScopes = (lines) => {
  const scopes = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isComponentStart =
      /^\s*(export\s+)?const\s+[A-Z][A-Za-z0-9_$]*\s*=/.test(line)
      && (line.includes('=>') || line.includes('memo('));
    if (!isComponentStart) continue;

    let depth = 0;
    let seenBody = false;
    for (let j = i; j < lines.length; j += 1) {
      depth += countChar(lines[j], '{') - countChar(lines[j], '}');
      if (countChar(lines[j], '{') > 0) seenBody = true;
      if (seenBody && depth <= 0 && j > i) {
        scopes.push({ start: i, end: j });
        i = j;
        break;
      }
    }
  }
  return scopes;
};

for (const relativeFile of files) {
  const file = path.join(root, relativeFile);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const scopes = findComponentScopes(lines);
  const issues = [];

  for (const scope of scopes) {
    const declarations = new Map();

    for (let i = scope.start; i <= scope.end; i += 1) {
      const match = lines[i].match(/^\s{2,}const\s+([A-Za-z_$][\w$]*)\s*=/);
      if (match && !declarations.has(match[1])) {
        declarations.set(match[1], i + 1);
      }
    }

    for (let i = scope.start; i <= scope.end; i += 1) {
      if (!hookNames.some(name => lines[i].includes(name))) continue;
      const { text, endIndex } = collectHookCall(lines, i);
      const deps = getDependencyNames(text);

      for (const dependency of deps) {
        const declarationLine = declarations.get(dependency);
        if (declarationLine && declarationLine > i + 1) {
          issues.push(`${relativeFile}:${i + 1} depends on ${dependency}, declared later at line ${declarationLine}`);
        }
      }

      i = endIndex;
    }
  }

  if (issues.length > 0) {
    failed = true;
    console.error(issues.join('\n'));
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('Hook dependency order check passed.');
}
