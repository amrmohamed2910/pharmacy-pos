@echo off
chcp 65001 >nul
title صيدليتي | Pharmacy Suite
cd /d "%~dp0backend"

if not exist "%~dp0frontend\dist\index.html" (
    echo [!] الواجهة غير مبنية بعد. سيتم تثبيت الحزم وبناء الواجهة الآن...
    pushd "%~dp0frontend"
    call npm.cmd install
    call npm.cmd run build
    popd
    if errorlevel 1 (
        echo [X] فشل بناء الواجهة. راجع الرسائل أعلاه.
        pause
        exit /b 1
    )
)

echo.
echo   صيدليتي | نظام إدارة الصيدلية
echo   ---------------------------------
echo   الخادم يعمل على: http://127.0.0.1:8000
echo   للإيقاف اضغط Ctrl+C في هذه النافذة.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:8000'"
python -m uvicorn main:app --host 127.0.0.1 --port 8000

echo.
echo [!] تم إيقاف الخادم.
pause
