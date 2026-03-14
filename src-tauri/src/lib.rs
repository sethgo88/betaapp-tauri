#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_geolocation::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
