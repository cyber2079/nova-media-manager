$failed = $false

Write-Host ">>> git pull (public repo)..." -ForegroundColor Cyan
git pull origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "!!! 公库 pull 失败（检查网络/代理）" -ForegroundColor Red
    $failed = $true
}

Write-Host ">>> git pull (private repo)..." -ForegroundColor Cyan
cd D:\nova-proprietary
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "!!! 私库 pull 失败（检查网络/代理）" -ForegroundColor Red
    $failed = $true
}
cd D:\nova-media-manager

if ($failed) {
    Write-Host ">>> FAILED — 有仓库没拉取成功！" -ForegroundColor Red
    exit 1
}
Write-Host ">>> Done!" -ForegroundColor Green
