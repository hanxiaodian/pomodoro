const { app, BrowserWindow, ipcMain, Notification } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 560,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F7F2EC',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
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
