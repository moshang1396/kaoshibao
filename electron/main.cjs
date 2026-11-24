// 考试宝 Electron 主进程
// 生产模式加载 dist/index.html（纯离线），开发模式加载 Vite dev 服务器
const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = !app.isPackaged

// ===== 完全绿色化：便携模式下数据存 exe 旁的 Data 目录 =====
// electron-builder portable 目标运行时通过 PORTABLE_EXECUTABLE_DIR 指向 exe 实际所在目录
// （exe 本身解压到临时目录运行，所以不能用 __dirname / execPath）
if (!isDev && process.env.PORTABLE_EXECUTABLE_DIR) {
  const dataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Data')
  const legacyDir = app.getPath('userData') // 旧版数据位置 AppData\Roaming\kaoshibao
  if (!fs.existsSync(dataDir) && fs.existsSync(legacyDir)) {
    try {
      fs.cpSync(legacyDir, dataDir, { recursive: true })
    } catch (e) {
      console.error('迁移旧数据失败，将使用空数据目录:', e)
    }
  }
  app.setPath('userData', dataDir)
}

function createWindow() {
  // 窗口/任务栏图标：打包后取资源目录里的 icon.png，与手机端图标一致
  let winIcon
  if (!isDev) {
    const iconPath = path.join(process.resourcesPath, 'icon.png')
    if (fs.existsSync(iconPath)) winIcon = iconPath
  }
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 860,
    title: '考试宝',
    autoHideMenuBar: true,
    icon: winIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  // 隐藏菜单栏（保留 Ctrl+Shift+I 开发者工具便于排查）
  Menu.setApplicationMenu(null)

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 关闭全部窗口即退出（单窗口工具类应用）
app.on('window-all-closed', () => app.quit())
