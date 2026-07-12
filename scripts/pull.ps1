Write-Host ">>> git pull (public repo)..." -ForegroundColor Cyan
git pull origin master
Write-Host ">>> git pull (private repo)..." -ForegroundColor Cyan
cd D:\nova-proprietary
git pull origin main
cd D:\nova-media-manager
Write-Host ">>> Done!" -ForegroundColor Green
