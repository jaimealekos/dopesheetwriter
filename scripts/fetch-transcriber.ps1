# Llena vendor\transcriber con las herramientas de transcripcion de Hispatrans
# (ffmpeg, whisper.cpp y los modelos). Salta lo que ya existe con el mismo tamano.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\fetch-transcriber.ps1 [-Origen F:\code\github\hispatrans]

[CmdletBinding()]
param(
    [string]$Origen = 'F:\code\github\hispatrans'
)

$ErrorActionPreference = 'Stop'

# Raiz del repositorio (la carpeta padre de scripts\) y carpeta de destino.
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'vendor\transcriber'

$whisperOrigen = Join-Path $Origen 'tools\whisper-cpp'
$ffmpegOrigen = Join-Path $Origen 'tools\ffmpeg'
$modelosOrigen = Join-Path $Origen 'models'

# Pares origen -> destino relativo a vendor\transcriber.
$pares = @(
    @{ De = Join-Path $ffmpegOrigen 'ffmpeg.exe'; A = 'ffmpeg.exe' },
    @{ De = Join-Path $ffmpegOrigen 'LICENSE.txt'; A = 'licenses\ffmpeg-LICENSE.txt' },
    @{ De = Join-Path $modelosOrigen 'ggml-large-v3-q8_0.bin'; A = 'models\ggml-large-v3-q8_0.bin' },
    @{ De = Join-Path $modelosOrigen 'ggml-silero-v6.2.0.bin'; A = 'models\ggml-silero-v6.2.0.bin' }
)
foreach ($nombre in @('whisper-cli.exe', 'whisper.dll', 'ggml.dll', 'ggml-base.dll')) {
    $pares += @{ De = Join-Path $whisperOrigen $nombre; A = "whisper\$nombre" }
}
if (Test-Path -LiteralPath $whisperOrigen) {
    foreach ($dll in Get-ChildItem -LiteralPath $whisperOrigen -Filter 'ggml-cpu-*.dll') {
        $pares += @{ De = $dll.FullName; A = "whisper\$($dll.Name)" }
    }
}

# Todos los origenes deben existir antes de copiar nada.
foreach ($par in $pares) {
    if (-not (Test-Path -LiteralPath $par.De)) {
        throw "Falta el origen: $($par.De). Ejecuta build/fetch-deps.ps1 en hispatrans."
    }
}

$copiados = @()
foreach ($par in $pares) {
    $destinoFichero = Join-Path $destino $par.A
    $existente = Get-Item -LiteralPath $destinoFichero -ErrorAction SilentlyContinue
    if ($existente -and $existente.Length -eq (Get-Item -LiteralPath $par.De).Length) {
        continue
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinoFichero) | Out-Null
    Copy-Item -LiteralPath $par.De -Destination $destinoFichero -Force
    $copiados += $par.A
}

if ($copiados.Count -eq 0) {
    Write-Host 'Nada que copiar: vendor\transcriber ya esta al dia.'
} else {
    Write-Host "Copiado a ${destino}:"
    $copiados | ForEach-Object { Write-Host "  $_" }
}
