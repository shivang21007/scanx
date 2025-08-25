@echo off
echo Building scanx MSI...

REM Compile WiX sources
candle scanx.wxs config-dialog.wxs
if %ERRORLEVEL% neq 0 goto error

REM Link to create MSI
light -ext WixUIExtension scanx.wixobj config-dialog.wixobj -o scanx.msi
if %ERRORLEVEL% neq 0 goto error

echo MSI created successfully: scanx.msi
goto end

:error
echo Build failed!
pause

:end
