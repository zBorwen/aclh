import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { resolveRuntimeRoots } from './lib/runtime-roots.ts';

type Enforcement = 'verifiable' | 'blocking';
type CheckRecord = Record<string, unknown>;

interface CheckOptions {
  format: 'text' | 'json';
  phase: string | null;
  task: string | null;
}

interface Finding {
  check_id: string;
  plugin: string;
  enforcement: Enforcement | 'config';
  severity: string;
  message: string;
  file: string;
  expected?: string;
  actual?: string;
}

interface SummaryCounts {
  total_checks: number;
  passed: number;
  blocking_failed: number;
  verifiable_failed: number;
  config_errors: number;
  info: number;
  skipped: number;
}

interface HarnessConfig {
  preset?: string;
  plugins?: unknown;
  presets?: Record<string, unknown>;
}

interface PluginFile {
  plugin?: { name?: string; type?: string };
  checks?: CheckRecord[];
  workflow?: { checks?: CheckRecord[] };
}

interface CheckOutcome {
  activePlugins: PluginFile[];
  activePluginNames: string[];
  activePreset: string | null;
}

const roots = resolveRuntimeRoots(import.meta.url);
const projectRoot = roots.projectRoot;
const harnessDir = roots.runtimeHarnessDir;

const args = process.argv.slice(2);
const options: CheckOptions = { format: 'text', phase: null, task: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format') options.format = args[++i] === 'json' ? 'json' : 'text';
  else if (args[i] === '--phase') options.phase = args[++i] ?? null;
  else if (args[i] === '--task') options.task = args[++i] ?? null;
  else if (args[i] === '--help') {
    console.log('Usage: node .harness/scripts/check.ts [--format text|json] [--phase <phase>] [--task <id>]');
    process.exit(0);
  }
}

let fileCache: string[] | null = null;
function buildFileCache(): void {
  if (fileCache) return;
  fileCache = [];
  const excluded = new Set(['node_modules', '.git', '.harness', 'dist', 'build', 'coverage']);
  const walk = (current: string, relative = ''): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(path.join(current, entry.name), path.join(relative, entry.name));
      } else if (entry.isFile()) {
        fileCache!.push(path.join(relative, entry.name));
      }
    }
  };
  walk(projectRoot);
}

function globToRegex(glob: string): RegExp {
  const regexStr = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)(?<!\()\*/g, '[^/]*')
    .replace(/\{([^}]+)\}/g, (_match: string, contents: string) => `(${contents.replace(/,/g, '|').trim()})`);
  return new RegExp(`^${regexStr}$`);
}

function matchFiles(pattern: string): string[] {
  buildFileCache();
  const regex = globToRegex(pattern);
  return (fileCache ?? []).filter(file => regex.test(file.split(path.sep).join('/')));
}

function loadHarnessConfig(): HarnessConfig {
  return parseYaml(fs.readFileSync(path.join(harnessDir, 'harness.yaml'), 'utf8')) as HarnessConfig;
}

function flattenPluginConfig(obj: unknown): string[] {
  const names: string[] = [];
  if (!obj) return names;
  if (Array.isArray(obj)) return obj.filter((item): item is string => typeof item === 'string');
  if (typeof obj === 'object') {
    for (const values of Object.values(obj)) {
      if (Array.isArray(values)) {
        for (const item of values) if (typeof item === 'string') names.push(item);
      }
    }
  }
  return names;
}

function getActivePlugins(config: HarnessConfig): CheckOutcome {
  let activePluginNames: string[] = [];
  let activePreset: string | null = null;

  if (config.plugins) {
    activePluginNames = flattenPluginConfig(config.plugins);
  } else if (config.preset && config.presets?.[config.preset]) {
    activePreset = config.preset;
    activePluginNames = flattenPluginConfig(config.presets[config.preset]);
  }

  const activePlugins: PluginFile[] = [];
  for (const name of activePluginNames) {
    for (const group of ['rules', 'process']) {
      const pluginPath = path.join(harnessDir, 'plugins', group, `${name}.yaml`);
      if (fs.existsSync(pluginPath)) activePlugins.push(parseYaml(fs.readFileSync(pluginPath, 'utf8')) as PluginFile);
    }
  }
  return { activePlugins, activePluginNames, activePreset };
}

function parseEnforcement(check: CheckRecord): Enforcement | null {
  return check.enforcement === 'blocking' || check.enforcement === 'verifiable' ? check.enforcement : null;
}

function runChecks(): void {
  let config: HarnessConfig;
  try {
    config = loadHarnessConfig();
  } catch (error) {
    console.error(`Error loading harness.yaml: ${(error as Error).message}`);
    process.exit(1);
  }

  const { activePlugins, activePluginNames, activePreset } = getActivePlugins(config);
  const findings: Finding[] = [];
  const summary: SummaryCounts = {
    total_checks: 0,
    passed: 0,
    blocking_failed: 0,
    verifiable_failed: 0,
    config_errors: 0,
    info: 0,
    skipped: 0,
  };

  const record = (finding: Finding): void => {
    findings.push(finding);
    if (finding.enforcement === 'blocking') summary.blocking_failed++;
    else if (finding.enforcement === 'verifiable') summary.verifiable_failed++;
    else summary.config_errors++;
  };

  const executeCheck = (pluginName: string, check: CheckRecord): void => {
    summary.total_checks++;
    const id = String(check.id ?? 'unnamed');
    const type = String(check.type ?? '');
    const enforcement = parseEnforcement(check);

    if (!enforcement) {
      record({
        check_id: id,
        plugin: pluginName,
        enforcement: 'config',
        severity: 'error',
        message: 'Executable check must declare enforcement: verifiable|blocking',
        file: '-',
      });
      return;
    }

    if (type === 'eslint-delegate') {
      summary.info++;
      findings.push({
        check_id: id,
        plugin: pluginName,
        enforcement,
        severity: 'info',
        message: `Delegated verification only: ${String(check.rule ?? check.description ?? '')}`,
        file: '-',
      });
      return;
    }

    if (!['filename-pattern', 'grep-pattern', 'file-exists'].includes(type)) {
      record({
        check_id: id,
        plugin: pluginName,
        enforcement: 'config',
        severity: 'error',
        message: `Unknown executable check type: ${type}`,
        file: '-',
      });
      return;
    }

    const target = String(check.target ?? '**/*');
    const matched = matchFiles(target);
    const severity = String(check.severity ?? (enforcement === 'blocking' ? 'error' : 'warning'));
    let violated = false;

    if (type === 'file-exists') {
      if (matched.length === 0) {
        violated = true;
        record({
          check_id: id,
          plugin: pluginName,
          enforcement,
          severity,
          message: String(check.description ?? `Required file missing: ${target}`),
          file: target,
        });
      }
    } else {
      const pattern = String(check.pattern ?? '');
      const regex = new RegExp(pattern);
      for (const file of matched) {
        if (type === 'filename-pattern') {
          const basename = path.basename(file, path.extname(file));
          if (!regex.test(basename)) {
            violated = true;
            record({
              check_id: id,
              plugin: pluginName,
              enforcement,
              severity,
              message: String(check.description ?? `Filename does not match ${pattern}`),
              file,
              expected: `match ${pattern}`,
              actual: basename,
            });
          }
        } else {
          try {
            const lines = fs.readFileSync(path.join(projectRoot, file), 'utf8').split('\n');
            for (let i = 0; i < lines.length; i++) {
              regex.lastIndex = 0;
              if (regex.test(lines[i])) {
                violated = true;
                record({
                  check_id: id,
                  plugin: pluginName,
                  enforcement,
                  severity,
                  message: String(check.description ?? `Forbidden pattern found: ${pattern}`),
                  file: `${file}:${i + 1}`,
                  actual: lines[i].trim().slice(0, 100),
                });
              }
            }
          } catch {
            summary.skipped++;
          }
        }
      }
    }

    if (!violated) summary.passed++;
  };

  for (const pluginFile of activePlugins) {
    const plugin = pluginFile.plugin;
    if (!plugin?.name) continue;
    if (options.phase && plugin.type !== 'rule' && plugin.type !== 'process') continue;
    const checks = plugin.type === 'process' ? (pluginFile.checks ?? pluginFile.workflow?.checks) : pluginFile.checks;
    for (const check of checks ?? []) executeCheck(plugin.name, check);
  }

  const shouldBlock = summary.blocking_failed > 0 || summary.config_errors > 0;
  const result = {
    harness_check: shouldBlock ? 'FAIL' : 'PASS',
    timestamp: new Date().toISOString(),
    phase: options.phase ?? 'all',
    task: options.task,
    active_preset: activePreset,
    active_plugins: activePluginNames,
    enforcement_policy: {
      advisory: 'prose guidance; not machine-enforced',
      verifiable: 'machine-visible; does not block',
      blocking: 'machine-verified; violation blocks',
    },
    findings,
    summary,
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n=== ACLH Check Results ===');
    console.log(`Status: ${result.harness_check}`);
    console.log(`Preset: ${result.active_preset ?? 'None'}`);
    console.log(`Active Plugins: ${activePluginNames.join(', ')}`);
    console.log('\nFindings:');
    if (findings.length === 0) console.log('  None');
    for (const finding of findings) {
      const mark = finding.enforcement === 'blocking' || finding.enforcement === 'config' ? '❌' : finding.severity === 'info' ? 'ℹ️' : '⚠️';
      console.log(`  ${mark} [${finding.enforcement}] [${finding.check_id}] ${finding.file}: ${finding.message}`);
    }
    console.log('\nSummary:');
    console.log(`  Total Checks: ${summary.total_checks}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Blocking Failed: ${summary.blocking_failed}`);
    console.log(`  Verifiable Failed: ${summary.verifiable_failed}`);
    console.log(`  Config Errors: ${summary.config_errors}`);
    console.log(`  Info: ${summary.info}`);
    console.log(`  Skipped: ${summary.skipped}`);
  }

  process.exit(shouldBlock ? 1 : 0);
}

runChecks();