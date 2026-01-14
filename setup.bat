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

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

REM Check Runtime Status
echo [1/6] Checking %RUNTIME% status...
%RUNTIME% info >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] %RUNTIME% is not running!
    echo Please start the %RUNTIME% desktop app first.
    pause
    exit /b 1
)

echo [2/6] Installing dependencies...
call yarn install
if errorlevel 1 (
    echo [ERROR] Dependency install failed.
    pause
    exit /b 1
)

echo.
echo [3/6] Setting up environment...
if not exist .env (
    copy .env.example .env >nul
    echo Created .env file
) else (
    echo .env file exists
)

echo.
echo [4/6] Starting database services...
call yarn %RUNTIME%:db:up
call yarn %RUNTIME%:redis:up
call yarn %RUNTIME%:localstack:up

echo Waiting for DB to be ready...
REM Universal 15-second delay (works in Git Bash and CMD)
ping 127.0.0.1 -n 16 > nul

echo.
echo [5/6] Generating Prisma Client...
REM Force load env vars specifically for this command
set "DOTENV_CONFIG_PATH=../../.env"
call yarn db:generate
if errorlevel 1 (
    echo.
    echo [ERROR] Prisma generation failed.
    pause
    exit /b 1
)

echo.
echo [6/6] Running Migrations...
call yarn db:migrate:deploy
if errorlevel 1 (
    echo [ERROR] Migrations failed.
    pause
    exit /b 1
)

echo.
echo [OPTIONAL] Seeding database...
set /p SEED="Seed pricing data? (y/n): "
if /i "%SEED%"=="y" (
    call yarn db:seed:pricing
)

echo.
echo ====================================
echo Setup Complete! Starting Backend...
echo ====================================
echo.

@REM call yarn dev:backend
