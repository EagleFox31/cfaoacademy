Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jakaa\Downloads\cfaoacademy\assets\team\cedric-pako.png"
$destPath1 = "C:\Users\jakaa\Downloads\cfaoacademy\frontend\public\assets\team\cedric-pako.png"
$destPath2 = "C:\Users\jakaa\Downloads\cfaoacademy\assets\team\cedric-pako-web.png"

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

# Calculer dimensions cible (ex: 800px max de large en gardant le ratio)
$targetWidth = 800
$targetHeight = [int]($srcImg.Height * ($targetWidth / $srcImg.Width))

$destBitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($destBitmap)

# Qualité maximale avec interpolation bicubique et anticrénelage
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$rect = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
$graphics.DrawImage($srcImg, $rect)

$destBitmap.Save($destPath1, [System.Drawing.Imaging.ImageFormat]::Png)
$destBitmap.Save($destPath2, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$destBitmap.Dispose()
$srcImg.Dispose()

Write-Output "Successfully resized cedric-pako.png to $targetWidth x $targetHeight"
