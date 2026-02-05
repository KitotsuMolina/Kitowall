#!/usr/bin/env node
// CLI entrypoint and command routing.
import {loadConfig} from './core/config';
import {loadState, saveState} from './core/state';
import {Controller} from './core/controller';
import {detectOutputs} from './core/outputs';
import {installSystemd, uninstallSystemd, systemdStatus} from './core/systemd';
import {initHyprwall} from './core/init';
import {watchMonitors} from './core/watch';
import {getHealth, printDoctor} from './core/doctor';

function printUsage(): void {
  console.log(`hyprwall <command> [options]

Commands:
  outputs                                  List outputs (Wayland monitors)
  next [--pack <name>] [--namespace <ns>]     Apply next wallpapers (respects mode unless --force)
  status                                   Show current state in JSON

  init [--namespace <ns>] [--apply] [--force]       Setup hyprwall (install daemon + watcher + next.service), validate deps
  watch [--debounce <ms>]                  Watch Hyprland monitor hotplug events and apply wallpapers
  doctor [--namespace <ns>]
  health [--namespace <ns>]

  install-systemd [--every <dur>]          Install + enable systemd user timer (timer only)
  uninstall-systemd                        Disable systemd timer
  systemd-status                           Show systemd timer status
  rotate-now [--pack <name>]               Apply next wallpapers ignoring manual mode (for timers)
  mode <manual|rotate>                     Set mode persistently in state.json
Examples:
  hyprwall init --namespace hyprwall --apply
  hyprwall install-systemd --every 5m
  hyprwall next --pack sao
  hyprwall outputs
  hyprwall mode rotate
  hyprwall rotate-now
`);
}

function getOptionValue(args: string[], key: string): string | null {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function cleanOpt(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim();
  return v.length ? v : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printUsage();
    return;
  }

  if (cmd === 'outputs') {
    const outputs = await detectOutputs();
    console.log(JSON.stringify(outputs.map(o => o.name), null, 2));
    return;
  }

  // init: instala daemon + watcher + next.service y valida dependencias
  if (cmd === 'init') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'hyprwall';
    const apply = args.includes('--apply');
    const force = args.includes('--force');
    await initHyprwall({namespace, apply, force});
    console.log(JSON.stringify({ok: true, init: true, namespace, apply}, null, 2));
    return;
  }

  // watch: modo manual (normalmente lo corre systemd por init)
  if (cmd === 'watch') {
    const debounceRaw = cleanOpt(getOptionValue(args, '--debounce'));
    const debounceMs = debounceRaw ? Number(debounceRaw) : 800;
    if (!Number.isFinite(debounceMs) || debounceMs < 100) {
      throw new Error(`Invalid --debounce value: ${debounceRaw} (min 100)`);
    }

    await watchMonitors({debounceMs});
    return;
  }

  // systemd helpers (timer-only)
  if (cmd === 'install-systemd') {
    const every = cleanOpt(getOptionValue(args, '--every')) ?? '10m';

    await installSystemd({every});

    console.log(`✔ systemd timer installed (every ${every})`);
    console.log(JSON.stringify({ok: true, installed: true, every}, null, 2));
    return;
  }

  if (cmd === 'uninstall-systemd') {
    await uninstallSystemd();
    console.log('✔ systemd timer disabled');
    console.log(JSON.stringify({ok: true, uninstalled: true}, null, 2));
    return;
  }

  if (cmd === 'systemd-status') {
    await systemdStatus();
    return;
  }

  if (cmd === 'doctor') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'hyprwall';
    await printDoctor(namespace);
    return;
  }

  if (cmd === 'health') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'hyprwall';
    const report = await getHealth(namespace);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 2; // útil para scripts
    return;
  }

  // Regular commands (need config/state)
  const config = loadConfig();
  const state = loadState();
  const controller = new Controller(config, state);

  if (cmd === 'mode') {
    const value = cleanOpt(args[1] ?? null);

    if (value !== 'manual' && value !== 'rotate') {
      throw new Error(`Invalid mode: ${value ?? '(missing)'} (use: manual|rotate)`);
    }

    state.mode = value;
    state.last_updated = Date.now();
    saveState(state);

    console.log(JSON.stringify({ok: true, mode: state.mode}, null, 2));
    return;
  }

  if (cmd === 'next' || cmd === 'rotate-now') {
    const pack = cleanOpt(getOptionValue(args, '--pack'));
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'hyprwall';
    const force = cmd === 'rotate-now' || args.includes('--force');

    if (state.mode === 'manual' && !force) {
      console.log(JSON.stringify(
          {
            ok: true,
            skipped: true,
            reason: 'mode=manual',
            hint: 'Use: hyprwall rotate-now  OR  hyprwall next --force  OR  hyprwall mode rotate',
            namespace
          },
          null,
          2
      ));
      return;
    }

    const result = await controller.applyNext(pack, namespace);
    console.log(JSON.stringify(
        {
          pack: result.pack,
          outputs: result.outputs,
          images: result.images,
          namespace
        },
        null,
        2
    ));
    return;
  }

  if (cmd === 'status') {
    const outputs = await controller.getOutputs();
    console.log(JSON.stringify(
        {
          mode: state.mode,
          pack: state.current_pack,
          outputs,
          last_set: state.last_set,
          last_updated: state.last_updated
        },
        null,
        2
    ));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});