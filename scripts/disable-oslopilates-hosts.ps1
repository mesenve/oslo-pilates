# Yonetici olarak calistir: oslopilates.com localhost yonlendirmesini kapatir
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath

$newContent = $content | ForEach-Object {
  if ($_ -match '^127\.0\.0\.1\s+(www\.)?oslopilates\.com' -or $_ -eq '# Oslo Pilates local dev') {
    "# DISABLED: $($_.TrimStart('# '))"
  } else {
    $_
  }
}

Set-Content -Path $hostsPath -Value $newContent -Encoding ASCII
Write-Host "Hosts guncellendi: oslopilates.com yonlendirmesi kapatildi."
