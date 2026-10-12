@echo off
echo Setting up Code Explorer...
echo.

REM Install backend dependencies
echo Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
  echo Backend installation failed
  exit /b %errorlevel%
)

REM Build backend
echo Building backend...
call npm run build
if %errorlevel% neq 0 (
  echo Backend build failed
  exit /b %errorlevel%
)

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
  echo Frontend installation failed
  exit /b %errorlevel%
)

REM Build frontend
echo Building frontend...
call npm run build
if %errorlevel% neq 0 (
  echo Frontend build failed
  exit /b %errorlevel%
)

cd ..

echo.
echo Setup complete!
echo.
echo Quick start:
echo   1. Create a config file: code-explorer.config.json
echo   2. Run: npm run dev analyze
echo   3. Run: npm run dev serve
echo.
echo Or use the convenience command:
echo   npm run dev open
echo.
