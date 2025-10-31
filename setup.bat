@echo off
setlocal enabledelayedexpansion

set RUNTIME=%1
if "%RUNTIME%"=="" set RUNTIME=docker

if not "%RUNTIME%"=="docker" if not "%RUNTIME%"=="podman" (
    echo Error: Invalid runtime. Use 'docker' or 'podman'
    echo Usage: setup.bat [docker^|podman]
    pause
    exit /b 1
)

echo.
echo ====================================
echo Flopods - Setup Script
echo Runtime: %RUNTIME%
echo ====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed. Please install Node.js v20.0.0+
    pause
    exit /b 1
)

REM Check if Docker/Podman is running
%RUNTIME% ps >nul 2>&1
if errorlevel 1 (
    echo Error: %RUNTIME% is not running. Please start %RUNTIME% first.
    pause
    exit /b 1
)

echo [1/6] Installing dependencies...
call yarn install
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/6] Creating .env file...
if not exist .env (
    copy .env.example .env >nul
    echo .env file created
) else (
    echo .env file already exists
)

echo.
echo [3/6] Starting services with %RUNTIME%...
call yarn %RUNTIME%:dev
timeout /t 10 /nobreak

echo.
echo [4/6] Generating Prisma client...
call yarn db:generate
if errorlevel 1 (
    echo Warning: Failed to generate Prisma client ^(proxy issue?^)
)

echo.
echo [5/6] Running migrations...
call yarn db:migrate:deploy
if errorlevel 1 (
    echo Error: Failed to run migrations
    pause
    exit /b 1
)

echo.
echo [6/6] Seeding database ^(optional^)...
set /p SEED="Do you want to seed the pricing data? (y/n): "
if /i "%SEED%"=="y" (
    call yarn db:seed:pricing
    if errorlevel 1 (
        echo Warning: Seed timed out or failed
    )
) else (
    echo Skipping seed. You can run it later with: yarn db:seed:pricing
)

echo.
echo ====================================
echo Setup Complete!
echo ====================================
echo.
echo Starting development servers...
echo.

call yarn dev:backend

pause
