; Pet Store Management - Inno Setup 安装包脚本
; 编译前请确保：
;   1) 已运行 scripts/package.bat 生成 dist/ 目录
;   2) dist/ 内含 runtime/node.exe、mysql/(便携版)、packages/、launcher.exe
;   3) 已安装 Inno Setup，且 iscc 在 PATH（或手动用 Inno Setup Compiler 打开本文件）
;
; 编译命令（在 repo 根目录）：
;   iscc deploy\pet-store.iss

[Setup]
AppName=宠物店管理系统
AppVersion=1.0.0
AppPublisher=Pet Store Management
DefaultDirName={autopf}\PetStoreManagement
DefaultGroupName=宠物店管理系统
OutputDir=out
OutputBaseFilename=PetStoreSetup
Compression=lzma2
SolidCompression=yes
; 安装过程不需要管理员权限（自带运行时，不写注册表服务）
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
; 允许在非 ASCII 路径安装
EnableDirDoesntExistWarning=no
UninstallDisplayName=宠物店管理系统
Uninstallable=yes

[Languages]
Name: "chinese"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Files]
; 整个应用目录（含 runtime / mysql / packages / launcher.exe）
Source: "dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\宠物店管理系统"; Filename: "{app}\launcher.exe"; WorkingDir: "{app}"
Name: "{commondesktop}\宠物店管理系统"; Filename: "{app}\launcher.exe"; WorkingDir: "{app}"

[Run]
; 安装完成后直接启动（用户也可之后从桌面图标启动）
Filename: "{app}\launcher.exe"; Description: "启动宠物店管理系统"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\mysql\data"
