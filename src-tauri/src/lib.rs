//! Iso Piping 3D desktop shell (Tauri v2).
//!
//! The whole application is the web build in ../dist; this crate only adds the
//! native dialog and file system plugins, plus the project file passed on the
//! command line when an .isop file is opened from Explorer.

use serde::Serialize;
use std::path::PathBuf;
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
struct OpenedFile {
    path: String,
    name: String,
    text: String,
}

/// Project file given on the command line (double-click on an .isop file).
/// Its path is added to the file system scope so it can be saved in place.
#[tauri::command]
fn initial_file(app: tauri::AppHandle) -> Option<OpenedFile> {
    let path = std::env::args_os().skip(1).map(PathBuf::from).find(|p| {
        p.is_file()
            && p
                .extension()
                .map_or(false, |e| e.eq_ignore_ascii_case("isop") || e.eq_ignore_ascii_case("json"))
    })?;
    let text = std::fs::read_to_string(&path).ok()?;
    let _ = app.fs_scope().allow_file(&path);
    Some(OpenedFile {
        name: path.file_name()?.to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
        text,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![initial_file])
        .run(tauri::generate_context!())
        .expect("error while running Iso Piping 3D");
}
