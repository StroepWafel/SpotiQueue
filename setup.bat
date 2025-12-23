@echo off
echo 🎵 Spotify Queue App Setup
echo ==========================
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from env.example...
    copy env.example .env
    echo Created .env file
    echo Please edit .env and add your Spotify credentials!
) else (
    echo .env file already exists
)

REM Create data directory
if not exist data (
    echo Creating data directory...
    mkdir data
    echo Created data directory
) else (
    echo Data directory already exists
)

REM Install root dependencies
echo.
echo Installing root dependencies...
call npm install

REM Install client dependencies
echo.
echo Installing client dependencies...
cd client
call npm install
cd ..

REM Install admin dependencies
echo.
echo Installing admin dependencies...
cd admin
call npm install
cd ..

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Edit .env and add your Spotify credentials
echo 2. Run 'npm run dev' for development
echo 3. Or run 'docker-compose up' for production
echo.

pause

