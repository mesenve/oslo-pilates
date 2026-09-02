@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$hostsPath = '%SystemRoot%\System32\drivers\etc\hosts'; $c = Get-Content $hostsPath; $new = $c | ForEach-Object { if ($_ -match '^127\.0\.0\.1\s+(www\.)?oslopilates\.com' -or $_ -eq '# Oslo Pilates local dev') { '# DISABLED: ' + $_.TrimStart('# ') } else { $_ } }; Set-Content -Path $hostsPath -Value $new -Encoding ASCII"
ipconfig /flushdns >nul
echo Hosts guncellendi.
