@echo off
setlocal

cd /d "%~dp0"

if not exist "serve-local.ps1" (
  echo [ERROR] serve-local.ps1 not found in:
  echo %cd%
  pause
  exit /b 1
)

echo Starting Laravel server on http://127.0.0.1:8000
echo Using serve-local.ps1 (loads required PHP extensions)
echo Press Ctrl+C to stop.
echo.
powershell -ExecutionPolicy Bypass -File ".\serve-local.ps1"
