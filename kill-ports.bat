@echo off
echo Killing processes on ports 3000, 3001, and 3002...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Killing process %%a on port 3000...
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Killing process %%a on port 3001...
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
    echo Killing process %%a on port 3002...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Done! Ports should now be free.
pause

