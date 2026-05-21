const { app, BrowserWindow, ipcMain, Notification } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 560,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#EDE3CD',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false  // 防止窗口失焦时 Chromium 节流 setInterval
    }
  })

  win.loadFile('index.html')
}

ipcMain.on('notify', (_event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
