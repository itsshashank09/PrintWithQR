Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\shashank\.gemini\antigravity\brain\e0ed9dcf-a625-4041-895a-af28ff96d0b6\.user_uploaded\media_1786343490229.jpg'
$bmp = New-Object System.Drawing.Bitmap($imgPath)
Write-Output "Width: $($bmp.Width), Height: $($bmp.Height)"

$cols = 5
$rows = 4
$cellW = $bmp.Width / $cols
$cellH = $bmp.Height / $rows

# We want Row 1 (index 0), Col 3 (index 2)
$x = [math]::Floor($cellW * 2)
$y = 0
$w = [math]::Floor($cellW)
$h = [math]::Floor($cellH)

Write-Output "Crop Rect: X: $x, Y: $y, W: $w, H: $h"

$rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
$cropped = $bmp.Clone($rect, $bmp.PixelFormat)

$outPath = 'c:\Users\shashank\Downloads\New folder (2)\frontend\public\favicon.png'
$cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$cropped.Dispose()
Write-Output "Saved to $outPath"
