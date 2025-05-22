const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let goServer = null;

function startGoFileManager() {
  // Assuming the Go binary is in the resources directory
  const goServerPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../resources/filemanager')
    : path.join(process.resourcesPath, 'filemanager');

  goServer = spawn(goServerPath, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  goServer.stdout.on('data', (data) => {
    console.log(`Go server stdout: ${data}`);
  });

  goServer.stderr.on('data', (data) => {
    console.error(`Go server stderr: ${data}`);
  });

  goServer.on('close', (code) => {
    console.log(`Go server process exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // In development, load from the Vite dev server
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // In production, load the built files
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // Start the Go file manager server
  startGoFileManager();
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Kill the Go server when the app is closed
  if (goServer) {
    goServer.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Ensure the Go server is killed when the app quits
app.on('quit', () => {
  if (goServer) {
    goServer.kill();
  }
}) 