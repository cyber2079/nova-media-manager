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
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed — retry in a moment" -ForegroundColor Red
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
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed — retry in a moment" -ForegroundColor Red
}

Write-Host ">>> DONE!" -ForegroundColor Green
