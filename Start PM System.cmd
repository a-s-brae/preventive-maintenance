@echo off
REM Double-click to start the PM System. Keep this window open while you use it.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and then run this again.
  pause
  exit /b 1
)
call npm run local
pause
