$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $root "package.json"
$gradlePath = Join-Path $root "android\app\build.gradle"
$apkPath = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
$distDir = Join-Path $root "dist"

if (-not (Test-Path $apkPath)) {
  throw "Release APK not found: $apkPath. Run npm run build:android:release first."
}

$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$gradle = Get-Content $gradlePath -Raw
$version = [string]$package.version
$versionCode = if ($gradle -match "versionCode\s+(\d+)") { $Matches[1] } else { "" }
$versionName = if ($gradle -match "versionName\s+`"([^`"]+)`"") { $Matches[1] } else { $version }

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

$apkName = "campus-os-v$version-android-arm64.apk"
$destApk = Join-Path $distDir $apkName
Copy-Item -LiteralPath $apkPath -Destination $destApk -Force

$hash = Get-FileHash -LiteralPath $destApk -Algorithm SHA256
$shaPath = "$destApk.sha256"
Set-Content -LiteralPath $shaPath -Value "$($hash.Hash)  $apkName"

$info = [ordered]@{
  app = "Campus OS"
  packageName = "com.campusos"
  version = $version
  androidVersionName = $versionName
  androidVersionCode = $versionCode
  artifact = $apkName
  artifactPath = $destApk
  sizeBytes = (Get-Item -LiteralPath $destApk).Length
  sha256 = $hash.Hash
  architectures = @("arm64-v8a")
  signing = "debug-keystore"
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
}

$infoPath = Join-Path $distDir "campus-os-v$version-build-info.json"
$info | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $infoPath

Write-Host "Packaged $apkName"
Write-Host "SHA256 $($hash.Hash)"
Write-Host "Build info $infoPath"
