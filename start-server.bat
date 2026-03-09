@echo off
setlocal

set "PHP82=C:\Users\shery\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.2_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"

if not exist "%PHP82%" (
  echo [ERROR] PHP 8.2 executable not found:
  echo %PHP82%
  echo.
  echo Install PHP 8.2+ or update this path in start-server.bat
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Starting Laravel server on http://127.0.0.1:8000
echo Using: %PHP82%
echo Press Ctrl+C to stop.
echo.
"%PHP82%" artisan serve --host=127.0.0.1 --port=8000 --no-reload

