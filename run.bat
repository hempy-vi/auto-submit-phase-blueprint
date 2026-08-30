@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo   Buoc 1: Dry-run (khong Submit ticket nao)
echo ===============================================
node index.js %* --dry-run
if errorlevel 1 (
  echo.
  echo Dry-run bao loi - dung lai, KHONG chay that.
  pause
  exit /b 1
)

echo.
set /p CONFIRM=Ticket tren da dung Phase/Assignee ban muon xu ly chua? Go Y roi Enter de Submit THAT tren Blueprint:
if /i not "%CONFIRM%"=="Y" (
  echo Da huy, khong chay that.
  pause
  exit /b 0
)

echo.
echo ===============================================
echo   Buoc 2: Chay that
echo ===============================================
node index.js %* --yes

echo.
echo Da chay xong - kiem tra lai bang tong ket phia tren (Thanh cong/Loi/Can kiem tra tay).
pause
