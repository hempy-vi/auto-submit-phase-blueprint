@echo off
setlocal
cd /d "%~dp0"

echo(%*| findstr /C:"--dry-run" >nul
if not errorlevel 1 (
  echo ===============================================
  echo   Dry-run ^(khong Submit ticket nao^)
  echo ===============================================
) else (
  echo ===============================================
  echo   Submit that tren Blueprint
  echo ===============================================
)
node index.js %* --yes

echo.
echo Da chay xong - kiem tra lai bang tong ket phia tren (Thanh cong/Loi/Can kiem tra tay).
pause
