import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// ACLH Check Script (TypeScript, runs natively on Node >= 22 via type stripping)
// Usage: node .harness/scripts/check.ts [options]
// ============================================================================

interface CheckOptions {
  format: 'text' | 'json';
  phase: string | null;
  task: string | null;
}

interface Violation {
  check_id: string;
  plugin: string;
  severity: string;
  message: string;
  file: string;
  expected?: string;
  actual?: string;
}

interface SummaryCounts {
  total_checks: number;
  passed: number;
  failed: number;
  warnings: number;
  info: number;
  skipped: number;
}

interface HarnessConfig {
  preset?: string;
  plugins?: unknown;
  presets?: Record<string, unknown>;
}

interface PluginFile {
  plugin?: {
    name?: string;
    type?: string;
  };
  checks?: Array<Record<string, unknown>>;
  workflow?: {
    checks?: Array<Record<string, unknown>>;
  };
}

interface CheckOutcome {
  activePlugins: PluginFile[];
  activePluginNames: string[];
  activePreset: string | null;
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const projectRoot: string = path.resolve(__dirname, '../../');
const harnessDir: string = path.join(projectRoot, '.harness');

function showHelp(): void {
  console.log(`
ACLH Check Script

Usage: node check.ts [options]

Options:
  --format <text|json>    Output format (default: text)
  --phase <phase-name>    Filter checks by phase
  --task <JIRA-ID>        Include task ID in output
  --help                  Show this help
  `);
}

// Parse CLI arguments
const args: string[] = process.argv.slice(2);
const options: CheckOptions = {
  format: 'text',
  phase: null,
  task: null,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--format':
      options.format = (args[++i] === 'json' ? 'json' : 'text');
      break;
    case '--phase':
      options.phase = args[++i] ?? null;
      break;
    case '--task':
      options.task = args[++i] ?? null;
      break;
    case '--help':
      showHelp();
      process.exit(0);
      break;
    default:
      break;
  }
}

// Global file cache
let fileCache: string[] | null = null;

function buildFileCache(): void {
  if (fileCache !== null) return;
  fileCache = [];

  const excludeDirs: Set<string> = new Set(['node_modules', '.git', '.harness', 'dist', 'build', 'coverage']);

  function traverse(currentPath: string, relativePath: string = ''): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        traverse(path.join(currentPath, entry.name), path.join(relativePath, entry.name));
      } else if (entry.isFile()) {
        fileCache!.push(path.join(relativePath, entry.name));
      }
    }
  }

  traverse(projectRoot);
}

function globToRegex(glob: string): RegExp {
  let regexStr = glob
    .replace(/\./g, '\\.')          // escape dots
    .replace(/\*\*\//g, '(.+/)?')  // **/ = zero or more directory levels
    .replace(/\*\*/g, '.*')        // ** without / = match anything
    .replace(/(?<!\.)(?<!\()\*/g, '[^/]*')  // * = single path segment (not preceded by . from ** replacement)
    .replace(/\{([^}]+)\}/g, (match: string, contents: string) => `(${contents.replace(/,/g, '|').trim()})`);
  return new RegExp(`^${regexStr}$`);
}

function matchFiles(pattern: string): string[] {
  buildFileCache();
  const regex = globToRegex(pattern);
  return (fileCache ?? []).filter(file => {
    // Standardize path separators for regex matching
    const posixFile = file.split(path.sep).join('/');
    return regex.test(posixFile);
  });
}

function loadHarnessConfig(): HarnessConfig {
  const configPath = path.join(harnessDir, 'harness.yaml');
  if (!fs.existsSync(configPath)) {
    throw new Error('harness.yaml not found');
  }
  return parseYaml(fs.readFileSync(configPath, 'utf8')) as HarnessConfig;
}

function getActivePlugins(config: HarnessConfig): CheckOutcome {
  let activePluginNames: string[] = [];
  let activePreset: string | null = null;

  // Helper: extract plugin names from a structured object {rules:[], process:[], templates:[]}
  function flattenPluginConfig(obj: unknown): string[] {
    const names: string[] = [];
    if (!obj) return names;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'string') names.push(item);
      }
      return names; // already flat
    }
    if (typeof obj === 'object') {
      for (const values of Object.values(obj)) {
        if (Array.isArray(values)) {
          for (const item of values) {
            if (typeof item === 'string') names.push(item);
          }
        }
      }
    }
    return names;
  }

  if (config.plugins && typeof config.plugins === 'object' && !Array.isArray(config.plugins)) {
    // Explicit plugins override preset
    activePluginNames = flattenPluginConfig(config.plugins);
  } else if (config.plugins && Array.isArray(config.plugins)) {
    activePluginNames = flattenPluginConfig(config.plugins);
  } else if (config.preset && config.presets && config.presets[config.preset]) {
    activePreset = config.preset;
    activePluginNames = flattenPluginConfig(config.presets[config.preset]);
  }

  const activePlugins: PluginFile[] = [];

  for (const name of activePluginNames) {
    if (typeof name !== 'string') continue;
    const rulePath = path.join(harnessDir, 'plugins', 'rules', `${name}.yaml`);
    const processPath = path.join(harnessDir, 'plugins', 'process', `${name}.yaml`);

    if (fs.existsSync(rulePath)) {
      activePlugins.push(parseYaml(fs.readFileSync(rulePath, 'utf8')) as PluginFile);
    }
    if (fs.existsSync(processPath)) {
      activePlugins.push(parseYaml(fs.readFileSync(processPath, 'utf8')) as PluginFile);
    }
  }

  return { activePlugins, activePluginNames, activePreset };
}

function runChecks(): void {
  let config: HarnessConfig;
  try {
    config = loadHarnessConfig();
  } catch (err) {
    console.error(`Error loading harness.yaml: ${(err as Error).message}`);
    process.exit(1);
  }

  const { activePlugins, activePluginNames, activePreset } = getActivePlugins(config);

  const summary: SummaryCounts = {
    total_checks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    info: 0,
    skipped: 0
  };

  const violations: Violation[] = [];

  const knownTypes: string[] = ['filename-pattern', 'grep-pattern', 'file-exists'];

  function recordViolation(entry: Violation): void {
    if (entry.severity === 'error') summary.failed++;
    else if (entry.severity === 'warning') summary.warnings++;
    else summary.info++;
    violations.push(entry);
  }

  for (const pluginFile of activePlugins) {
    const plugin = pluginFile.plugin;
    if (!plugin) continue;

    // Filter by phase if specified
    if (options.phase) {
      if (plugin.type !== 'rule' && plugin.type !== 'process') {
        continue;
      }
    }

    if (plugin.type === 'rule' && pluginFile.checks) {
      for (const check of pluginFile.checks) {
        summary.total_checks++;
        const checkType = String(check.type ?? '');
        const checkId = String(check.id ?? '');
        const severity = String(check.severity ?? 'error');

        // Handle eslint-delegate separately (informational, no file scanning)
        if (checkType === 'eslint-delegate') {
          summary.info++;
          violations.push({
            check_id: checkId || 'eslint-delegate',
            plugin: plugin.name ?? '',
            severity: 'info',
            message: `委托 ESLint 规则: ${String(check.rule ?? '')} — 请确保 ESLint 配置中已启用`,
            file: '-'
          });
          continue;
        }

        if (!knownTypes.includes(checkType)) {
          summary.skipped++;
          violations.push({
            check_id: checkId || 'unknown',
            plugin: plugin.name ?? '',
            severity: 'info',
            message: `跳过未知 check 类型: ${checkType}`,
            file: '-'
          });
          continue;
        }

        const targetPattern = String(check.target ?? '**/*');
        const matchedFiles = matchFiles(targetPattern);

        // file-exists: just check if any files matched
        if (checkType === 'file-exists') {
          if (matchedFiles.length === 0) {
            recordViolation({
              check_id: checkId,
              plugin: plugin.name ?? '',
              severity,
              message: String(check.description ?? `必需文件缺失: ${targetPattern}`),
              file: targetPattern
            });
          } else {
            summary.passed++;
          }
          continue;
        }

        // filename-pattern and grep-pattern: iterate matched files
        let hasViolation = false;
        for (const file of matchedFiles) {
          const fullPath = path.join(projectRoot, file);
          const pattern = String(check.pattern ?? '');

          if (checkType === 'filename-pattern') {
            const basename = path.basename(file, path.extname(file));
            const regex = new RegExp(pattern);
            if (!regex.test(basename)) {
              hasViolation = true;
              recordViolation({
                check_id: checkId,
                plugin: plugin.name ?? '',
                severity,
                message: String(check.description ?? `文件名不符合规范: ${pattern}`),
                file,
                expected: `匹配 ${pattern}`,
                actual: basename
              });
            }
          }

          if (checkType === 'grep-pattern') {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              const regex = new RegExp(pattern);
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  hasViolation = true;
                  const lineSeverity = String(check.severity ?? 'warning');
                  const effectiveSeverity = lineSeverity === 'error' ? lineSeverity : 'warning';
                  recordViolation({
                    check_id: checkId,
                    plugin: plugin.name ?? '',
                    severity: effectiveSeverity,
                    message: String(check.description ?? `发现禁止的模式: ${pattern}`),
                    file: `${file}:${i + 1}`,
                    actual: lines[i].trim().substring(0, 100)
                  });
                }
              }
            } catch { /* skip unreadable files */ }
          }
        }

        if (!hasViolation) {
          summary.passed++;
        }
      }
    }

    // Process plugins with checks (like pr-review)
    const processChecks = pluginFile.checks || pluginFile.workflow?.checks;
    if (plugin.type === 'process' && processChecks) {
      for (const check of processChecks) {
        summary.total_checks++;
        const checkType = String(check.type ?? '');

        if (checkType === 'grep-pattern') {
          const targetPattern = String(check.target ?? 'src/**/*.{ts,tsx}');
          const matchedFiles = matchFiles(targetPattern);
          let hasViolation = false;
          const pattern = String(check.pattern ?? '');

          for (const file of matchedFiles) {
            try {
              const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
              const lines = content.split('\n');
              const regex = new RegExp(pattern);
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  hasViolation = true;
                  const severity = String(check.severity ?? 'warning') === 'error' ? 'error' : 'warning';
                  recordViolation({
                    check_id: String(check.id ?? ''),
                    plugin: plugin.name ?? '',
                    severity,
                    message: String(check.description ?? `发现禁止的模式: ${pattern}`),
                    file: `${file}:${i + 1}`,
                    actual: lines[i].trim().substring(0, 100)
                  });
                }
              }
            } catch { /* skip */ }
          }

          if (!hasViolation) summary.passed++;
        } else {
          summary.skipped++;
        }
      }
    }
  }

  const hasErrors = summary.failed > 0;

  const result = {
    harness_check: hasErrors ? 'FAIL' : 'PASS',
    timestamp: new Date().toISOString(),
    phase: options.phase ?? 'all',
    task: options.task,
    active_preset: activePreset,
    active_plugins: activePluginNames,
    violations,
    summary
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n=== ACLH Check Results ===`);
    console.log(`Status: ${result.harness_check}`);
    console.log(`Phase: ${result.phase}`);
    console.log(`Task: ${result.task || 'None'}`);
    console.log(`Preset: ${result.active_preset || 'None'}`);
    console.log(`Active Plugins: ${result.active_plugins.join(', ')}`);
    console.log(`\nViolations:`);

    if (violations.length === 0) {
      console.log('  None 🎉');
    } else {
      violations.forEach(v => {
        let icon = '❌';
        if (v.severity === 'warning') icon = '⚠️';
        if (v.severity === 'info') icon = 'ℹ️';
        console.log(`  ${icon} [${v.check_id}] ${v.file}: ${v.message}`);
      });
    }

    console.log(`\nSummary:`);
    console.log(`  Total Checks: ${summary.total_checks}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Warnings: ${summary.warnings}`);
    console.log(`  Info: ${summary.info}`);
    console.log(`  Skipped: ${summary.skipped}`);
  }

  process.exit(hasErrors ? 1 : 0);
}

runChecks();