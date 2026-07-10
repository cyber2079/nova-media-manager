use std::process::Command;

/// Download ffmpeg via ffmpeg-sidecar, then convert video to animated WebP
#[tauri::command]
pub fn convert_video_to_webp(input: String, output: String) -> Result<String, String> {
    // Ensure ffmpeg is downloaded via sidecar
    let ffmpeg_bin = ffmpeg_sidecar::paths::ffmpeg_path();
    if !ffmpeg_bin.exists() {
        ffmpeg_sidecar::download::auto_download()
            .map_err(|e| format!("Failed to download ffmpeg: {}", e))?;
    }

    let status = Command::new(&ffmpeg_bin)
        .args([
            "-i", &input,
            "-vcodec", "libwebp",
            "-lossless", "0",
            "-q:v", "80",
            "-loop", "0",
            "-preset", "default",
            "-y",
            &output,
        ])
        .status()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if status.success() {
        Ok(output)
    } else {
        Err("ffmpeg conversion failed".into())
    }
}
