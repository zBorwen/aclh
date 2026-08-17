import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const harnessDir = path.join(projectRoot, '.harness');

function showHelp() {
  console.log(`
ACLH Check Script

Usage: node check.mjs [options]

Options:
  --format <text|json>    Output format (default: text)
  --phase <phase-name>    Filter checks by phase
  --task <JIRA-ID>        Include task ID in output
  --help                  Show this help
  `);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  format: 'text',
  phase: null,
  task: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format') {
    options.format = args[++i];
  } else if (args[i] === '--phase') {
    options.phase = args[++i];
  } else if (args[i] === '--task') {
    options.task = args[++i];
  } else if (args[i] === '--help') {
    showHelp();
    process.exit(0);
  }
}

// Global file cache
let fileCache = null;

function buildFileCache() {
  if (fileCache !== null) return;
  fileCache = [];

  const excludeDirs = new Set(['node_modules', '.git', '.harness', 'dist', 'build', 'coverage']);

  function traverse(currentPath, relativePath = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        traverse(path.join(currentPath, entry.name), path.join(relativePath, entry.name));
      } else if (entry.isFile()) {
        fileCache.push(path.join(relativePath, entry.name));
      }
    }
  }

  traverse(projectRoot);
}

function globToRegex(glob) {
  let regexStr = glob
    .replace(/\./g, '\\.')          // escape dots
    .replace(/\*\*\//g, '(.+/)?')  // **/ = zero or more directory levels
    .replace(/\*\*/g, '.*')        // ** without / = match anything
    .replace(/(?<!\.)(?<!\()\*/g, '[^/]*')  // * = single path segment (not preceded by . from ** replacement)
    .replace(/\{([^}]+)\}/g, (match, contents) => `(${contents.replace(/,/g, '|').trim()})`);
  return new RegExp(`^${regexStr}$`);
}

function matchFiles(pattern) {
  buildFileCache();
  const regex = globToRegex(pattern);
  return fileCache.filter(file => {
    // Standardize path separators for regex matching
    const posixFile = file.split(path.sep).join('/');
    return regex.test(posixFile);
  });
}

function loadHarnessConfig() {
  const configPath = path.join(harnessDir, 'harness.yaml');
  if (!fs.existsSync(configPath)) {
    throw new Error('harness.yaml not found');
  }
  return parseYaml(fs.readFileSync(configPath, 'utf8'));
}

function getActivePlugins(config) {
  let activePluginNames = [];
  let activePreset = null;

  // Helper: extract plugin names from a structured object {rules:[], process:[], templates:[]}
  function flattenPluginConfig(obj) {
    const names = [];
    if (!obj) return names;
    if (Array.isArray(obj)) return obj; // already flat
    for (const [category, items] of Object.entries(obj)) {
      if (Array.isArray(items)) {
        names.push(...items);
      }
    }
    return names;
  }

  if (config.plugins && typeof config.plugins === 'object' && !Array.isArray(config.plugins)) {
    // Explicit plugins override preset
    activePluginNames = flattenPluginConfig(config.plugins);
  } else if (config.plugins && Array.isArray(config.plugins)) {
    activePluginNames = config.plugins;
  } else if (config.preset && config.presets && config.presets[config.preset]) {
    activePreset = config.preset;
    activePluginNames = flattenPluginConfig(config.presets[config.preset]);
  }

  const activePlugins = [];

  for (const name of activePluginNames) {
    if (typeof name !== 'string') continue;
    const rulePath = path.join(harnessDir, 'plugins', 'rules', `${name}.yaml`);
    const processPath = path.join(harnessDir, 'plugins', 'process', `${name}.yaml`);

    if (fs.existsSync(rulePath)) {
      activePlugins.push(parseYaml(fs.readFileSync(rulePath, 'utf8')));
    }
    if (fs.existsSync(processPath)) {
      activePlugins.push(parseYaml(fs.readFileSync(processPath, 'utf8')));
    }
  }

  return { activePlugins, activePluginNames, activePreset };
}

function runChecks() {
  let config;
  try {
    config = loadHarnessConfig();
  } catch (err) {
    console.error(`Error loading harness.yaml: ${err.message}`);
    process.exit(1);
  }

  const { activePlugins, activePluginNames, activePreset } = getActivePlugins(config);

  const summary = {
    total_checks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    info: 0,
    skipped: 0
  };

  const violations = [];

  for (const pluginFile of activePlugins) {
    const plugin = pluginFile.plugin;
    if (!plugin) continue;

    // Filter by phase if specified (simple filtering based on instructions)
    if (options.phase) {
      if (plugin.type !== 'rule' && plugin.type !== 'process') {
        continue;
      }
    }

    if (plugin.type === 'rule' && pluginFile.checks) {
      for (const check of pluginFile.checks) {
        summary.total_checks++;

        // Handle eslint-delegate separately (informational, no file scanning)
        if (check.type === 'eslint-delegate') {
          summary.info++;
          violations.push({
            check_id: check.id || 'eslint-delegate',
            plugin: plugin.name,
            severity: 'info',
            message: `委托 ESLint 规则: ${check.rule} — 请确保 ESLint 配置中已启用`,
            file: '-'
          });
          continue;
        }

        // Check for known actionable types
        const knownTypes = ['filename-pattern', 'grep-pattern', 'file-exists'];
        if (!knownTypes.includes(check.type)) {
          summary.skipped++;
          violations.push({
            check_id: check.id || 'unknown',
            plugin: plugin.name,
            severity: 'info',
            message: `跳过未知 check 类型: ${check.type}`,
            file: '-'
          });
          continue;
        }

        const targetPattern = check.target || '**/*';
        const matchedFiles = matchFiles(targetPattern);
        
        let checkPassed = true;

        // file-exists: just check if any files matched
        if (check.type === 'file-exists') {
          if (matchedFiles.length === 0) {
            checkPassed = false;
            const severity = check.severity || 'error';
            if (severity === 'error') summary.failed++;
            else if (severity === 'warning') summary.warnings++;
            violations.push({
              check_id: check.id,
              plugin: plugin.name,
              severity,
              message: check.description || `必需文件缺失: ${targetPattern}`,
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

          if (check.type === 'filename-pattern') {
            const basename = path.basename(file, path.extname(file));
            const regex = new RegExp(check.pattern);
            if (!regex.test(basename)) {
              hasViolation = true;
              const severity = check.severity || 'error';
              if (severity === 'error') summary.failed++;
              else if (severity === 'warning') summary.warnings++;
              violations.push({
                check_id: check.id,
                plugin: plugin.name,
                severity,
                message: check.description || `文件名不符合规范: ${check.pattern}`,
                file,
                expected: `匹配 ${check.pattern}`,
                actual: basename
              });
            }
          }

          if (check.type === 'grep-pattern') {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              const regex = new RegExp(check.pattern);
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  hasViolation = true;
                  const severity = check.severity || 'warning';
                  if (severity === 'error') summary.failed++;
                  else if (severity === 'warning') summary.warnings++;
                  violations.push({
                    check_id: check.id,
                    plugin: plugin.name,
                    severity,
                    message: check.description || `发现禁止的模式: ${check.pattern}`,
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

        if (check.type === 'grep-pattern') {
          const targetPattern = check.target || 'src/**/*.{ts,tsx}';
          const matchedFiles = matchFiles(targetPattern);
          let hasViolation = false;

          for (const file of matchedFiles) {
            try {
              const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
              const lines = content.split('\n');
              const regex = new RegExp(check.pattern);
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  hasViolation = true;
                  const severity = check.severity || 'warning';
                  if (severity === 'error') summary.failed++;
                  else if (severity === 'warning') summary.warnings++;
                  violations.push({
                    check_id: check.id,
                    plugin: plugin.name,
                    severity,
                    message: check.description || `发现禁止的模式: ${check.pattern}`,
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
    phase: options.phase || 'all',
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
