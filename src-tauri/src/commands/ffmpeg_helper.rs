use std::path::PathBuf;

/// Resolve ffmpeg binary path. Checks bundled resource first, falls back to sidecar download.
pub fn ffmpeg_path() -> PathBuf {
    // Check bundled resource (placed next to exe at build time)
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe.parent().unwrap().join("ffmpeg-bin").join("ffmpeg.exe");
        if bundled.exists() {
            return bundled;
        }
    }
    // Fallback to ffmpeg-sidecar
    ffmpeg_sidecar::paths::ffmpeg_path()
}

/// Resolve ffprobe binary path. Checks bundled resource first, falls back to sidecar download.
pub fn ffprobe_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe.parent().unwrap().join("ffmpeg-bin").join("ffprobe.exe");
        if bundled.exists() {
            return bundled;
        }
    }
    ffmpeg_sidecar::ffprobe::ffprobe_path()
}

/// Ensure ffmpeg is available. Downloads via sidecar if neither bundled nor cached.
pub fn ensure_ffmpeg() {
    let ff = ffmpeg_path();
    if !ff.exists() {
        ffmpeg_sidecar::download::auto_download().ok();
    }
}

/// Ensure ffprobe is available. Downloads via sidecar if neither bundled nor cached.
pub fn ensure_ffprobe() {
    let fp = ffprobe_path();
    if !fp.exists() {
        ffmpeg_sidecar::download::auto_download().ok();
    }
}
