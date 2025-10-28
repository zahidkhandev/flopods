param(
    [string]$SpecificPath = "apps/backend"
)

# RootPath is always where the script is run from
$RootPath = (Get-Location).Path
# Resolve the root path to an absolute, clean path
$RootPath = (Resolve-Path $RootPath).Path
if ($RootPath.EndsWith('\') -or $RootPath.EndsWith('/')) {
    $RootPath = $RootPath.Substring(0, $RootPath.Length - 1)
}

Write-Host "Exporting Flopods Codebase (Source Only)..." -ForegroundColor Cyan
Write-Host "Script Root (Base Path): $RootPath" -ForegroundColor Cyan
if (-not [string]::IsNullOrEmpty($SpecificPath)) {
    Write-Host "Target Path: $SpecificPath" -ForegroundColor Cyan
}
Write-Host "================================================" -ForegroundColor Cyan

# Configuration
$outputDir = Join-Path $RootPath "docs\context"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "$outputDir\flopods_$timestamp.md"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Root-level config files (relative to RootPath)
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

# Backend config files (relative to RootPath)
$backendFiles = @(
    "apps\backend\package.json",
    "apps\backend\tsconfig.json",
    "apps\backend\tsconfig.build.json",
    "apps\backend\nest-cli.json"
)

# Frontend config files (relative to RootPath)
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

# Docker files (relative to RootPath)
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
# Flopods: AI Workflow Canvas - Codebase Export

**Project:** AI Workflow Canvas - Multi-LLM Node-Based Platform
**Author:** Zahid Khan
**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') IST
**Version:** 0.0.1
**Source Root (Base Path):** $RootPath
---

"@ | Out-File -FilePath $outputFile -Encoding UTF8

# Helper function to add files
function Add-FilesToContext {
    param(
        [string]$SectionTitle,
        [array]$Files,
        [string]$BaseRootPath
    )

    if ($Files.Count -eq 0) { return }

    Write-Host "`n$SectionTitle" -ForegroundColor Yellow
    "## $SectionTitle" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    foreach ($file in ($Files | Sort-Object FullName)) {
        # Calculate relative path from the provided BaseRootPath
        $relativePath = $file.FullName
        if ($relativePath.StartsWith($BaseRootPath)) {
            $relativePath = $relativePath.Substring($BaseRootPath.Length + 1) # +1 for the '\'
        }

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

        Write-Host "   + $relativePath" -ForegroundColor DarkGray
    }

    "---" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    Write-Host "   Exported $($Files.Count) files" -ForegroundColor Green
}

$totalFiles = 0
$includedSummary = ""

# Check if we are doing a full export or a specific path export
if ([string]::IsNullOrEmpty($SpecificPath)) {
    # --- FULL PROJECT EXPORT LOGIC ---
    Write-Host "Performing FULL project scan..." -ForegroundColor Green

    # 1. Backend Source
    $backendSrcPath = Join-Path $RootPath "apps\backend\src"
    if (Test-Path $backendSrcPath) {
        Write-Host "`nScanning Backend..." -ForegroundColor Cyan
        $backendSourceFiles = Get-ChildItem -Path $backendSrcPath -Include *.ts,*.js -Recurse -File
        Add-FilesToContext -SectionTitle "Backend Source Code (NestJS)" -Files $backendSourceFiles -BaseRootPath $RootPath
        $totalFiles += $backendSourceFiles.Count
    }

    # 2. Frontend Source
    $frontendSrcPath = Join-Path $RootPath "apps\frontend\src"
    if (Test-Path $frontendSrcPath) {
        Write-Host "`nScanning Frontend..." -ForegroundColor Cyan
        $frontendCodeFiles = Get-ChildItem -Path $frontendSrcPath -Include *.ts,*.tsx,*.jsx,*.js -Recurse -File
        $frontendStyleFiles = Get-ChildItem -Path $frontendSrcPath -Include *.css,*.scss -Recurse -File
        Add-FilesToContext -SectionTitle "Frontend Source Code (React/Vite)" -Files $frontendCodeFiles -BaseRootPath $RootPath
        Add-FilesToContext -SectionTitle "Frontend Styles" -Files $frontendStyleFiles -BaseRootPath $RootPath
        $totalFiles += ($frontendCodeFiles.Count + $frontendStyleFiles.Count)
    }

    # 3. Packages - Schema (ONLY prisma files and configs, NO generated client)
    $schemaPkgPath = Join-Path $RootPath "packages\schema"
    if (Test-Path $schemaPkgPath) {
        Write-Host "`nScanning Schema Package..." -ForegroundColor Cyan
        $schemaFiles = @()

        # Get only .prisma files and migrations
        $prismaSchemaPath = Join-Path $schemaPkgPath "prisma"
        if (Test-Path $prismaSchemaPath) {
            $schemaFiles += Get-ChildItem -Path $prismaSchemaPath -Include *.prisma,*.sql -Recurse -File
        }

        # Add package-level files (package.json, prisma.config.ts, index files)
        if (Test-Path (Join-Path $schemaPkgPath "package.json")) {
            $schemaFiles += Get-Item (Join-Path $schemaPkgPath "package.json")
        }
        if (Test-Path (Join-Path $schemaPkgPath "prisma.config.ts")) {
            $schemaFiles += Get-Item (Join-Path $schemaPkgPath "prisma.config.ts")
        }
        if (Test-Path (Join-Path $schemaPkgPath "index.ts")) {
            $schemaFiles += Get-Item (Join-Path $schemaPkgPath "index.ts")
        }

        Add-FilesToContext -SectionTitle "Packages - Prisma Schema" -Files $schemaFiles -BaseRootPath $RootPath
        $totalFiles += $schemaFiles.Count
    }

    # 4. Packages - ESLint Config
    $eslintPkgPath = Join-Path $RootPath "packages\eslint-config"
    if (Test-Path $eslintPkgPath) {
        Write-Host "`nScanning ESLint Config..." -ForegroundColor Cyan
        $eslintFiles = Get-ChildItem -Path $eslintPkgPath -Include *.js,*.json,*.ts -Recurse -File
        Add-FilesToContext -SectionTitle "Packages - ESLint Config" -Files $eslintFiles -BaseRootPath $RootPath
        $totalFiles += $eslintFiles.Count
    }

    # 5. Packages - TSConfig
    $tsconfigPkgPath = Join-Path $RootPath "packages\tsconfig"
    if (Test-Path $tsconfigPkgPath) {
        Write-Host "`nScanning TSConfig..." -ForegroundColor Cyan
        $tsconfigFiles = Get-ChildItem -Path $tsconfigPkgPath -Include *.json -Recurse -File
        Add-FilesToContext -SectionTitle "Packages - TypeScript Config" -Files $tsconfigFiles -BaseRootPath $RootPath
        $totalFiles += $tsconfigFiles.Count
    }

    # 6. Root Config Files
    Write-Host "`nAdding Root Config Files..." -ForegroundColor Cyan
    $rootConfigFiles = @()
    foreach ($file in $rootFiles) {
        $fullFilePath = Join-Path $RootPath $file
        if (Test-Path $fullFilePath) {
            $rootConfigFiles += Get-Item $fullFilePath
        }
    }
    Add-FilesToContext -SectionTitle "Root Configuration" -Files $rootConfigFiles -BaseRootPath $RootPath
    $totalFiles += $rootConfigFiles.Count

    # 7. Backend Config Files
    Write-Host "`nAdding Backend Config Files..." -ForegroundColor Cyan
    $backendConfigFiles = @()
    foreach ($file in $backendFiles) {
        $fullFilePath = Join-Path $RootPath $file
        if (Test-Path $fullFilePath) {
            $backendConfigFiles += Get-Item $fullFilePath
        }
    }
    Add-FilesToContext -SectionTitle "Backend Configuration" -Files $backendConfigFiles -BaseRootPath $RootPath
    $totalFiles += $backendConfigFiles.Count

    # 8. Frontend Config Files
    Write-Host "`nAdding Frontend Config Files..." -ForegroundColor Cyan
    $frontendConfigFiles = @()
    foreach ($file in $frontendFiles) {
        $fullFilePath = Join-Path $RootPath $file
        if (Test-Path $fullFilePath) {
            $frontendConfigFiles += Get-Item $fullFilePath
        }
    }
    Add-FilesToContext -SectionTitle "Frontend Configuration" -Files $frontendConfigFiles -BaseRootPath $RootPath
    $totalFiles += $frontendConfigFiles.Count

    # 9. Docker Files
    Write-Host "`nAdding Docker Files..." -ForegroundColor Cyan
    $dockerConfigFiles = @()
    foreach ($file in $dockerFiles) {
        $fullFilePath = Join-Path $RootPath $file
        if (Test-Path $fullFilePath) {
            $dockerConfigFiles += Get-Item $fullFilePath
        }
    }
    Add-FilesToContext -SectionTitle "Docker Configuration" -Files $dockerConfigFiles -BaseRootPath $RootPath
    $totalFiles += $dockerConfigFiles.Count

    # 10. Scripts (optional - if you want to include your export script)
    $scriptsPath = Join-Path $RootPath "scripts"
    if (Test-Path $scriptsPath) {
        Write-Host "`nAdding Scripts..." -ForegroundColor Cyan
        $scriptFiles = Get-ChildItem -Path $scriptsPath -Include *.ps1,*.sh -File
        if ($scriptFiles.Count -gt 0) {
            Add-FilesToContext -SectionTitle "Build Scripts" -Files $scriptFiles -BaseRootPath $RootPath
            $totalFiles += $scriptFiles.Count
        }
    }

    $includedSummary = @"
- Backend NestJS source code (apps/backend/src)
- Frontend React/Vite source code (apps/frontend/src)
- Prisma schema files and migrations (packages/schema/prisma)
- Shared ESLint and TSConfig packages
- All configuration files
- Docker compose files
- Build scripts
"@
}
else {
    # --- SPECIFIC PATH EXPORT LOGIC ---
    $resolvedSpecificPath = $SpecificPath
    if (-not (Test-Path $resolvedSpecificPath)) {
        # Try resolving relative to root path
        $resolvedSpecificPath = Join-Path $RootPath $SpecificPath
    }

    if (Test-Path $resolvedSpecificPath) {
        $resolvedSpecificPath = (Resolve-Path $resolvedSpecificPath).Path
        Write-Host "`nScanning Specific Path: $resolvedSpecificPath" -ForegroundColor Cyan

        $specificFiles = @()
        if ((Get-Item $resolvedSpecificPath) -is [System.IO.DirectoryInfo]) {
            # It's a directory, get files recursively
            $specificFiles = Get-ChildItem -Path $resolvedSpecificPath -Recurse -File
        } else {
            # It's a single file
            $specificFiles = @(Get-Item $resolvedSpecificPath)
        }

        # Calculate a clean relative path for the section title
        $relativeSpecificPath = $resolvedSpecificPath
        if ($relativeSpecificPath.StartsWith($RootPath)) {
            $relativeSpecificPath = $relativeSpecificPath.Substring($RootPath.Length + 1)
        }

        Add-FilesToContext -SectionTitle "Specific Export: $relativeSpecificPath" -Files $specificFiles -BaseRootPath $RootPath
        $totalFiles += $specificFiles.Count

        $includedSummary = "- All files from '$relativeSpecificPath'"
    } else {
        Write-Host "Error: Specific path not found: $SpecificPath" -ForegroundColor Red
        $includedSummary = "- No files exported. Path not found: $SpecificPath"
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
$includedSummary | Out-File -FilePath $outputFile -Append -Encoding UTF8
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
