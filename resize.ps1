Add-Type -AssemblyName System.Drawing
$inPath = 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\favicon.png'
$src = New-Object System.Drawing.Bitmap($inPath)

function Resize-Image($img, $size, $path) {
    $dest = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $size, $size)
    $dest.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
}

Resize-Image $src 48 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\favicon-48x48.png'
Resize-Image $src 180 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\apple-touch-icon.png'
Resize-Image $src 192 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\logo192.png'
Resize-Image $src 32 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\favicon.ico'

$src.Dispose()
Remove-Item -Path 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\favicon.svg' -ErrorAction SilentlyContinue
