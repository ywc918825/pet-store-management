/**
 * Pet Store Management - 生产环境一键启动器 (CommonJS, 云端授权模式)
 *
 * 职责：
 *   1. 启动内置的便携版 MySQL（商家本地的【业务】数据库，存商品/销售/会员等）
 *   2. 首次运行时初始化本地业务数据库（建库 / 建表 / 灌种子）
 *   3. 启动本地业务服务 local-server（端口 3001），由它托管前端并打开浏览器
 *
 * 授权（激活码校验 / 心跳 / 拉黑）由 local-server 转发到你部署在
 * Netlify + Supabase 的【云端授权服务】完成，地址见 local-server/.env 的
 * CLOUD_LICENSE_URL。因此本启动器【不再】在商家电脑本地运行授权服务。
 *
 * 运行时依赖同目录的：
 *   - runtime/node.exe        （Node 运行时，用于 spawn 业务服务）
 *   - mysql/                  （便携版 MySQL，含 my.ini 与 data 目录）
 *   - packages/local-server/  （业务服务，已含扁平 node_modules 与前端 dist）
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const net = require('net')

const APP_ROOT = __dirname // 安装后的应用根目录
const NODE_EXE = path.join(APP_ROOT, 'runtime', 'node.exe')
const MYSQL_DIR = path.join(APP_ROOT, 'mysql')
const MYSQL_BIN = path.join(MYSQL_DIR, 'bin', 'mysqld.exe')
const MYSQL_DATA = path.join(MYSQL_DIR, 'data')
const MYSQL_INI = path.join(MYSQL_DIR, 'my.ini')
const SERVER_DIR = path.join(APP_ROOT, 'packages', 'local-server')
const INIT_FLAG = path.join(APP_ROOT, '.initialized')

// 应用访问端口：生产模式下前端由 local-server(3001) 直接托管，所以打开 3001
const PORT = process.env.APP_PORT || 3001
const MYSQL_PORT = process.env.DB_PORT || 3306
const DB_PWD = process.env.DB_PASSWORD || '' // --initialize-insecure 后 root 无密码

const children = []
let shuttingDown = false

function log(...a) {
  console.log(`[launcher ${new Date().toISOString()}]`, ...a)
}

// 等待某个 TCP 端口就绪
function waitForPort(port, host = '127.0.0.1', timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tryOnce = () => {
      const sock = net.connect(port, host)
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() - start > timeout) return reject(new Error(`wait port ${port} timeout`))
        setTimeout(tryOnce, 600)
      })
    }
    tryOnce()
  })
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', windowsHide: true, ...opts })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

// 生成 MySQL 配置文件（仅首次）
function writeMyIniIfNeeded() {
  if (fs.existsSync(MYSQL_INI)) return
  const ini = [
    '[mysqld]',
    `basedir=${MYSQL_DIR.replace(/\\/g, '/')}`,
    `datadir=${MYSQL_DATA.replace(/\\/g, '/')}`,
    `port=${MYSQL_PORT}`,
    'character-set-server=utf8mb4',
    'default-storage-engine=INNODB',
    'max_allowed_packet=64M',
    'sql_mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION',
    '[client]',
    `port=${MYSQL_PORT}`,
    'default-character-set=utf8mb4',
    ''
  ].join('\n')
  fs.writeFileSync(MYSQL_INI, ini, 'utf8')
  log('Wrote my.ini')
}

async function initMysqlIfNeeded() {
  // MySQL 8 初始化后 datadir 下会有 mysql 系统库目录
  if (fs.existsSync(path.join(MYSQL_DATA, 'mysql'))) {
    log('MySQL data dir already initialized, skip')
    return
  }
  log('Initializing MySQL data directory (this may take a while)...')
  await run(MYSQL_BIN, ['--initialize-insecure', `--basedir=${MYSQL_DIR}`, `--datadir=${MYSQL_DATA}`])
  log('MySQL initialized (root has no password)')
}

function startMysql() {
  log('Starting MySQL...')
  const p = spawn(MYSQL_BIN, [`--defaults-file=${MYSQL_INI}`, `--datadir=${MYSQL_DATA}`], {
    windowsHide: true,
    stdio: 'ignore'
  })
  p.on('error', (e) => log('MySQL spawn error:', e.message))
  children.push({ name: 'mysql', p })
  return p
}

function startNodeService(name, cwd, entry) {
  log(`Starting ${name}...`)
  const p = spawn(
    NODE_EXE,
    [entry],
    {
      cwd,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: 'production', SERVE_CLIENT: 'true' },
      stdio: 'inherit'
    }
  )
  p.on('error', (e) => log(`${name} spawn error:`, e.message))
  children.push({ name, p })
  return p
}

async function bootstrap() {
  // 确保上传/备份目录存在
  fs.mkdirSync(path.join(SERVER_DIR, 'uploads'), { recursive: true })
  fs.mkdirSync(path.join(SERVER_DIR, 'backups'), { recursive: true })

  if (!fs.existsSync(NODE_EXE)) {
    log('FATAL: runtime/node.exe not found. Please run package.bat first.')
    process.exit(1)
  }
  if (!fs.existsSync(MYSQL_BIN)) {
    log('FATAL: mysql/bin/mysqld.exe not found. Please bundle portable MySQL.')
    process.exit(1)
  }

  writeMyIniIfNeeded()
  await initMysqlIfNeeded()
  startMysql()
  await waitForPort(MYSQL_PORT)
  log('MySQL is up')

  // 首次运行：建库 / 建表 / 灌种子（仅本地【业务】库，授权由云端负责）
  if (!fs.existsSync(INIT_FLAG)) {
    log('First run: migrating & seeding local business database...')
    await run(NODE_EXE, [path.join(SERVER_DIR, 'scripts', 'migrate.js')])
    await run(NODE_EXE, [path.join(SERVER_DIR, 'scripts', 'seed.js')])
    fs.writeFileSync(INIT_FLAG, new Date().toISOString())
    log('Local business database initialized')
  }

  // 启动业务服务（它会在需要时把授权请求转发到 CLOUD_LICENSE_URL 指向的云端）
  startNodeService('local-server', SERVER_DIR, 'src/index.js')

  await waitForPort(3001)
  log('All services are up')

  // 打开浏览器
  const url = `http://localhost:${PORT}`
  log('Opening browser:', url)
  spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', windowsHide: true })

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  log('Shutting down all services...')
  for (const { p } of children) {
    try { p.kill('SIGTERM') } catch (e) { /* ignore */ }
  }
  setTimeout(() => process.exit(0), 2000)
}

bootstrap().catch((e) => {
  log('FATAL:', e && e.stack ? e.stack : e)
  process.exit(1)
})
