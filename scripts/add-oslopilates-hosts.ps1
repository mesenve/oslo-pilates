# Yonetici olarak calistir: oslopilates.com -> localhost
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker = "# Oslo Pilates local dev"
$content = Get-Content $hostsPath -Raw

if ($content -match "oslopilates\.com") {
  Write-Host "oslopilates.com zaten hosts dosyasinda."
  exit 0
}

Add-Content -Path $hostsPath -Value @(
  ""
  $marker
  "127.0.0.1 oslopilates.com"
  "127.0.0.1 www.oslopilates.com"
) -Encoding ASCII

Write-Host "Hosts guncellendi: oslopilates.com -> 127.0.0.1"
