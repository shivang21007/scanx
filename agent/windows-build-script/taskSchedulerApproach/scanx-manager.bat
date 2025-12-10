@echo off
title ScanX Manager

rem Check for administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ==========================================
    echo   Administrator Privileges Required
    echo ==========================================
    echo.
    echo This script needs to run as Administrator to modify
    echo configuration files in Program Files.
    echo.
    echo Please right-click on "ScanX Manager" and select
    echo "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo          ScanX Manager  
echo ==========================================
echo.

rem Find installation directory
set "INSTALL_DIR="
if exist "C:\Program Files\scanx\scanx.exe" (
    set "INSTALL_DIR=C:\Program Files\scanx"
) else (
    if exist "C:\Program Files (x86)\scanx\scanx.exe" (
        set "INSTALL_DIR=C:\Program Files (x86)\scanx"
    ) else (
        echo Error: ScanX installation not found!
        echo Please install ScanX first.
        pause
        exit /b 1
    )
)

echo Installation Directory: %INSTALL_DIR%
echo Running as: Administrator
echo.

:menu
echo Choose an action:
echo.
echo [1] Configure ScanX (Email and Interval)
echo [2] Start ScanX daemon now
echo [3] Stop ScanX daemon  
echo [4] Check status
echo [5] Uninstall scheduled task
echo [6] Exit
echo.

set /p "choice=Enter your choice (1-6): "

if "%choice%"=="1" goto configure
if "%choice%"=="2" goto start
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto status
if "%choice%"=="5" goto uninstall
if "%choice%"=="6" goto exit
echo Invalid choice. Please try again.
goto menu

:configure
echo.
echo ==========================================
echo   Configuration Setup
echo ==========================================
echo.
echo Configure your ScanX settings.
echo.

rem Capture installer user SID for screen lock detection
echo Capturing user information for screen lock detection...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$user = [System.Security.Principal.WindowsIdentity]::GetCurrent(); $sid = $user.User.Value; $username = $user.Name; $content = $sid + [Environment]::NewLine + $username; $filePath = '%INSTALL_DIR%\installed_user.txt'; Set-Content -Path $filePath -Value $content -Force -ErrorAction SilentlyContinue; Write-Host 'User info captured: SID=' $sid ', Username=' $username" >nul 2>&1
echo.

rem Get employee email
:get_email
set "USER_EMAIL="
set /p "USER_EMAIL=Enter your employee email (required): "

if "%USER_EMAIL%"=="" (
    echo.
    echo ERROR: Email is required!
    echo.
    goto get_email
)

rem Validate email has @ symbol
echo %USER_EMAIL% | findstr "@" >nul
if errorlevel 1 (
    echo.
    echo ERROR: Please enter a valid email address
    echo.
    goto get_email
)

echo.
echo Email: %USER_EMAIL%
echo.

rem Get collection interval
echo Data Collection Interval Examples:
echo   5m  = 5 minutes
echo   10m = 10 minutes (recommended)
echo   30m = 30 minutes
echo   1h  = 1 hour
echo   2h  = 2 hours
echo.
set "INTERVAL=10m"
set /p "INTERVAL=Enter collection interval [10m]: "

if "%INTERVAL%"=="" set "INTERVAL=10m"

echo.
echo Interval: %INTERVAL%
echo.

rem Get backend URL
echo Backend Server URL:
echo   Default: http://192.168.22.22:5173
echo   (Press Enter to use default)
echo.
set "BACKEND_URL=http://192.168.22.22:5173"
set /p "BACKEND_URL=Enter backend URL [http://192.168.22.22:5173]: "

if "%BACKEND_URL%"=="" set "BACKEND_URL=http://192.168.22.22:5173"

echo.
echo Backend URL: %BACKEND_URL%
echo.

rem Update configuration file using PowerShell
echo Updating configuration file...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$configPath = '%INSTALL_DIR%\config\agent.conf'; $userEmail = '%USER_EMAIL%'; $interval = '%INTERVAL%'; $backendUrl = '%BACKEND_URL%'; if (Test-Path $configPath) { try { $json = Get-Content $configPath | ConvertFrom-Json; $json.user_email = $userEmail; $json.interval = $interval; $json.backend_url = $backendUrl; $json | ConvertTo-Json | Set-Content $configPath -Force; Write-Host 'Configuration updated successfully!' -ForegroundColor Green; Write-Host ''; Write-Host 'Updated Configuration:' -ForegroundColor Cyan; Get-Content $configPath | ConvertFrom-Json | Format-List; exit 0; } catch { Write-Host \"ERROR: $_\" -ForegroundColor Red; exit 1; } } else { Write-Host 'ERROR: Config file not found' -ForegroundColor Red; exit 1; }"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to update configuration!
    echo Please make sure you are running as Administrator.
    echo.
    pause
    goto menu
)

echo.
echo Configuration updated successfully!
echo.
echo Current Settings:
echo   Email:        %USER_EMAIL%
echo   Interval:     %INTERVAL%
echo   Backend URL:  %BACKEND_URL%
echo.
echo Note: ScanX is configured to start automatically via Task Scheduler.
echo Use option 2 to start it now, or it will start on next system boot.
echo.
pause
goto menu

:start
echo.
echo Starting ScanX daemon...

rem Check if already running
tasklist /FI "IMAGENAME eq scanx.exe" 2>NUL | find /I "scanx.exe" >NUL
if %errorlevel% equ 0 (
    echo Info: ScanX daemon is already running
    goto start_end
)

rem Start the scheduled task
schtasks /Run /TN "ScanX Background Service" >nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: Could not trigger scheduled task
    echo The task may not be installed yet. Install the MSI first.
    goto start_end
)

echo Waiting for daemon to start...
rem Wait 3 seconds
timeout /t 3 /nobreak >nul

rem Verify the process is running
tasklist /FI "IMAGENAME eq scanx.exe" 2>NUL | find /I "scanx.exe" >NUL
if %errorlevel% equ 0 (
    echo Success: ScanX daemon started
    echo.
    echo Daemon is now collecting and sending system data.
    echo Check logs at: %INSTALL_DIR%\logs\scanx.log
) else (
    echo Error: Failed to start ScanX daemon
    echo.
    echo Possible issues:
    echo - OSQuery not installed
    echo - Configuration file missing or invalid
    echo - Permission issues
    echo - Scheduled task not created (reinstall MSI)
    echo.
    echo Check logs at: %INSTALL_DIR%\logs\scanx.log
)

:start_end
echo.
pause
goto menu

:stop
echo.
echo Stopping ScanX daemon...

taskkill /F /IM scanx.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Success: ScanX daemon stopped
    echo.
    echo Note: The daemon will restart automatically on next system boot
    echo due to the scheduled task. To prevent auto-start, use option 5.
) else (
    echo Info: ScanX daemon was not running
)

echo.
pause
goto menu

:status
echo.
echo ScanX Daemon Status
echo ===================

rem Check scheduled task
schtasks /Query /TN "ScanX Background Service" >nul 2>&1
if %errorlevel% equ 0 (
    echo Scheduled Task: Installed
    schtasks /Query /TN "ScanX Background Service" /FO LIST | findstr "Status:"
) else (
    echo Scheduled Task: Not installed
)

rem Check if running
tasklist /FI "IMAGENAME eq scanx.exe" 2>NUL | find /I "scanx.exe" >NUL
if %errorlevel% equ 0 (
    echo Daemon process: Running
) else (
    echo Daemon process: Not running
)

rem Check log file
if exist "%INSTALL_DIR%\logs\scanx.log" (
    echo Log file: Found
) else (
    echo Log file: Not found
)

rem Show current configuration
echo.
echo Current Configuration:
echo ----------------------
powershell -NoProfile -Command "if (Test-Path '%INSTALL_DIR%\config\agent.conf') { Get-Content '%INSTALL_DIR%\config\agent.conf' | ConvertFrom-Json | Format-List } else { Write-Host 'Config file not found' -ForegroundColor Red }"

echo.
pause
goto menu

:uninstall
echo.
echo Uninstalling ScanX scheduled task...

rem Stop daemon first
taskkill /F /IM scanx.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Info: Stopped running daemon
)

rem Remove scheduled task
schtasks /Delete /TN "ScanX Background Service" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo Success: Removed scheduled task
    echo.
    echo ScanX will no longer start automatically on boot.
    echo You can still start it manually using option 2.
) else (
    echo Info: Scheduled task was not found
)

echo.
pause
goto menu

:exit
echo.
echo Goodbye!
exit /b 0
