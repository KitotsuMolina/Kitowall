// src/core/doctor.ts
import {run} from '../utils/exec';

const ENABLED_STATES = new Set(['enabled', 'enabled-runtime', 'static', 'generated']);
const ACTIVE_STATES = new Set(['active', 'activating']);

export type UnitStatus = {
    name: string;
    exists: boolean;
    activeState?: string;  // active/inactive/failed/activating...
    subState?: string;     // running/exited/dead...
    enabled?: boolean;     // systemctl is-enabled
    active?: boolean;      // systemctl is-active
    error?: string;
};

export type HealthReport = {
    ok: boolean;
    namespace: string;
    deps: {
        swww: boolean;
        swwwDaemon: boolean;
        hyprctl: boolean;
        systemctlUser: boolean;
    };
    units: {
        swwwDaemonNs: UnitStatus;
        watch: UnitStatus;
        nextService: UnitStatus;
        nextTimer: UnitStatus;
    };
    swww: {
        namespaceQueryOk: boolean;
        error?: string;
    };
    hints: string[];
};

function toText(out: any): string {
    // Compat: tu run() a veces devuelve string, a veces objeto {stdout,...}
    if (out == null) return '';
    if (typeof out === 'string') return out;
    if (typeof out?.stdout === 'string') return out.stdout;
    return String(out);
}

async function which(cmd: string): Promise<boolean> {
    try {
        await run('which', [cmd]);
        return true;
    } catch {
        return false;
    }
}

async function systemctlExists(unit: string): Promise<boolean> {
    try {
        await run('systemctl', ['--user', 'cat', unit]);
        return true;
    } catch {
        return false;
    }
}

async function systemctlIsEnabled(unit: string): Promise<{enabled: boolean; raw?: string}> {
    try {
        const out = await run('systemctl', ['--user', 'is-enabled', unit]);
        const raw = toText(out).trim();
        return {enabled: ENABLED_STATES.has(raw), raw};
    } catch (e: any) {
        const raw = String(e?.stderr ?? e?.message ?? '').trim();
        // disabled / not-found suelen ser exit!=0
        return {enabled: false, raw};
    }
}

async function systemctlIsActive(unit: string): Promise<{active: boolean; raw?: string}> {
    try {
        const out = await run('systemctl', ['--user', 'is-active', unit]);
        const raw = toText(out).trim();
        return {active: ACTIVE_STATES.has(raw), raw};
    } catch (e: any) {
        const raw = String(e?.stderr ?? e?.message ?? '').trim();
        return {active: false, raw};
    }
}

async function systemctlShowState(unit: string): Promise<{activeState?: string; subState?: string; error?: string}> {
    try {
        const out = await run('systemctl', [
            '--user',
            'show',
            unit,
            '-p',
            'ActiveState',
            '-p',
            'SubState',
            '--no-pager',
        ]);

        const text = toText(out);
        const map: Record<string, string> = {};
        for (const line of text.split('\n')) {
            const idx = line.indexOf('=');
            if (idx > 0) map[line.slice(0, idx)] = line.slice(idx + 1);
        }

        return {activeState: map.ActiveState, subState: map.SubState};
    } catch (e) {
        return {error: e instanceof Error ? e.message : String(e)};
    }
}

async function unitStatus(unit: string): Promise<UnitStatus> {
    const st: UnitStatus = {name: unit, exists: false};

    st.exists = await systemctlExists(unit);
    if (!st.exists) return st;

    const [en, ac, show] = await Promise.all([
        systemctlIsEnabled(unit),
        systemctlIsActive(unit),
        systemctlShowState(unit),
    ]);

    st.enabled = en.enabled;
    st.active = ac.active;
    st.activeState = show.activeState ?? ac.raw; // fallback
    st.subState = show.subState;
    st.error = show.error;

    return st;
}

async function swwwNamespaceQuery(namespace: string): Promise<{ok: boolean; error?: string}> {
    try {
        await run('swww', ['query', '--namespace', namespace]);
        return {ok: true};
    } catch (e) {
        return {ok: false, error: e instanceof Error ? e.message : String(e)};
    }
}

export async function getHealth(namespace: string): Promise<HealthReport> {
    const hints: string[] = [];

    const deps = {
        swww: await which('swww'),
        swwwDaemon: await which('swww-daemon'),
        hyprctl: await which('hyprctl'),
        systemctlUser: await which('systemctl'),
    };

    if (!deps.swww) hints.push('Missing dependency: swww');
    if (!deps.swwwDaemon) hints.push('Missing dependency: swww-daemon');
    if (!deps.hyprctl) hints.push('Missing dependency: hyprctl');
    if (!deps.systemctlUser) hints.push('Missing dependency: systemctl');

    const units = {
        swwwDaemonNs: await unitStatus(`swww-daemon@${namespace}.service`),
        watch: await unitStatus('hyprwall-watch.service'),
        nextService: await unitStatus('hyprwall-next.service'),
        nextTimer: await unitStatus('hyprwall-next.timer'),
    };

    for (const u of Object.values(units)) {
        if (!u.exists) hints.push(`Unit missing: ${u.name}`);
        else if (u.activeState === 'failed') hints.push(`Unit failed: ${u.name}`);
    }

    // hints específicas de enabled/active
    // - swww-daemon y watch deberían estar activos
    if (units.swwwDaemonNs.exists && !units.swwwDaemonNs.active) hints.push(`Unit not active: ${units.swwwDaemonNs.name}`);
    if (units.watch.exists && !units.watch.active) hints.push(`Unit not active: ${units.watch.name}`);

    // - timer debe estar enabled + active (waiting cuenta como active)
    if (units.nextTimer.exists && !units.nextTimer.enabled) hints.push(`Timer not enabled: ${units.nextTimer.name}`);
    if (units.nextTimer.exists && !units.nextTimer.active) hints.push(`Timer not active: ${units.nextTimer.name}`);

    // - next.service normalmente es static (enabled=false es OK)
    //   solo nos importa que exista

    const swww = await swwwNamespaceQuery(namespace);
    if (!swww.ok) hints.push(`swww query failed for namespace "${namespace}"`);

    const depsOk = deps.swww && deps.swwwDaemon && deps.hyprctl && deps.systemctlUser;

    const ok =
        depsOk &&
        units.swwwDaemonNs.exists &&
        units.nextService.exists &&
        units.nextTimer.exists &&
        units.watch.exists &&
        units.swwwDaemonNs.active === true &&
        units.watch.active === true &&
        units.nextTimer.enabled === true &&
        units.nextTimer.active === true &&
        swww.ok;

    return {ok, namespace, deps, units, swww: {namespaceQueryOk: swww.ok, error: swww.error}, hints};
}

export async function printDoctor(namespace: string): Promise<void> {
    const r = await getHealth(namespace);

    const line = (s: string) => console.log(s);
    const badge = (b: boolean) => (b ? '✅' : '❌');

    line(`hyprwall doctor (namespace="${namespace}")`);
    line('');

    line('Dependencies:');
    line(`  ${badge(r.deps.swww)} swww`);
    line(`  ${badge(r.deps.swwwDaemon)} swww-daemon`);
    line(`  ${badge(r.deps.hyprctl)} hyprctl`);
    line(`  ${badge(r.deps.systemctlUser)} systemctl (--user)`);
    line('');

    line('Systemd units (--user):');
    for (const u of Object.values(r.units)) {
        const ex = u.exists ? 'exists' : 'missing';
        const act = u.activeState ?? '-';
        const sub = u.subState ?? '-';
        const en = (u.enabled === undefined) ? '-' : (u.enabled ? 'enabled' : 'disabled');
        const ac = (u.active === undefined) ? '-' : (u.active ? 'active' : 'inactive');

        // next.service puede ser static: no la marcamos mal si "disabled"
        const isOk =
            u.exists &&
            (u.name === 'hyprwall-next.service' ? act !== 'failed' : (act !== 'failed' && u.active !== false));

        line(`  ${badge(isOk)} ${u.name}  (${ex}, ${act}/${sub}, ${en}, ${ac})`);
    }
    line('');

    line('swww namespace:');
    line(`  ${badge(r.swww.namespaceQueryOk)} swww query --namespace ${namespace}`);
    if (!r.swww.namespaceQueryOk && r.swww.error) line(`  error: ${r.swww.error}`);

    line('');
    line(`Overall: ${r.ok ? '✅ OK' : '❌ NOT OK'}`);

    if (r.hints.length) {
        line('');
        line('Hints:');
        for (const h of r.hints) line(`  - ${h}`);
        line('');
        line('Suggested fix:');
        line(`  hyprwall init --namespace ${namespace} --apply --force`);
    }
}