param(
    [Parameter(Mandatory=$true)][string]$Url,
    [string]$OutputPath = '.tools\certs\telemetry-root-ca.pem'
)
$ErrorActionPreference = 'Stop'
$destination = [Uri]$Url
if ($destination.Scheme -ne 'https') { throw 'Use an HTTPS URL.' }
Add-Type -AssemblyName System.Security
$connection = New-Object System.Net.Sockets.TcpClient
$secureStream = $null
$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
try {
    $connection.Connect($destination.DnsSafeHost, $destination.Port)
    $secureStream = New-Object System.Net.Security.SslStream($connection.GetStream(), $false)
    # Default platform validation remains enabled, including the DNS hostname.
    $secureStream.AuthenticateAsClient($destination.DnsSafeHost)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($secureStream.RemoteCertificate)
    if (-not $chain.Build($certificate)) { throw 'The certificate chain is not trusted. No CA was exported.' }
    $rootCertificate = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
    if ($rootCertificate.Subject -ne $rootCertificate.Issuer) { throw 'A trusted root certificate was not found.' }
    $pemBase64 = [Convert]::ToBase64String($rootCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), [Base64FormattingOptions]::InsertLineBreaks)
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
    [System.IO.File]::WriteAllText($resolvedOutput, "-----BEGIN CERTIFICATE-----`n$pemBase64`n-----END CERTIFICATE-----`n", [System.Text.Encoding]::ASCII)
    Write-Output "Exported verified public root CA to $resolvedOutput"
    Write-Output "Root: $($rootCertificate.Subject)"
} finally {
    $chain.Dispose()
    if ($secureStream) { $secureStream.Dispose() }
    $connection.Dispose()
}
