@echo off
setlocal

for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr ":8000"') do (
  echo Stopping PID %%P on port 8000...
  taskkill /PID %%P /F >nul 2>nul
)

echo Done.

