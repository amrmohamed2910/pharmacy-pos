@echo off
chcp 65001 >nul
title صيدليتي | الإعداد الأولي
setlocal
cd /d "%~dp0backend"

echo.
echo   ============================================
echo    صيدليتي | تثبيت وإعداد النظام
echo   ============================================
echo.

echo [1/6] تثبيت حزم الخادم...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo.
echo [2/6] إنشاء قاعدة البيانات إن لم تكن موجودة...
python init_db.py
if errorlevel 1 goto :error

echo.
echo [3/6] ترقية جداول قاعدة البيانات...
python migrate.py
if errorlevel 1 goto :error

echo.
echo [4/6] إضافة البيانات التجريبية (إن كانت القاعدة فارغة)...
python seed_demo.py
if errorlevel 1 goto :error

echo.
echo [5/6] تثبيت حزم الواجهة...
pushd "%~dp0frontend"
call npm.cmd install
if errorlevel 1 goto :error

echo.
echo [6/6] بناء الواجهة للإنتاج...
call npm.cmd run build
if errorlevel 1 goto :error
popd

echo.
echo   ============================================
echo    تم الإعداد بنجاح.
echo    شغّل الآن: start.bat
echo   ============================================
echo.
pause
exit /b 0

:error
echo.
echo [X] حدث خطأ أثناء الإعداد. راجع الرسائل أعلاه.
echo     تأكد من تثبيت Python و Node.js وتشغيل خدمة MySQL.
echo.
pause
exit /b 1
