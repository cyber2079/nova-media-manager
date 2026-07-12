$msg = if ($args.Count -gt 0) { $args[0] } else { "update" }

Write-Host ">>> git add -A..." -ForegroundColor Cyan
git add -A

Write-Host ">>> git commit -m '$msg'..." -ForegroundColor Cyan
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit or commit failed." -ForegroundColor Yellow
    exit 0
}

Write-Host ">>> git push origin master..." -ForegroundColor Cyan
git push origin master
Write-Host ">>> DONE!" -ForegroundColor Green
