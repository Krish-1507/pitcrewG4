import { cpus, totalmem } from 'node:os';
import { spawn } from 'node:child_process';

export interface HardwareReport {
  cpuCores: number;
  ramGb: number;
  gpuName: string | null;
  gpuVramGb: number | null;
}

export interface LocalModelSuggestion {
  tier: string;
  models: string[];
  reasoning: string;
}

/**
 * Bounded, best-effort hardware probe. Fixed argv (no shell interpolation),
 * short timeout, small output cap; any probe failure degrades to null.
 */
function probe(executable: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    try {
      const child = spawn(executable, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let output = '';
      const timer = setTimeout(() => {
        child.kill();
        done(output.length ? output : null);
      }, 8000);
      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
        if (output.length > 65536) {
          child.kill();
          done(output);
        }
      });
      child.on('error', () => {
        clearTimeout(timer);
        done(null);
      });
      child.on('exit', () => {
        clearTimeout(timer);
        done(output.length ? output : null);
      });
    } catch {
      done(null);
    }
  });
}

export async function detectHardware(): Promise<HardwareReport> {
  const report: HardwareReport = {
    cpuCores: cpus().length || 1,
    ramGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    gpuName: null,
    gpuVramGb: null,
  };
  if (process.platform === 'win32') {
    const output = await probe('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_VideoController | ForEach-Object { "{0}`t{1}" -f $_.Name, $_.AdapterRAM }',
    ]);
    if (output) {
      const line = output
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find((value) => value.length > 0 && !/^\d+$/.test(value));
      if (line) {
        const [name, bytes] = line.split('\t');
        report.gpuName = (name ?? '').trim() || null;
        const parsed = Number.parseInt((bytes ?? '').trim(), 10);
        // Win32_VideoController.AdapterRAM is a 32-bit unsigned value and
        // wraps above 4 GiB, so a positive reading means "at least 4".
        if (Number.isFinite(parsed) && parsed > 0) report.gpuVramGb = 4;
      }
    }
  } else if (process.platform === 'linux') {
    const output = await probe('lspci', []);
    if (output) {
      const line = output
        .split(/\r?\n/)
        .find((value) => /VGA|3D controller/i.test(value));
      if (line) report.gpuName = line.split(/:\s+/).pop() ?? null;
    }
  } else if (process.platform === 'darwin') {
    const output = await probe('sysctl', ['-n', 'machdep.cpu.brand_string']);
    if (output && /Apple/.test(output)) report.gpuName = output.trim();
  }
  return report;
}

/**
 * Map hardware to an honest local-model size suggestion. Quantized (Q4)
 * weights need roughly 0.6-0.7 bytes per parameter plus context overhead;
 * the suggestion prefers a size that fits without swapping. GPU readings on
 * Windows are coarse (AdapterRAM wraps at 4 GiB), so RAM leads the estimate.
 */
export function suggestLocalModel(
  report: HardwareReport,
): LocalModelSuggestion {
  const vram = report.gpuVramGb ?? 0;
  const budget = Math.max(report.ramGb * 0.7, vram * 1.05);
  if (budget >= 40)
    return {
      tier: '30B+ class (quantized)',
      models: ['qwen2.5-coder:32b', 'llama3.3:70b-instruct-q3_K_M'],
      reasoning:
        'Plenty of memory: a 30B-class quantized model fits comfortably and gives the best local quality.',
    };
  if (budget >= 20)
    return {
      tier: '13-14B class (quantized)',
      models: [
        'qwen2.5-coder:14b',
        'deepseek-coder-v2:16b-lite-instruct-q4_K_M',
      ],
      reasoning:
        'A 13-14B quantized model fits with room for context; solid quality for coding tasks.',
    };
  if (budget >= 8)
    return {
      tier: '7-8B class (quantized)',
      models: ['qwen2.5-coder:7b', 'llama3.1:8b-instruct-q4_K_M'],
      reasoning: 'A 7-8B quantized model is the sweet spot for this machine.',
    };
  return {
    tier: '3-4B class (quantized)',
    models: ['qwen2.5-coder:3b', 'llama3.2:3b'],
    reasoning:
      'Limited memory: stick to small quantized models to avoid swapping.',
  };
}
