@echo off
title Tikapoo Survival RPG - Palvelin
cd /d "%~dp0"
echo ===================================================
echo   Kaynnistetaan Tikapoo Survival RPG -palvelinta...
echo   Peli aukeaa selaimeen osoitteeseen http://localhost:3000
echo ===================================================
timeout /t 2 /nobreak >nul
start http://localhost:3000
npm run dev
pause
