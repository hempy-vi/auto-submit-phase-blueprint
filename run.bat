@echo off
if "%~1"=="/HIDDEN" goto :body

rem Chuyen sang chay AN hoan toan (khong cua so, khong icon taskbar) qua
rem run-hidden.vbs cung thu muc - cua so hien tai thoat ngay lap tuc.
wscript.exe "%~dp0run-hidden.vbs" %*
exit /b

:body
rem Chay AN thuc su (goi lai qua run-hidden.vbs). "shift" KHONG lam %* doi
rem theo (da kiem chung) nen phai tu rebuild tham so bang vong lap; "shift"
rem cung lam doi ca %0 (da kiem chung) nen phai luu %~dp0 TRUOC khi shift.
set "SCRIPT_DIR=%~dp0"
setlocal enabledelayedexpansion
shift
set "FWD_ARGS="
:rebuild_args
if not "%~1"=="" (
  set "FWD_ARGS=!FWD_ARGS! "%~1""
  shift
  goto :rebuild_args
)

cd /d "%SCRIPT_DIR%"
if not exist logs mkdir logs
node index.js !FWD_ARGS! --yes > logs\run-last.log 2>&1
