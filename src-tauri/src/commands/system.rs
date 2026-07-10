use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub cpu: f32,
    pub memory: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub disk: f32,
    pub disk_used: u64,
    pub disk_total: u64,
    pub net_down: f64,  // KB/s
    pub net_up: f64,    // KB/s
}

static LAST_NET: Mutex<Option<(Instant, u64, u64)>> = Mutex::new(None);

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    use sysinfo::{System, Networks};

    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu = sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32;

    let mem_used = sys.used_memory();
    let mem_total = sys.total_memory();
    let memory = if mem_total > 0 {
        (mem_used as f32 / mem_total as f32) * 100.0
    } else { 0.0 };

    let (disk_used, disk_total, disk_pct) = if cfg!(target_os = "windows") {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        disks.iter()
            .find(|d| d.mount_point().to_string_lossy().starts_with("C:"))
            .map(|d| {
                let total = d.total_space();
                let free = d.available_space();
                let used = total.saturating_sub(free);
                (used, total, if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 })
            })
            .unwrap_or((0, 0, 0.0))
    } else {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        disks.first()
            .map(|d| {
                let total = d.total_space();
                let free = d.available_space();
                let used = total.saturating_sub(free);
                (used, total, if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 })
            })
            .unwrap_or((0, 0, 0.0))
    };

    // Network rate
    let (net_down, net_up) = {
        let nets = Networks::new_with_refreshed_list();
        let total_rx: u64 = nets.iter().map(|(_, d)| d.total_received()).sum();
        let total_tx: u64 = nets.iter().map(|(_, d)| d.total_transmitted()).sum();

        let now = Instant::now();
        let mut last = LAST_NET.lock().unwrap();
        let rate = if let Some((prev_time, prev_rx, prev_tx)) = *last {
            let elapsed = now.duration_since(prev_time).as_secs_f64();
            if elapsed > 0.0 {
                let down = ((total_rx.saturating_sub(prev_rx)) as f64 / 1024.0) / elapsed;
                let up = ((total_tx.saturating_sub(prev_tx)) as f64 / 1024.0) / elapsed;
                (down, up)
            } else { (0.0, 0.0) }
        } else { (0.0, 0.0) };
        *last = Some((now, total_rx, total_tx));
        rate
    };

    Ok(SystemInfo {
        cpu: cpu.min(100.0).max(0.0),
        memory: memory.min(100.0).max(0.0),
        memory_used: mem_used,
        memory_total: mem_total,
        disk: disk_pct.min(100.0).max(0.0),
        disk_used,
        disk_total,
        net_down: (net_down * 10.0).round() / 10.0,
        net_up: (net_up * 10.0).round() / 10.0,
    })
}
