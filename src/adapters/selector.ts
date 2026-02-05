// Multi-output image selection with cooldowns and no-duplicate-per-tick rules.

import {Config} from "../core/config";
import {State} from "../core/state";

export interface OutputPick {
    output: string;
    path: string;
}

function tail<T>(arr: T[], n: number): T[] {
    if (n <= 0) return [];
    return arr.slice(Math.max(0, arr.length - n));
}

function buildBannedSets(
    state: State,
    outputs: string[],
    perOutputCooldown: number,
    globalCooldown: number
) {
    const bannedGlobal = new Set(tail(state.recent_global ?? [], globalCooldown));

    const bannedByOutput: Record<string, Set<string>> = {};
    for (const out of outputs) {
        const q = state.recent_by_output?.[out] ?? [];
        bannedByOutput[out] = new Set(tail(q, perOutputCooldown));
    }

    return {bannedGlobal, bannedByOutput};
}

/**
 * Selecciona una imagen por output cumpliendo:
 * - cooldown por output (perOutputCooldown)
 * - cooldown global (globalCooldown)
 * - evitar duplicados en el mismo tick
 * Degrada reglas de forma segura si el pool es pequeño.
 *
 * IMPORTANTE:
 * - Este selector SOLO LEE el state.
 * - La persistencia/recents se actualiza en core/state.ts vía commitSelection()
 */
export function pickImagesForOutputs(
    outputs: string[],
    pool: string[],
    config: Config,
    state: State
): OutputPick[] {
    const sel = config.selection;

    const perN = Math.max(0, Math.floor(sel.perOutputCooldown ?? 0));
    const globM = Math.max(0, Math.floor(sel.globalCooldown ?? 0));
    const avoidTickDup = !!sel.avoidSameTickDuplicates;

    const {bannedGlobal, bannedByOutput} = buildBannedSets(state, outputs, perN, globM);

    const usedThisTick = new Set<string>();
    const result: OutputPick[] = [];

    if (!pool || pool.length === 0) return result;

    // Pequeña mejora: recorremos el pool en un orden pseudo-aleatorio por tick,
    // para no quedarnos siempre con el primer "match".
    const start = Math.floor(Math.random() * pool.length);

    const iterPool = function* (): Generator<string> {
        for (let i = 0; i < pool.length; i++) {
            yield pool[(start + i) % pool.length];
        }
    };

    for (const output of outputs) {
        const blockedOut = bannedByOutput[output] ?? new Set<string>();

        const attempts: Array<(p: string) => boolean> = [
            // 1) regla completa
            (p) =>
                !blockedOut.has(p) &&
                !bannedGlobal.has(p) &&
                (!avoidTickDup || !usedThisTick.has(p)),

            // 2) permite romper global, pero mantiene per-output
            (p) => !blockedOut.has(p) && (!avoidTickDup || !usedThisTick.has(p)),

            // 3) permite romper per-output, mantiene global
            (p) => !bannedGlobal.has(p) && (!avoidTickDup || !usedThisTick.has(p)),

            // 4) solo evita duplicados en tick (si aplica)
            (p) => !avoidTickDup || !usedThisTick.has(p),

            // 5) cualquier cosa
            (_p) => true
        ];

        let chosen: string | undefined;

        for (const rule of attempts) {
            for (const candidate of iterPool()) {
                if (rule(candidate)) {
                    chosen = candidate;
                    break;
                }
            }
            if (chosen) break;
        }

        if (!chosen) continue;

        result.push({output, path: chosen});
        usedThisTick.add(chosen);
    }

    return result;
}

// ⚠️ updateRecents eliminado: ahora se hace en core/state.ts con commitSelection()