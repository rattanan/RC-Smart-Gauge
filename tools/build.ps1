param([switch]$SkipLint)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not $env:JAVA_HOME) {
    $projectJdk = Get-ChildItem -LiteralPath "$projectRoot\.tools\jdk" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($projectJdk) { $env:JAVA_HOME = $projectJdk.FullName }
}
if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath "$projectRoot\.tools\sdk")) { $env:ANDROID_HOME = "$projectRoot\.tools\sdk" }
$env:GRADLE_USER_HOME = "$projectRoot\.tools\gradle-home"
# Keep Windows Unix-domain socket paths below the OS path-length limit.
$env:JAVA_TOOL_OPTIONS = "$env:JAVA_TOOL_OPTIONS -Djdk.net.unixdomain.tmpdir=$projectRoot\.tools"
$tasks = @(':app:assembleDebug', ':app:testDebugUnitTest')
if (-not $SkipLint) { $tasks += ':app:lintDebug' }
& "$projectRoot\gradlew.bat" --no-daemon @tasks
exit $LASTEXITCODE
