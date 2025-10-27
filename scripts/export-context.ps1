Write-Host "Exporting Flopods Codebase (Source Only)..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Configuration
$outputDir = "docs\context"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "$outputDir\flopods_$timestamp.md"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Root-level config files
$rootFiles = @(
    "package.json",
    "turbo.json",
    "tsconfig.json",
    ".prettierrc",
    ".prettierignore",
    ".editorconfig",
    ".gitignore",
    ".env.example",
    "README.md"
)

# Backend config files
$backendFiles = @(
    "apps\backend\package.json",
    "apps\backend\tsconfig.json",
    "apps\backend\tsconfig.build.json",
    "apps\backend\nest-cli.json"
)

# Frontend config files
$frontendFiles = @(
    "apps\frontend\package.json",
    "apps\frontend\tsconfig.json",
    "apps\frontend\tsconfig.app.json",
    "apps\frontend\tsconfig.node.json",
    "apps\frontend\vite.config.ts",
    "apps\frontend\tailwind.config.ts",
    "apps\frontend\index.html",
    "apps\frontend\components.json"
)

# Docker files
$dockerFiles = @(
    "docker\db-docker-compose.yaml"
)

# Language mapping
function Get-SyntaxLanguage {
    param([string]$Extension)
    switch ($Extension) {
        { $_ -in @('ts', 'tsx') } { 'typescript' }
        { $_ -in @('js', 'jsx') } { 'javascript' }
        'json' { 'json' }
        { $_ -in @('yaml', 'yml') } { 'yaml' }
        { $_ -in @('css', 'scss') } { 'css' }
        'html' { 'html' }
        'md' { 'markdown' }
        'prisma' { 'prisma' }
        'sql' { 'sql' }
        'ps1' { 'powershell' }
        default { 'text' }
    }
}

# Initialize file
@"
# Flopods: AI Workflow Canvas - Complete Codebase

**Project:** AI Workflow Canvas - Multi-LLM Node-Based Platform
**Author:** Zahid Khan
**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') IST
**Version:** 0.0.1

---

"@ | Out-File -FilePath $outputFile -Encoding UTF8

# Helper function to add files
function Add-FilesToContext {
    param(
        [string]$SectionTitle,
        [array]$Files
    )

    if ($Files.Count -eq 0) { return }

    Write-Host "`n$SectionTitle" -ForegroundColor Yellow
    "## $SectionTitle" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    foreach ($file in ($Files | Sort-Object FullName)) {
        $relativePath = $file.FullName.Replace((Get-Location).Path + '\', '')
        $ext = $file.Extension.TrimStart('.')
        $lang = Get-SyntaxLanguage -Extension $ext

        "### ``$relativePath``" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        "" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        "``````$lang" | Out-File -FilePath $outputFile -Append -Encoding UTF8

        try {
            if ($file.Length -gt 500KB) {
                "// Large file - showing first 200 lines" | Out-File -FilePath $outputFile -Append -Encoding UTF8
                Get-Content $file.FullName -First 200 | Out-File -FilePath $outputFile -Append -Encoding UTF8
                "// ..." | Out-File -FilePath $outputFile -Append -Encoding UTF8
            } else {
                Get-Content $file.FullName -Raw | Out-File -FilePath $outputFile -Append -Encoding UTF8
            }
        } catch {
            "// Error reading file" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        }

        "``````" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

        Write-Host "  + $relativePath" -ForegroundColor DarkGray
    }

    "---" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    Write-Host "  Exported $($Files.Count) files" -ForegroundColor Green
}

$totalFiles = 0

# 1. Backend Source
if (Test-Path "apps\backend\src") {
    Write-Host "`nScanning Backend..." -ForegroundColor Cyan
    $backendFiles = Get-ChildItem -Path "apps\backend\src" -Include *.ts,*.js -Recurse -File
    Add-FilesToContext -SectionTitle "Backend Source Code (NestJS)" -Files $backendFiles
    $totalFiles += $backendFiles.Count
}

# 2. Frontend Source
if (Test-Path "apps\frontend\src") {
    Write-Host "`nScanning Frontend..." -ForegroundColor Cyan
    $frontendCodeFiles = Get-ChildItem -Path "apps\frontend\src" -Include *.ts,*.tsx,*.jsx,*.js -Recurse -File
    $frontendStyleFiles = Get-ChildItem -Path "apps\frontend\src" -Include *.css,*.scss -Recurse -File
    Add-FilesToContext -SectionTitle "Frontend Source Code (React/Vite)" -Files $frontendCodeFiles
    Add-FilesToContext -SectionTitle "Frontend Styles" -Files $frontendStyleFiles
    $totalFiles += ($frontendCodeFiles.Count + $frontendStyleFiles.Count)
}

# 3. Packages - Schema (ONLY prisma files and configs, NO generated client)
if (Test-Path "packages\schema\prisma") {
    Write-Host "`nScanning Schema Package..." -ForegroundColor Cyan
    # Get only .prisma files and migrations
    $schemaFiles = Get-ChildItem -Path "packages\schema\prisma" -Include *.prisma,*.sql -Recurse -File

    # Add package-level files (package.json, prisma.config.ts, index files)
    if (Test-Path "packages\schema\package.json") {
        $schemaFiles += Get-Item "packages\schema\package.json"
    }
    if (Test-Path "packages\schema\prisma.config.ts") {
        $schemaFiles += Get-Item "packages\schema\prisma.config.ts"
    }
    if (Test-Path "packages\schema\index.ts") {
        $schemaFiles += Get-Item "packages\schema\index.ts"
    }

    Add-FilesToContext -SectionTitle "Packages - Prisma Schema" -Files $schemaFiles
    $totalFiles += $schemaFiles.Count
}

# 4. Packages - ESLint Config
if (Test-Path "packages\eslint-config") {
    Write-Host "`nScanning ESLint Config..." -ForegroundColor Cyan
    $eslintFiles = Get-ChildItem -Path "packages\eslint-config" -Include *.js,*.json,*.ts -Recurse -File
    Add-FilesToContext -SectionTitle "Packages - ESLint Config" -Files $eslintFiles
    $totalFiles += $eslintFiles.Count
}

# 5. Packages - TSConfig
if (Test-Path "packages\tsconfig") {
    Write-Host "`nScanning TSConfig..." -ForegroundColor Cyan
    $tsconfigFiles = Get-ChildItem -Path "packages\tsconfig" -Include *.json -Recurse -File
    Add-FilesToContext -SectionTitle "Packages - TypeScript Config" -Files $tsconfigFiles
    $totalFiles += $tsconfigFiles.Count
}

# 6. Root Config Files
Write-Host "`nAdding Root Config Files..." -ForegroundColor Cyan
$rootConfigFiles = @()
foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        $rootConfigFiles += Get-Item $file
    }
}
Add-FilesToContext -SectionTitle "Root Configuration" -Files $rootConfigFiles
$totalFiles += $rootConfigFiles.Count

# 7. Backend Config Files
Write-Host "`nAdding Backend Config Files..." -ForegroundColor Cyan
$backendConfigFiles = @()
foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        $backendConfigFiles += Get-Item $file
    }
}
Add-FilesToContext -SectionTitle "Backend Configuration" -Files $backendConfigFiles
$totalFiles += $backendConfigFiles.Count

# 8. Frontend Config Files
Write-Host "`nAdding Frontend Config Files..." -ForegroundColor Cyan
$frontendConfigFiles = @()
foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $frontendConfigFiles += Get-Item $file
    }
}
Add-FilesToContext -SectionTitle "Frontend Configuration" -Files $frontendConfigFiles
$totalFiles += $frontendConfigFiles.Count

# 9. Docker Files
Write-Host "`nAdding Docker Files..." -ForegroundColor Cyan
$dockerConfigFiles = @()
foreach ($file in $dockerFiles) {
    if (Test-Path $file) {
        $dockerConfigFiles += Get-Item $file
    }
}
Add-FilesToContext -SectionTitle "Docker Configuration" -Files $dockerConfigFiles
$totalFiles += $dockerConfigFiles.Count

# 10. Scripts (optional - if you want to include your export script)
if (Test-Path "scripts") {
    Write-Host "`nAdding Scripts..." -ForegroundColor Cyan
    $scriptFiles = Get-ChildItem -Path "scripts" -Include *.ps1,*.sh -File
    if ($scriptFiles.Count -gt 0) {
        Add-FilesToContext -SectionTitle "Build Scripts" -Files $scriptFiles
        $totalFiles += $scriptFiles.Count
    }
}

# Summary
$fileSize = (Get-Item $outputFile).Length

"## Export Summary" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"| Metric | Value |" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"|--------|-------|" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"| Files Exported | $totalFiles |" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"| File Size | $([math]::Round($fileSize / 1MB, 2)) MB |" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"| Generated | $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') IST |" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8

"### What's Included" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Backend NestJS source code (apps/backend/src)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Frontend React/Vite source code (apps/frontend/src)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Prisma schema files and migrations (packages/schema/prisma)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Shared ESLint and TSConfig packages" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- All configuration files" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Docker compose files" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Build scripts" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8

"### Excluded" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- node_modules (dependency code)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Generated Prisma client (packages/schema/client)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"- Build artifacts (dist, .turbo, .yarn)" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "EXPORT COMPLETE!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "Output: $outputFile" -ForegroundColor Cyan
Write-Host "Files: $totalFiles" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round($fileSize / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Green
