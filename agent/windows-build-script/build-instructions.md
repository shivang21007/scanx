## Run this to build msi 
```
cd C:\Users\Octro\Downloads\scanx\agent\dist\msi-build\taskSchedulerApproach; Remove-Item scanx-v*.msi, *.wixobj, *.wixpdb -Force -ErrorAction SilentlyContinue; Write-Host "`nRebuilding MSI with enhanced error handling..." -ForegroundColor Cyan; .\build-msi.ps1
```