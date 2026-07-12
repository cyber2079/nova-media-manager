# npm run push "your commit message"
$msg = $args -join " "
if (-not $msg) { $msg = "update" }

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
} else {
    Write-Host ">>> DONE!" -ForegroundColor Green
}
