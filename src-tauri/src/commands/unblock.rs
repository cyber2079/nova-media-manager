/// Remove the Zone.Identifier alternate data stream (Mark of the Web)
/// from a file. This prevents Windows SmartScreen "Open File - Security Warning"
/// prompts when reading or launching downloaded files.
#[tauri::command]
pub fn unblock_file(path: String) -> Result<(), String> {
    let zone_path = format!("{}:Zone.Identifier", &path);
    // Ignore errors — the ADS might not exist, or we might not have permission
    let _ = std::fs::remove_file(&zone_path);
    Ok(())
}
