use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use thiserror::Error;

type Json = Value;

#[derive(Debug, Error)]
enum UiError {
    #[error("command failed: {0}")]
    CommandFailed(String),
    #[error("invalid json: {0}")]
    InvalidJson(String),
}

fn resolve_hyprwall_cmd() -> Vec<String> {
    // Prefer local project CLI (absolute path) to avoid mismatches with globally installed hyprwall.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let local_cli_abs = manifest_dir.join("../../dist/cli.js");
    if local_cli_abs.exists() {
        return vec!["node".to_string(), local_cli_abs.to_string_lossy().to_string()];
    }

    // Secondary fallback: old relative path (cwd dependent).
    let local_cli_rel = PathBuf::from("../../dist/cli.js");
    if local_cli_rel.exists() {
        return vec!["node".to_string(), local_cli_rel.to_string_lossy().to_string()];
    }

    // Optional override for advanced users.
    if let Ok(cmd) = std::env::var("HYPRWALL_CMD") {
        return cmd.split_whitespace().map(|s| s.to_string()).collect();
    }

    vec!["hyprwall".to_string()]
}

fn run_hyprwall(args: &[&str]) -> Result<Json, UiError> {
    let mut cmd_parts = resolve_hyprwall_cmd();
    let base = cmd_parts.remove(0);
    let mut command = Command::new(base);
    if !cmd_parts.is_empty() {
        command.args(cmd_parts);
    }
    command.args(args);

    let output = command.output().map_err(|e| UiError::CommandFailed(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // CLI contract: with --json, exit 0 (ok) and exit 2 (warning/action required)
    // are both valid machine-readable responses.
    if let Ok(json) = serde_json::from_str::<Json>(&stdout) {
        return Ok(json);
    }

    if !output.status.success() {
        let msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        return Err(UiError::CommandFailed(msg));
    }

    Err(UiError::InvalidJson(stdout))
}

fn run_hyprwall_raw(args: &[&str]) -> Result<String, UiError> {
    let mut cmd_parts = resolve_hyprwall_cmd();
    let base = cmd_parts.remove(0);
    let mut command = Command::new(base);
    if !cmd_parts.is_empty() {
        command.args(cmd_parts);
    }
    command.args(args);

    let output = command.output().map_err(|e| UiError::CommandFailed(e.to_string()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        return Err(UiError::CommandFailed(msg));
    }

    Ok(stdout)
}

fn systemctl_show(unit: &str, props: &[&str]) -> Result<Json, String> {
    let mut cmd = Command::new("systemctl");
    cmd.args(["--user", "show", unit, "--no-pager"]);
    for p in props {
        cmd.arg("-p").arg(p);
    }
    let out = cmd.output().map_err(|e| format!("systemctl error: {}", e))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    let mut obj = serde_json::Map::new();
    for line in text.lines() {
        if let Some((k, v)) = line.split_once('=') {
            obj.insert(k.to_string(), serde_json::json!(v));
        }
    }
    Ok(Json::Object(obj))
}

#[tauri::command]
fn hyprwall_check(namespace: Option<String>) -> Result<Json, String> {
    let ns = namespace.unwrap_or_else(|| "hyprwall".to_string());
    run_hyprwall(&["check", "--namespace", &ns, "--json"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_status() -> Result<Json, String> {
    run_hyprwall(&["status"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_next(namespace: Option<String>, force: Option<bool>, pack: Option<String>) -> Result<Json, String> {
    let ns = namespace.unwrap_or_else(|| "hyprwall".to_string());
    let mut args: Vec<String> = vec![
        "next".to_string(),
        "--namespace".to_string(),
        ns,
        "--json".to_string()
    ];
    if force.unwrap_or(false) {
        args.push("--force".to_string());
    }
    if let Some(pack_name) = pack {
        if !pack_name.trim().is_empty() {
            args.push("--pack".to_string());
            args.push(pack_name);
        }
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&arg_refs).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_init_apply(namespace: Option<String>) -> Result<Json, String> {
    let ns = namespace.unwrap_or_else(|| "hyprwall".to_string());
    run_hyprwall(&["init", "--namespace", &ns, "--apply", "--force", "--json"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_hydrate_pack(name: String, count: u32) -> Result<Json, String> {
    let count_str = count.to_string();
    run_hyprwall(&["hydrate-pack", &name, "--count", &count_str]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_cache_prune() -> Result<Json, String> {
    run_hyprwall(&["cache-prune-hard"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_cache_prune_pack(name: String) -> Result<Json, String> {
    run_hyprwall(&["cache-prune-pack-hard", &name]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_list_packs() -> Result<Json, String> {
    run_hyprwall(&["list-packs"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_list_pack_folders() -> Result<Json, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = PathBuf::from(home).join("Pictures").join("Wallpapers");
    let mut names: Vec<String> = vec![];
    if dir.exists() {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    names.push(name.to_string());
                }
            }
        }
    }
    names.sort();
    Ok(serde_json::json!({ "folders": names }))
}

fn is_image_ext(path: &PathBuf) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" | "avif")
}

#[tauri::command]
fn hyprwall_wallpapers_list() -> Result<Json, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let root = PathBuf::from(home).join("Pictures").join("Wallpapers");
    let mut items: Vec<Json> = vec![];

    if !root.exists() {
        return Ok(serde_json::json!({
            "ok": true,
            "root": root,
            "items": items
        }));
    }

    let root_canon = fs::canonicalize(&root).map_err(|e| e.to_string())?;
    let mut stack: Vec<PathBuf> = vec![root_canon.clone()];

    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(v) => v,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if !is_image_ext(&path) {
                continue;
            }

            let abs = match fs::canonicalize(&path) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let rel = match abs.strip_prefix(&root_canon) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let rel_parts: Vec<String> = rel
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect();
            let pack = rel_parts
                .first()
                .cloned()
                .unwrap_or_else(|| "root".to_string());
            let file_name = abs
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let modified_ms = fs::metadata(&abs)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            items.push(serde_json::json!({
                "path": abs,
                "pack": pack,
                "fileName": file_name,
                "modifiedMs": modified_ms
            }));
        }
    }

    items.sort_by(|a, b| {
        let am = a.get("modifiedMs").and_then(|v| v.as_u64()).unwrap_or(0);
        let bm = b.get("modifiedMs").and_then(|v| v.as_u64()).unwrap_or(0);
        bm.cmp(&am)
    });

    Ok(serde_json::json!({
        "ok": true,
        "root": root_canon,
        "items": items
    }))
}

#[tauri::command]
fn hyprwall_open_pack_folder(name: String) -> Result<Json, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let root = PathBuf::from(home).join("Pictures").join("Wallpapers");
    if !root.exists() {
        return Err(format!("Wallpaper root not found: {}", root.display()));
    }

    let target_norm = name.trim().to_lowercase().replace([' ', '_'], "-");
    let mut chosen: Option<PathBuf> = None;
    let entries = fs::read_dir(&root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let file_name = entry.file_name();
        let folder = file_name.to_string_lossy().to_string();
        let folder_norm = folder.to_lowercase().replace([' ', '_'], "-");
        if folder_norm == target_norm {
            chosen = Some(p);
            break;
        }
    }

    let path = chosen.unwrap_or_else(|| root.join(&name));
    if !path.exists() {
        return Err(format!("Pack folder not found: {}", path.display()));
    }

    let status = Command::new("xdg-open")
        .arg(&path)
        .status()
        .map_err(|e| format!("failed to run xdg-open: {}", e))?;
    if !status.success() {
        return Err(format!("xdg-open failed with status: {}", status));
    }

    Ok(serde_json::json!({ "ok": true, "path": path }))
}

#[tauri::command]
fn hyprwall_settings_get() -> Result<Json, String> {
    run_hyprwall(&["settings", "get"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_settings_set(
    mode: Option<String>,
    rotation_interval_sec: Option<u32>,
    transition_type: Option<String>,
    transition_fps: Option<u32>,
    transition_duration: Option<f64>,
    transition_angle: Option<f64>,
    transition_pos: Option<String>,
) -> Result<Json, String> {
    let mut args: Vec<String> = vec!["settings".into(), "set".into()];
    if let Some(v) = mode { args.push("--mode".into()); args.push(v); }
    if let Some(v) = rotation_interval_sec { args.push("--rotation-interval-sec".into()); args.push(v.to_string()); }
    if let Some(v) = transition_type { args.push("--transition-type".into()); args.push(v); }
    if let Some(v) = transition_fps { args.push("--transition-fps".into()); args.push(v.to_string()); }
    if let Some(v) = transition_duration { args.push("--transition-duration".into()); args.push(v.to_string()); }
    if let Some(v) = transition_angle { args.push("--transition-angle".into()); args.push(v.to_string()); }
    if let Some(v) = transition_pos { args.push("--transition-pos".into()); args.push(v); }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_history_list(limit: Option<u32>) -> Result<Json, String> {
    let mut args: Vec<String> = vec!["history".into()];
    if let Some(v) = limit {
        args.push("--limit".into());
        args.push(v.to_string());
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_history_clear() -> Result<Json, String> {
    run_hyprwall(&["history", "clear"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_favorites_list() -> Result<Json, String> {
    run_hyprwall(&["favorites"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_favorite_add(path: String) -> Result<Json, String> {
    run_hyprwall(&["favorite", "add", &path]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_favorite_remove(path: String) -> Result<Json, String> {
    run_hyprwall(&["favorite", "remove", &path]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_logs(
    limit: Option<u32>,
    source: Option<String>,
    pack: Option<String>,
    level: Option<String>,
    q: Option<String>,
) -> Result<Json, String> {
    let mut args: Vec<String> = vec!["logs".into()];
    if let Some(v) = limit {
        args.push("--limit".into());
        args.push(v.to_string());
    }
    if let Some(v) = source {
        let s = v.trim().to_string();
        if !s.is_empty() {
            args.push("--source".into());
            args.push(s);
        }
    }
    if let Some(v) = pack {
        let s = v.trim().to_string();
        if !s.is_empty() {
            args.push("--pack".into());
            args.push(s);
        }
    }
    if let Some(v) = level {
        let s = v.trim().to_string();
        if !s.is_empty() {
            args.push("--level".into());
            args.push(s);
        }
    }
    if let Some(v) = q {
        let s = v.trim().to_string();
        if !s.is_empty() {
            args.push("--q".into());
            args.push(s);
        }
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_logs_clear() -> Result<Json, String> {
    run_hyprwall(&["logs", "clear"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_install_timer(every: String) -> Result<Json, String> {
    let every_clean = every.trim();
    if every_clean.is_empty() {
        return Err("every is required".to_string());
    }
    let out = run_hyprwall_raw(&["install-systemd", "--every", every_clean]).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
      "ok": true,
      "every": every_clean,
      "output": out
    }))
}

#[tauri::command]
fn hyprwall_source_keys_get() -> Result<Json, String> {
    let packs = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let mut wallhaven = serde_json::json!({"value": null, "apiKeyEnv": null, "pack": null});
    let mut unsplash = serde_json::json!({"value": null, "apiKeyEnv": null, "pack": null});

    if let Some(obj) = packs.get("packs").and_then(|v| v.as_object()) {
        for (name, pack) in obj {
            let t = pack.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if t == "wallhaven" && wallhaven.get("pack").and_then(|v| v.as_str()).is_none() {
                wallhaven = serde_json::json!({
                  "value": pack.get("apiKey").and_then(|v| v.as_str()),
                  "apiKeyEnv": pack.get("apiKeyEnv").and_then(|v| v.as_str()),
                  "pack": name
                });
            }
            if t == "unsplash" && unsplash.get("pack").and_then(|v| v.as_str()).is_none() {
                unsplash = serde_json::json!({
                  "value": pack.get("apiKey").and_then(|v| v.as_str()),
                  "apiKeyEnv": pack.get("apiKeyEnv").and_then(|v| v.as_str()),
                  "pack": name
                });
            }
        }
    }

    Ok(serde_json::json!({
      "ok": true,
      "wallhaven": wallhaven,
      "unsplash": unsplash
    }))
}

#[tauri::command]
fn hyprwall_source_keys_set(
    wallhaven_key: Option<String>,
    unsplash_key: Option<String>,
    wallhaven_env: Option<String>,
    unsplash_env: Option<String>,
    use_env: Option<bool>
) -> Result<Json, String> {
    let wallhaven_key = wallhaven_key.unwrap_or_default().trim().to_string();
    let unsplash_key = unsplash_key.unwrap_or_default().trim().to_string();
    let wallhaven_env = wallhaven_env.unwrap_or_else(|| "WALLHAVEN_KEY".to_string()).trim().to_string();
    let unsplash_env = unsplash_env.unwrap_or_else(|| "UNSPLASH_KEY".to_string()).trim().to_string();
    let use_env = use_env.unwrap_or(false);

    if !use_env && wallhaven_key.is_empty() && unsplash_key.is_empty() {
        return Err("No API key provided".to_string());
    }

    let packs = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let mut wallhaven_updated: Vec<String> = vec![];
    let mut unsplash_updated: Vec<String> = vec![];

    if let Some(obj) = packs.get("packs").and_then(|v| v.as_object()) {
        for (name, pack) in obj {
            let t = pack.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if t == "wallhaven" {
                if use_env {
                    run_hyprwall(&["pack", "set-key", name, "--api-key-env", &wallhaven_env]).map_err(|e| e.to_string())?;
                } else if !wallhaven_key.is_empty() {
                    run_hyprwall(&["pack", "set-key", name, "--api-key", &wallhaven_key]).map_err(|e| e.to_string())?;
                }
                wallhaven_updated.push(name.to_string());
            }
            if t == "unsplash" {
                if use_env {
                    run_hyprwall(&["pack", "set-key", name, "--api-key-env", &unsplash_env]).map_err(|e| e.to_string())?;
                } else if !unsplash_key.is_empty() {
                    run_hyprwall(&["pack", "set-key", name, "--api-key", &unsplash_key]).map_err(|e| e.to_string())?;
                }
                unsplash_updated.push(name.to_string());
            }
        }
    }

    Ok(serde_json::json!({
      "ok": true,
      "updated": {
        "wallhaven": wallhaven_updated,
        "unsplash": unsplash_updated
      }
    }))
}

#[tauri::command]
fn hyprwall_timer_status() -> Result<Json, String> {
    let timer = systemctl_show(
        "hyprwall-next.timer",
        &[
            "Id",
            "UnitFileState",
            "ActiveState",
            "SubState",
            "NextElapseUSecRealtime",
            "LastTriggerUSec",
        ],
    )?;
    let service = systemctl_show(
        "hyprwall-next.service",
        &["Id", "UnitFileState", "ActiveState", "SubState"],
    )?;

    Ok(serde_json::json!({
      "ok": true,
      "timer": timer,
      "service": service
    }))
}

#[tauri::command]
fn hyprwall_pack_list_raw() -> Result<Json, String> {
    run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_pack_remove(name: String) -> Result<Json, String> {
    run_hyprwall(&["pack", "remove", &name]).map_err(|e| e.to_string())
}

#[tauri::command]
fn hyprwall_pack_upsert_wallhaven(
    name: String,
    keyword: String,
    subthemes: Option<String>,
    api_key: Option<String>,
    categories: Option<String>,
    purity: Option<String>,
    ratios: Option<String>,
    colors: Option<String>,
    atleast: Option<String>,
    sorting: Option<String>,
    ai_art: Option<bool>,
    allow_sfw: Option<bool>,
    allow_sketchy: Option<bool>,
    allow_nsfw: Option<bool>,
    category_general: Option<bool>,
    category_anime: Option<bool>,
    category_people: Option<bool>,
    ttl_sec: Option<u32>,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    let key = keyword.trim().to_string();
    if pack_name.is_empty() || key.is_empty() {
        return Err("name and keyword are required".to_string());
    }

    // Decide add/update based on current config.
    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let mut args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "wallhaven".into(),
        "--keyword".into(),
        key,
    ];

    if let Some(subs) = subthemes {
        let subs_clean = subs.trim();
        if !subs_clean.is_empty() {
            args.push("--subthemes".into());
            args.push(subs_clean.to_string());
        }
    }
    if let Some(v) = categories {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--categories".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = purity {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--purity".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = ratios {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--ratios".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = colors {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--colors".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = atleast {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--atleast".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = sorting {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--sorting".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = ai_art {
        args.push("--ai-art".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = allow_sfw {
        args.push("--allow-sfw".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = allow_sketchy {
        args.push("--allow-sketchy".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = allow_nsfw {
        args.push("--allow-nsfw".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = category_general {
        args.push("--category-general".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = category_anime {
        args.push("--category-anime".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = category_people {
        args.push("--category-people".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = ttl_sec {
        args.push("--ttl-sec".into());
        args.push(v.to_string());
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    if let Some(api) = api_key {
        let api_clean = api.trim();
        if !api_clean.is_empty() {
            run_hyprwall(&["pack", "set-key", &pack_name, "--api-key", api_clean]).map_err(|e| e.to_string())?;
        }
    }

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "wallhaven"}))
}

#[tauri::command]
fn hyprwall_pack_upsert_unsplash(
    name: String,
    query: String,
    subthemes: Option<String>,
    api_key: Option<String>,
    orientation: Option<String>,
    content_filter: Option<String>,
    topics: Option<String>,
    collections: Option<String>,
    username: Option<String>,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_fit: Option<String>,
    image_quality: Option<u32>,
    ttl_sec: Option<u32>,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    let q = query.trim().to_string();
    if pack_name.is_empty() || q.is_empty() {
        return Err("name and query are required".to_string());
    }

    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let mut args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "unsplash".into(),
        "--query".into(),
        q,
    ];

    if let Some(v) = subthemes {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--subthemes".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = orientation {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--orientation".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = content_filter {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--content-filter".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = topics {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--topics".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = collections {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--collections".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = username {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--username".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = image_width {
        args.push("--image-width".into());
        args.push(v.to_string());
    }
    if let Some(v) = image_height {
        args.push("--image-height".into());
        args.push(v.to_string());
    }
    if let Some(v) = image_fit {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--image-fit".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = image_quality {
        args.push("--image-quality".into());
        args.push(v.to_string());
    }
    if let Some(v) = ttl_sec {
        args.push("--ttl-sec".into());
        args.push(v.to_string());
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    if let Some(api) = api_key {
        let api_clean = api.trim();
        if !api_clean.is_empty() {
            run_hyprwall(&["pack", "set-key", &pack_name, "--api-key", api_clean]).map_err(|e| e.to_string())?;
        }
    }

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "unsplash"}))
}

#[tauri::command]
fn hyprwall_pack_upsert_reddit(
    name: String,
    subreddits: Option<String>,
    subthemes: Option<String>,
    allow_sfw: Option<bool>,
    min_width: Option<u32>,
    min_height: Option<u32>,
    ratio_w: Option<u32>,
    ratio_h: Option<u32>,
    ttl_sec: Option<u32>,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    if pack_name.is_empty() {
        return Err("name is required".to_string());
    }

    let subs = subreddits.unwrap_or_default().trim().to_string();
    if subs.is_empty() {
        return Err("subreddits is required".to_string());
    }

    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let mut args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "reddit".into(),
        "--subreddits".into(),
        subs,
    ];

    if let Some(v) = subthemes {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--subthemes".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = allow_sfw {
        args.push("--allow-sfw".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = min_width {
        args.push("--min-width".into());
        args.push(v.to_string());
    }
    if let Some(v) = min_height {
        args.push("--min-height".into());
        args.push(v.to_string());
    }
    if let Some(v) = ratio_w {
        args.push("--ratio-w".into());
        args.push(v.to_string());
    }
    if let Some(v) = ratio_h {
        args.push("--ratio-h".into());
        args.push(v.to_string());
    }
    if let Some(v) = ttl_sec {
        args.push("--ttl-sec".into());
        args.push(v.to_string());
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "reddit"}))
}

#[tauri::command]
fn hyprwall_pack_upsert_generic_json(
    name: String,
    endpoint: String,
    image_path: String,
    image_prefix: Option<String>,
    post_path: Option<String>,
    post_prefix: Option<String>,
    author_name_path: Option<String>,
    author_url_path: Option<String>,
    author_url_prefix: Option<String>,
    domain: Option<String>,
    ttl_sec: Option<u32>,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    let endpoint_clean = endpoint.trim().to_string();
    let image_path_clean = image_path.trim().to_string();
    if pack_name.is_empty() || endpoint_clean.is_empty() || image_path_clean.is_empty() {
        return Err("name, endpoint and imagePath are required".to_string());
    }

    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let mut args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "generic_json".into(),
        "--endpoint".into(),
        endpoint_clean,
        "--image-path".into(),
        image_path_clean,
    ];

    if let Some(v) = image_prefix {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--image-prefix".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = post_path {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--post-path".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = post_prefix {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--post-prefix".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = author_name_path {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--author-name-path".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = author_url_path {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--author-url-path".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = author_url_prefix {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--author-url-prefix".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = domain {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--domain".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = ttl_sec {
        args.push("--ttl-sec".into());
        args.push(v.to_string());
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "generic_json"}))
}

#[tauri::command]
fn hyprwall_pack_upsert_static_url(
    name: String,
    url: Option<String>,
    urls: Option<String>,
    author_name: Option<String>,
    author_url: Option<String>,
    domain: Option<String>,
    post_url: Option<String>,
    different_images: Option<bool>,
    count: Option<u32>,
    ttl_sec: Option<u32>,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    if pack_name.is_empty() {
        return Err("name is required".to_string());
    }

    let url_clean = url.unwrap_or_default().trim().to_string();
    let urls_clean = urls.unwrap_or_default().trim().to_string();
    if url_clean.is_empty() && urls_clean.is_empty() {
        return Err("url or urls is required".to_string());
    }

    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let mut args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "static_url".into(),
    ];

    if !url_clean.is_empty() {
        args.push("--url".into());
        args.push(url_clean);
    }
    if !urls_clean.is_empty() {
        args.push("--urls".into());
        args.push(urls_clean);
    }
    if let Some(v) = author_name {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--author-name".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = author_url {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--author-url".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = domain {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--domain".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = post_url {
        let s = v.trim();
        if !s.is_empty() {
            args.push("--post-url".into());
            args.push(s.to_string());
        }
    }
    if let Some(v) = different_images {
        args.push("--different-images".into());
        args.push(if v { "true" } else { "false" }.into());
    }
    if let Some(v) = count {
        args.push("--count".into());
        args.push(v.to_string());
    }
    if let Some(v) = ttl_sec {
        args.push("--ttl-sec".into());
        args.push(v.to_string());
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "static_url"}))
}

#[tauri::command]
fn hyprwall_pack_upsert_local(
    name: String,
    paths: String,
) -> Result<Json, String> {
    let pack_name = name.trim().to_string();
    if pack_name.is_empty() {
        return Err("name is required".to_string());
    }
    let paths_clean = paths.trim().to_string();
    if paths_clean.is_empty() {
        return Err("paths is required".to_string());
    }

    let raw = run_hyprwall(&["pack", "list"]).map_err(|e| e.to_string())?;
    let exists = raw
        .get("packs")
        .and_then(|v| v.as_object())
        .map(|o| o.contains_key(&pack_name))
        .unwrap_or(false);
    let action = if exists { "update" } else { "add" };

    let args: Vec<String> = vec![
        "pack".into(),
        action.into(),
        pack_name.clone(),
        "--type".into(),
        "local".into(),
        "--paths".into(),
        paths_clean,
    ];
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_hyprwall(&refs).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"ok": true, "name": pack_name, "action": action, "type": "local"}))
}

#[tauri::command]
fn hyprwall_pick_folder() -> Result<Json, String> {
    let selected = rfd::FileDialog::new().pick_folder();
    let path = selected.map(|p| p.to_string_lossy().to_string());
    Ok(serde_json::json!({ "path": path }))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            hyprwall_check,
            hyprwall_status,
            hyprwall_next,
            hyprwall_init_apply,
            hyprwall_hydrate_pack,
            hyprwall_cache_prune,
            hyprwall_cache_prune_pack,
            hyprwall_list_packs,
            hyprwall_list_pack_folders,
            hyprwall_wallpapers_list,
            hyprwall_open_pack_folder,
            hyprwall_settings_get,
            hyprwall_settings_set,
            hyprwall_history_list,
            hyprwall_history_clear,
            hyprwall_logs,
            hyprwall_logs_clear,
            hyprwall_favorites_list,
            hyprwall_favorite_add,
            hyprwall_favorite_remove,
            hyprwall_install_timer,
            hyprwall_timer_status,
            hyprwall_source_keys_get,
            hyprwall_source_keys_set,
            hyprwall_pack_list_raw,
            hyprwall_pack_remove,
            hyprwall_pack_upsert_wallhaven,
            hyprwall_pack_upsert_unsplash,
            hyprwall_pack_upsert_reddit,
            hyprwall_pack_upsert_generic_json,
            hyprwall_pack_upsert_static_url,
            hyprwall_pack_upsert_local,
            hyprwall_pick_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
