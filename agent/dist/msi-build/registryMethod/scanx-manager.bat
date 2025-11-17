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
echo [1] Configure and install as Windows startup application
echo [2] Start ScanX daemon now
echo [3] Stop ScanX daemon  
echo [4] Check status
echo [5] Uninstall from startup
echo [6] Exit
echo.

set /p "choice=Enter your choice (1-6): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto start
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto status
if "%choice%"=="5" goto uninstall
if "%choice%"=="6" goto exit
echo Invalid choice. Please try again.
goto menu

:install
echo.
echo ==========================================
echo   Configuration Setup
echo ==========================================
echo.
echo Before installing as startup, we need to configure your settings.
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

rem Update configuration file using PowerShell
echo Updating configuration file...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$configPath = '%INSTALL_DIR%\config\agent.conf'; $userEmail = '%USER_EMAIL%'; $interval = '%INTERVAL%'; if (Test-Path $configPath) { try { $json = Get-Content $configPath | ConvertFrom-Json; $json.user_email = $userEmail; $json.interval = $interval; $json | ConvertTo-Json | Set-Content $configPath -Force; Write-Host 'Configuration updated successfully!' -ForegroundColor Green; Write-Host ''; Write-Host 'Updated Configuration:' -ForegroundColor Cyan; Get-Content $configPath | ConvertFrom-Json | Format-List; exit 0; } catch { Write-Host \"ERROR: $_\" -ForegroundColor Red; exit 1; } } else { Write-Host 'ERROR: Config file not found' -ForegroundColor Red; exit 1; }"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to update configuration!
    echo Please make sure you are running as Administrator.
    echo.
    pause
    goto menu
)

echo.
echo Installing ScanX as Windows startup application...

rem Add to registry startup with absolute paths
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ScanX" /t REG_SZ /d "\"%INSTALL_DIR%\scanx.exe\" -daemon -config \"%INSTALL_DIR%\config\"" /f >nul

if %errorlevel% equ 0 (
    echo Success: Added to Windows startup registry  
    echo.
    echo ScanX will now start automatically when Windows boots.
    echo Configuration: Email=%USER_EMAIL%, Interval=%INTERVAL%
    echo.
    set /p "startnow=Would you like to start it now? (Y/N): "
    if /i "%startnow%"=="Y" goto start
) else (
    echo Error: Failed to add to startup registry
)

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

rem Clean up any old VBS file first
del "%TEMP%\scanx-start.vbs" 2>nul

rem Create a VBS script to start the process invisibly
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\scanx-start.vbs"
echo WshShell.CurrentDirectory = "%INSTALL_DIR%" >> "%TEMP%\scanx-start.vbs"
echo cmdLine = Chr(34) ^& "%INSTALL_DIR%\scanx.exe" ^& Chr(34) ^& " -daemon -config " ^& Chr(34) ^& "%INSTALL_DIR%\config" ^& Chr(34) >> "%TEMP%\scanx-start.vbs"
echo WshShell.Run cmdLine, 0, False >> "%TEMP%\scanx-start.vbs"

rem Execute the VBS script
cscript //nologo "%TEMP%\scanx-start.vbs"
del "%TEMP%\scanx-start.vbs" 2>nul

rem Wait and check
timeout /t 3 /nobreak >nul
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
    echo - Configuration file missing
    echo - Permission issues
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

rem Check startup registry
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ScanX" >nul 2>&1
if %errorlevel% equ 0 (
    echo Windows startup: Enabled
) else (
    echo Windows startup: Not configured
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
echo Uninstalling ScanX from Windows startup...

rem Remove from registry
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ScanX" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo Success: Removed from Windows startup registry
) else (
    echo Info: Was not in startup registry
)

rem Stop daemon
taskkill /F /IM scanx.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Success: Stopped running daemon
) else (
    echo Info: Daemon was not running
)

echo.
echo ScanX has been removed from Windows startup.
echo.
pause
goto menu

:exit
echo.
echo Goodbye!
exit /b 0
