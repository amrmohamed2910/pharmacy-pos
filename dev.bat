@echo off
chcp 65001 >nul
title صيدليتي | وضع التطوير
cd /d "%~dp0"

echo.
echo   تشغيل الخادم والواجهة في وضع التطوير...
echo   الواجهة: http://127.0.0.1:5173
echo   الخادم:  http://127.0.0.1:8000
echo.

start "صيدليتي - الخادم" /D "%~dp0backend" cmd /k "python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
start "صيدليتي - الواجهة" /D "%~dp0frontend" cmd /k "npm.cmd run dev"

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://127.0.0.1:5173'"

echo تم فتح نافذتين: الخادم والواجهة. أغلق النافذتين لإيقاف النظام.
timeout /t 4 /nobreak >nul
