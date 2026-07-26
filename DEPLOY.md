# 授权后台部署详细指南（Netlify + Supabase）

本指南把「轨 B：授权端部署」拆成**一步一步、照着点就能成功**的操作。
你（软件厂商）只需部署**一次**，之后发给商家的 exe 会自动连上来。

> 结论先说清：Netlify 上部署的是**授权后端 API**（激活码校验、发卡、心跳），
> 不是登录网页。登录发卡用的网页在厂商自己电脑的本地开发环境里（见第 7 步）。
> 商家不需要碰 Netlify / Supabase，他们只装 exe。

---

## 第 0 步：准备 GitHub 仓库（只做一次）

1. 打开 https://github.com ，登录 / 注册一个账号。
2. 右上角点 **＋ → New repository**。
3. Repository name 填 `pet-store-management`，其余默认（**不要**勾 Initialize with README），点 **Create repository**。
4. 在你电脑的项目根目录（`E:\trae project\pet-store-management`）打开终端，依次执行：

   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/pet-store-management.git
   git push -u origin main
   ```

   > 把 `你的用户名` 换成你真实的 GitHub 用户名。如果提示登录，按提示用浏览器授权即可。

---

## 第 1 步：建 Supabase 数据库（只做一次）

1. 打开 https://supabase.com ，点 **Start your project** 注册登录。
2. 控制台点 **New project**：
   - Name：随便，如 `pet-store-license`
   - Database Password：**记下来！** 这是数据库密码，第 3 步要用（例如设成 `MyDb#2026`）
   - Region：选 **Southeast Asia (Singapore)** 或 **Northeast Asia (Tokyo)**（离国内近一点，比欧美快）
   - 点 **Create new project**，等 1～2 分钟建好。
3. 建好后进入项目，左侧菜单点 **SQL Editor**（图标像个小数据库 / 终端）。
4. 点 **New query**，把本仓库文件
   `packages/cloud-license-service/supabase/schema.sql`
   的**全部内容**复制粘贴进编辑器，然后点右上角 **Run** 执行。
   - 看到 3 张表创建成功（无报错即成功）。
   - 这一步建了 `activation_codes` / `device_bindings` / `heartbeat_logs` 三张表。

---

## 第 2 步：复制数据库连接串（第 3 步要填）

1. 左侧菜单点 **Project Settings**（齿轮图标）→ 右侧 **Database**。
2. 往下找到 **Connection string** 区域。
3. 选 **Transaction pooler**（务必是它，端口 `6543`，**不要**选 Session pooler 5432）。
4. 复制那一长串 URI，形如：

   ```
   postgresql://postgres.xxxxx:6543/postgres?pgbouncer=true
   ```

5. **关键：把里面的 `[YOUR-PASSWORD]` 换成第 1 步你设的数据库密码。**
   替换后完整串类似：

   ```
   postgresql://postgres.xxxxx:MyDb#2026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   > 找不到密码？回到 **Project Settings → Database** 顶部，有 **Database password** 一栏，
   > 可点 **Reset password** 重置，然后用新密码。

---

## 第 3 步：一键部署到 Netlify

1. 打开下面的按钮链接（先把 `你的用户名` 换成你真实的 GitHub 用户名）：

   > https://app.netlify.com/start/deploy?repository=https://github.com/你的用户名/pet-store-management

2. 首次会让你 **Authorize**（授权 Netlify 访问你的 GitHub），点 **Authorize Netlify**。
3. 选你的仓库 `pet-store-management`，点 **Deploy**。
4. 进入配置页，重点填 **Environment variables（环境变量）**。点 **Add variable** 逐条添加：

   | Key（变量名，照抄） | Value（取值） |
   |---|---|
   | `DATABASE_URL` | **必填** —— 第 2 步得到的完整连接串（已替换密码、带 `?pgbouncer=true`） |
   | `JWT_SECRET` | **必填** —— 一段随机串。在终端跑 `openssl rand -hex 32` 复制输出；或随便写 32 位以上字符如 `a1b2c3...` |
   | `ADMIN_USERNAME` | 可选，默认 `admin` |
   | `ADMIN_PASSWORD` | 可选，默认 `license123`（**上线务必改成强密码**） |
   | `ISSUE_KEY` | 可选，默认 `dev-issue-key`（**上线务必改成强随机值**，支付回调要用） |

   > 只填这 5 个即可，其余留空。
5. 点 **Deploy**（或 **Deploy site**）。Netlify 会自动读取仓库根目录的 `netlify.toml`
   （base 指向 `packages/cloud-license-service`），安装依赖并部署函数。
   - 首次构建 1～3 分钟，日志走到 `Finished` / 出现绿色 **Published** 即成功。
6. 部署完成后，Netlify 给你一个站点地址，形如：

   ```
   https://xxxxx.netlify.app
   ```

   **把这个地址记下来** —— 这是「轨 A 打包」第 2 步要填的 `CLOUD_LICENSE_URL`。

---

## 第 4 步：验证部署真的通了

在浏览器地址栏直接访问（把 `xxxxx` 换成你的站点名）：

```
https://xxxxx.netlify.app/api/license/status
```

- 如果返回一段 JSON（含 `"code":0` 之类），说明后端 + 数据库都通了 ✅。
- 如果报错 / 空白：回到 Netlify 后台 **Site settings → Environment variables** 检查
  `DATABASE_URL` 是否填对（密码替换了？带了 `?pgbouncer=true`？端口是 `6543`？）；
  看 **Deploys → 最新一次 → Deploy log** 有无报错。

---

## 第 5 步：发激活码给商家（在厂商本地操作）

> 重要：Netlify 站点**只是 API，没有登录页面**。登录发卡网页在你（厂商）电脑的
> 本地开发环境里。你不需要把发卡后台公开到网上。

1. 在你电脑的项目里，编辑 `packages/local-server/.env`，确保有一行：

   ```
   CLOUD_LICENSE_URL=https://xxxxx.netlify.app
   ```

   （把 `xxxxx` 换成第 3 步的站点名。这样本地代理就会把授权请求转发到云端。）

2. 启动本地开发环境：

   ```bash
   pnpm -r --parallel run dev
   ```

3. 浏览器打开后台登录页：

   ```
   http://localhost:5173/#/admin/login
   ```

4. 用管理员账号登录（默认 `admin` / `license123`，上线请改）。
5. 进入 `http://localhost:5173/#/admin/license`：
   - 填时长（如 `365` 天）、版本、设备数、数量、备注 → **生成激活码**。
   - 生成的码复制后发给商家，商家在 exe 里激活即用。
   - 也可在这里拉黑某码、解绑某台设备。

> 也可以接支付平台：商家付款后，支付平台用 `ISSUE_KEY` 调用
> `POST https://xxxxx.netlify.app/api/admin/issue` 自动发卡（回调逻辑已实现，
> 通知方式 `notifyIssue()` 目前是占位，需要可再接微信 / 邮件）。

---

## 第 6 步：与「轨 A 用户端 exe」打通

- 轨 A 打包时，把 `scripts/package.bat` 第一行的
  `set CLOUD_LICENSE_URL=https://your-site.netlify.app`
  改成第 3 步拿到的 `https://xxxxx.netlify.app`，再打包。
- 之后商家安装的 exe，激活 / 心跳就会自动连你云端 Supabase，数据校验全部走这里。

---

## 两点提醒（影响体验，部署前想清楚）

- **国内延迟**：Netlify 与 Supabase 均无中国大陆节点。商家激活 / 心跳走海外线路，
  有几百毫秒延迟且偶有墙波动。若你的用户都在国内，建议把同一套代码部署到
  **腾讯云 / 阿里云轻量服务器 + PostgreSQL**，代码零改动，只换 `DATABASE_URL`。
- **密钥安全**：`ADMIN_PASSWORD` / `ISSUE_KEY` / `JWT_SECRET` 上线务必用强随机值，
  不要沿用默认值 `license123` / `dev-issue-key`。

---

## 故障速查

| 现象 | 排查 |
|---|---|
| Deploy 报 `Cannot find module 'sqlite3'` 或原生模块错误 | 确认 `netlify.toml` 里 `node_bundler = "nft"`（已改好） |
| 访问 `/api/license/status` 报数据库连接错 | `DATABASE_URL` 密码没替换 / 端口不是 6543 / 缺 `?pgbouncer=true` |
| 发卡后台登录无反应 | 确认 `packages/local-server/.env` 的 `CLOUD_LICENSE_URL` 指向云端，且 `pnpm -r --parallel run dev` 已启动 |
| 商家激活不走云端 | 检查 exe 打包时的 `CLOUD_LICENSE_URL` 是否填成了你的 Netlify 地址 |
