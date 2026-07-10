#[tauri::command]
pub fn open_file_properties(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_wallpaper(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Pass path via env var to prevent PowerShell injection
        std::process::Command::new("powershell")
            .args([
                "-NoProfile", "-Command",
                r#"Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll",CharSet=CharSet.Auto)]public static extern int SystemParametersInfo(int a,int b,string c,int d);}';[W]::SystemParametersInfo(20,0,$env:WALLPAPER_PATH,3);Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value 10;Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value 0"#,
            ])
            .env("WALLPAPER_PATH", &path)
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(r#"tell application "Finder" to set desktop picture to POSIX file "{}""#, path),
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
