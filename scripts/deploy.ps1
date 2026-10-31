# Despliegue de Dopesheet Writer: pruebas, empaquetado para Windows y copia
# espejo de la carpeta empaquetada al destino. Cierra antes la app si corre.
# El empaquetado se hace en una copia local (-Compilacion) porque Windows no carga
# los binarios nativos de las herramientas desde la unidad de red F:.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 [-Destino <ruta>] [-Compilacion <ruta>]

[CmdletBinding()]
param(
    [string]$Destino = 'C:\jaime\apps\dopesheetwriter',
    [string]$Compilacion = 'C:\temp\dsw-build'
)

$ErrorActionPreference = 'Stop'

# Raíz del repositorio (la carpeta padre de scripts\).
$raiz = Split-Path -Parent $PSScriptRoot

# El destino no puede quedar vacío ni ser la raíz de una unidad: un /MIR encima borraría de más.
if ([string]::IsNullOrWhiteSpace($Destino)) {
    throw 'El parametro -Destino no puede estar vacio.'
}
$destinoCompleto = [System.IO.Path]::GetFullPath($Destino)
if ($destinoCompleto -eq [System.IO.Path]::GetPathRoot($destinoCompleto)) {
    throw "El destino no puede ser la raiz de una unidad: $Destino"
}

# Las herramientas de transcripcion (vendor\transcriber) deben existir antes de copiar el proyecto.
$whisperCli = Join-Path $raiz 'vendor\transcriber\whisper\whisper-cli.exe'
if (-not (Test-Path -LiteralPath $whisperCli)) {
    Write-Host 'Faltan las herramientas de transcripcion; ejecutando fetch-transcriber.ps1 ...'
    & (Join-Path $PSScriptRoot 'fetch-transcriber.ps1')
}

Write-Host "Copiando el proyecto a $Compilacion ..."
New-Item -ItemType Directory -Force -Path $Compilacion | Out-Null
robocopy $raiz $Compilacion /MIR /R:2 /W:1 /XD (Join-Path $raiz 'dist') (Join-Path $raiz '.git') /NFL /NDL /NJH /NJS /NP
# Robocopy: 0-7 son exitos; 8 o mas es un fallo real.
if ($LASTEXITCODE -ge 8) {
    throw "robocopy (copia de compilacion) ha fallado (codigo $LASTEXITCODE)."
}
$LASTEXITCODE = 0

Push-Location $Compilacion
try {
    Write-Host 'Ejecutando pruebas...'
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Las pruebas han fallado (codigo $LASTEXITCODE)."
    }

    Write-Host 'Empaquetando para Windows...'
    npm run package:win
    if ($LASTEXITCODE -ne 0) {
        throw "El empaquetado ha fallado (codigo $LASTEXITCODE)."
    }

    $origen = Join-Path $Compilacion 'dist\DopesheetWriter-win32-x64'
    if (-not (Test-Path -LiteralPath $origen)) {
        throw "No existe la carpeta empaquetada: $origen"
    }

    Write-Host 'Cerrando DopesheetWriter.exe si esta en marcha...'
    Get-Process -Name 'DopesheetWriter' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name 'DopesheetWriter' -ErrorAction SilentlyContinue |
        Wait-Process -Timeout 10

    Write-Host "Copiando a $Destino ..."
    New-Item -ItemType Directory -Force -Path $Destino | Out-Null
    robocopy $origen $Destino /MIR /R:2 /W:1
    # Robocopy: 0-7 son exitos; 8 o mas es un fallo real.
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy ha fallado (codigo $LASTEXITCODE)."
    }
    $LASTEXITCODE = 0

    Write-Host "Despliegue completado en $Destino."
}
finally {
    Pop-Location
}

# Robocopy devuelve 1-7 cuando copia con exito; el script no debe propagar ese codigo.
exit 0
