param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngFrames = New-Object 'System.Collections.Generic.List[byte[]]'

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $scale = $size / 256.0
    [System.Drawing.PointF[]]$outerPoints = @(
        [System.Drawing.PointF]::new(128*$scale, 8*$scale),
        [System.Drawing.PointF]::new(239*$scale, 69*$scale),
        [System.Drawing.PointF]::new(220*$scale, 190*$scale),
        [System.Drawing.PointF]::new(128*$scale, 248*$scale),
        [System.Drawing.PointF]::new(36*$scale, 190*$scale),
        [System.Drawing.PointF]::new(17*$scale, 69*$scale)
    )
    $outerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $outerPath.AddPolygon($outerPoints)
    $metal = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(0, 0),
        [System.Drawing.PointF]::new($size, $size),
        [System.Drawing.Color]::FromArgb(255, 224, 238, 237),
        [System.Drawing.Color]::FromArgb(255, 22, 38, 41)
    )
    $graphics.FillPath($metal, $outerPath)

    [System.Drawing.PointF[]]$innerPoints = @(
        [System.Drawing.PointF]::new(128*$scale, 22*$scale),
        [System.Drawing.PointF]::new(224*$scale, 75*$scale),
        [System.Drawing.PointF]::new(208*$scale, 181*$scale),
        [System.Drawing.PointF]::new(128*$scale, 232*$scale),
        [System.Drawing.PointF]::new(48*$scale, 181*$scale),
        [System.Drawing.PointF]::new(32*$scale, 75*$scale)
    )
    $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $innerPath.AddPolygon($innerPoints)
    $innerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 8, 19, 22))
    $graphics.FillPath($innerBrush, $innerPath)
    $edgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(205, 93, 216, 210), [Math]::Max(1, $size/80.0))
    $graphics.DrawPath($edgePen, $innerPath)

    $font = New-Object System.Drawing.Font('Bahnschrift', [Math]::Max(8, $size*0.48), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $letterBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 229, 240, 239))
    $graphics.DrawString('A', $font, $letterBrush, [System.Drawing.RectangleF]::new(0, -$size*0.015, $size, $size*0.91), $format)
    $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(215, 43, 216, 210), [Math]::Max(1, $size/52.0))
    $graphics.DrawLine($glowPen, [single]($size*0.39), [single]($size*0.67), [single]($size*0.62), [single]($size*0.67))

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngFrames.Add($stream.ToArray())

    $stream.Dispose(); $bitmap.Dispose(); $graphics.Dispose(); $outerPath.Dispose(); $innerPath.Dispose()
    $metal.Dispose(); $innerBrush.Dispose(); $edgePen.Dispose(); $font.Dispose(); $format.Dispose(); $letterBrush.Dispose(); $glowPen.Dispose()
}

$icoStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icoStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sizeByte = if ($sizes[$i] -eq 256) { [byte]0 } else { [byte]$sizes[$i] }
    $writer.Write($sizeByte); $writer.Write($sizeByte)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([UInt16]1); $writer.Write([UInt16]32)
    $writer.Write([UInt32]$pngFrames[$i].Length)
    $writer.Write([UInt32]$offset)
    $offset += $pngFrames[$i].Length
}
foreach ($frame in $pngFrames) { $writer.Write($frame) }
$writer.Flush()

$publicDir = Join-Path $ProjectRoot 'public'
New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
$iconPath = Join-Path $publicDir 'ez-ai.ico'
[System.IO.File]::WriteAllBytes($iconPath, $icoStream.ToArray())
$icoStream.Dispose(); $writer.Dispose()
Copy-Item -LiteralPath $iconPath -Destination (Join-Path $ProjectRoot 'ez-ai.ico') -Force
Write-Output "Created multi-resolution EZ AI icon: $iconPath"
