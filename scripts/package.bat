@echo off
chcp 65001 >nul
REM =====================================================================
REM  宠物店管理系统 - 打包准备脚本 (Windows)  [云端授权模式]
REM  生成 dist/ 部署目录，供 Inno Setup (pet-store.iss) 编译成安装包。
REM
REM  运行前准备（只需做一次）：
REM    1) 已安装 Node.js 与 pnpm（构建前端）
REM    2) 全局安装 pkg:            npm i -g pkg
REM    3) 已安装 Inno Setup（iscc 在 PATH）
REM    4) 已部署 Netlify+Supabase 授权端，拿到站点地址
REM    5) 把便携版 MySQL 解压到  vendor\mysql  （含 bin\mysqld.exe）
REM    6) 把同版本 node.exe 放到  vendor\runtime\node.exe
REM       （版本需与下方 --targets 一致，当前 node22，详见 vendor\README.md）
REM
REM  ★ 把下面的 CLOUD_LICENSE_URL 改成你部署好的 Netlify 站点地址 ★
REM =====================================================================
set CLOUD_LICENSE_URL=https://your-site.netlify.app

setlocal
set ROOT=%~dp0..
cd /d %ROOT%

REM ---- 前置检查：便携运行时是否就位 ----
if not exist vendor\mysql\bin\mysqld.exe (
  echo [错误] 未找到 vendor\mysql\bin\mysqld.exe
  echo         请先把便携版 MySQL 8.0 (ZIP Archive) 解压到 vendor\mysql\
  goto :fail
)
if not exist vendor\runtime\node.exe (
  echo [错误] 未找到 vendor\runtime\node.exe
  echo         请先放入与开发机同版本的 node.exe（见 vendor\README.md）
  goto :fail
)

echo [1/6] 构建前端 (vite build)...
cd packages/client
call pnpm run build
if errorlevel 1 goto :fail
cd %ROOT%

echo [2/6] 为后端服务生成扁平 node_modules...
cd packages\local-server
call npm install --omit=dev --no-package-lock --no-audit --no-fund
if errorlevel 1 goto :fail
cd %ROOT%

echo [3/6] 组装 dist 部署目录...
if not exist dist mkdir dist
if not exist dist\packages mkdir dist\packages
if not exist dist\runtime mkdir dist\runtime

REM 前端产物
xcopy /E /I /Y packages\client\dist dist\packages\client\dist >nul
REM 后端业务服务（含刚生成的扁平 node_modules）
xcopy /E /I /Y packages\local-server dist\packages\local-server >nul
REM 便携运行时（来自 vendor/，事先已手动放入）
xcopy /E /I /Y vendor\mysql dist\mysql >nul
copy /Y vendor\runtime\node.exe dist\runtime\node.exe >nul
REM 启动器
copy /Y deploy\launcher.js dist\launcher.js >nul

echo [3.5/6] 写入生产 .env（指向云端授权服务）...
> dist\packages\local-server\.env (
  echo PORT=3001
  echo DB_HOST=localhost
  echo DB_PORT=3306
  echo DB_USER=root
  echo DB_PASSWORD=
  echo DB_NAME=pet_store
  echo JWT_SECRET=pet_store_local_secret_key_change_in_production
  echo JWT_EXPIRES=24h
  echo CLOUD_LICENSE_URL=%CLOUD_LICENSE_URL%
)

echo [4/6] 用 pkg 把 launcher 打成 launcher.exe...
pkg dist\launcher.js --targets node24-win-x64 --output dist\launcher.exe
if errorlevel 1 goto :fail

echo [5/6] 编译 Inno Setup 安装包...
iscc deploy\pet-store.iss
if errorlevel 1 goto :fail

echo [6/6] 完成！安装包位于 out\PetStoreSetup.exe
goto :eof

:fail
echo.
echo 打包失败，请检查上方错误信息。
exit /b 1
