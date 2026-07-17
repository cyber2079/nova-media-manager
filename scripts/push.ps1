# npm run push "your commit message"
$msg = $args -join " "
if (-not $msg) { $msg = "update" }

# ── 公库 ──
Write-Host "──── 公库 ────" -ForegroundColor DarkGray
Write-Host ">>> git add -A..." -ForegroundColor Cyan
git add -A

Write-Host ">>> git commit -m '$msg'..." -ForegroundColor Cyan
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
}

Write-Host ">>> git push origin master..." -ForegroundColor Cyan
$env:GIT_HTTP_LOW_SPEED_LIMIT = "0"
$env:GIT_HTTP_LOW_SPEED_TIME = "0"
$retries = 3
for ($i = 1; $i -le $retries; $i++) {
    git -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=0 push origin master
    if ($LASTEXITCODE -eq 0) { break }
    if ($i -lt $retries) {
        $wait = $i * 5
        Write-Host "Push failed (attempt $i/$retries), retrying in ${wait}s..." -ForegroundColor Yellow
        Start-Sleep $wait
    } else {
        Write-Host "Push failed after $retries attempts" -ForegroundColor Red
    }
}

# ── 私库 ──
Write-Host "──── 私库 ────" -ForegroundColor DarkGray
Set-Location D:\nova-proprietary

Write-Host ">>> git add -A..." -ForegroundColor Cyan
git add -A

Write-Host ">>> git commit -m '$msg'..." -ForegroundColor Cyan
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
}

Write-Host ">>> git push origin main..." -ForegroundColor Cyan
for ($i = 1; $i -le $retries; $i++) {
    git -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=0 push origin main
    if ($LASTEXITCODE -eq 0) { break }
    if ($i -lt $retries) {
        $wait = $i * 5
        Write-Host "Push failed (attempt $i/$retries), retrying in ${wait}s..." -ForegroundColor Yellow
        Start-Sleep $wait
    } else {
        Write-Host "Push failed after $retries attempts" -ForegroundColor Red
    }
}

Write-Host ">>> DONE!" -ForegroundColor Green
