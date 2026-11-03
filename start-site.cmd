@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js，或使用其他本地服务器打开此目录。
  pause
  exit /b 1
)
title Live · Create · Journey - Local Server
node server.js
if errorlevel 1 pause
