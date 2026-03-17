$ErrorActionPreference = 'Stop'

# Runs Laravel locally without editing global php.ini by loading mbstring for this process.
# Usage: powershell -ExecutionPolicy Bypass -File .\serve-local.ps1

$preferredPhp = 'C:\php82\php.exe'
$cmd = Get-Command php -ErrorAction SilentlyContinue
$php = if (Test-Path $preferredPhp) { $preferredPhp } elseif ($cmd) { $cmd.Source } else { $preferredPhp }

if (-not (Test-Path $php)) {
  throw "PHP executable not found at: $php"
}

$extDir = Split-Path $php -Parent
$extDir = Join-Path $extDir 'ext'
$mb = Join-Path $extDir 'php_mbstring.dll'
$openssl = Join-Path $extDir 'php_openssl.dll'
$pdoMysql = Join-Path $extDir 'php_pdo_mysql.dll'
$fileinfo = Join-Path $extDir 'php_fileinfo.dll'
$intl = Join-Path $extDir 'php_intl.dll'

if (-not (Test-Path $mb)) {
  throw "mbstring DLL not found at: $mb"
}
if (-not (Test-Path $openssl)) {
  throw "openssl DLL not found at: $openssl"
}
if (-not (Test-Path $pdoMysql)) {
  throw "pdo_mysql DLL not found at: $pdoMysql"
}
if (-not (Test-Path $fileinfo)) {
  throw "fileinfo DLL not found at: $fileinfo"
}
if (-not (Test-Path $intl)) {
  throw "intl DLL not found at: $intl"
}

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

$hostIp = '127.0.0.1'
$port = 8000
$publicDir = Join-Path $root 'public'
$frontController = Join-Path $root 'server.php'

if (-not (Test-Path $publicDir)) {
  throw "public/ directory not found at: $publicDir"
}
if (-not (Test-Path $frontController)) {
  throw "server.php not found at: $frontController"
}

Write-Host "Starting PHP dev server on http://$hostIp`:$port (mbstring loaded)..." -ForegroundColor Cyan
& $php `
  -d "opcache.enable=0" `
  -d "opcache.enable_cli=0" `
  -d "opcache.validate_timestamps=1" `
  -d "opcache.revalidate_freq=0" `
  -d "extension_dir=$extDir" `
  -d "extension=php_mbstring.dll" `
  -d "extension=php_openssl.dll" `
  -d "extension=php_pdo_mysql.dll" `
  -d "extension=php_fileinfo.dll" `
  -d "extension=php_intl.dll" `
  -S "$hostIp`:$port" `
  -t "$publicDir" `
  "$frontController"
