# Local verification commands (Windows PowerShell)
# Run these after starting the server with: uvicorn app.main:app --reload

$base = "http://127.0.0.1:8000"

Write-Host "=== Health Check ==="
Invoke-RestMethod "$base/healthz" | ConvertTo-Json

Write-Host "`n=== /risk/odri ==="
(Invoke-RestMethod "$base/risk/odri?limit=2" -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 5

Write-Host "`n=== /cdm ==="
(Invoke-RestMethod "$base/cdm?limit=2" -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 5

Write-Host "`n=== /simulate ==="
(Invoke-RestMethod "$base/simulate?limit=2" -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 5

Write-Host "`n=== /spaceweather ==="
(Invoke-RestMethod "$base/spaceweather" -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 5

Write-Host "`n=== DONE ==="
