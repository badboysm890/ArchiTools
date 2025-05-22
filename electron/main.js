const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')

let llamaSwapProcess = null
const logFile = path.join(__dirname, 'llamacpp-binaries', 'llama-swap.log')

// Function to start the llama-swap server
function startLlamaSwapServer() {
  if (llamaSwapProcess) {
    console.log('llama-swap server is already running')
    return
  }

  // Determine OS and set binary and config
  let binaryName, configFile
  const platform = os.platform()
  
  if (platform === 'darwin') {
    binaryName = 'llama-swap-darwin-arm64'
    configFile = 'config.yaml'
  } else if (platform === 'linux') {
    binaryName = 'llama-swap-linux-amd64'
    configFile = 'config.yaml'
  } else if (platform === 'win32') {
    binaryName = 'llama-swap-windows-amd64.exe'
    configFile = 'config-windows.yaml'
  } else {
    console.error(`Unsupported OS: ${platform}`)
    return
  }

  const binariesDir = path.join(__dirname, 'llamacpp-binaries')
  const binaryPath = path.join(binariesDir, binaryName)
  const configPath = path.join(binariesDir, configFile)
  const tempConfigPath = path.join(binariesDir, 'temp-config.yaml')

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    console.error(`Binary not found: ${binaryPath}`)
    return
  }

  // Check if config exists
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`)
    return
  }

  // Check if llama-server exists
  const llamaServerPath = path.join(binariesDir, 'llama-server')
  if (!fs.existsSync(llamaServerPath)) {
    console.error(`llama-server binary not found: ${llamaServerPath}`)
    console.error('Please ensure llama-server is in the llamacpp-binaries directory')
    return
  }

  // Create a temporary config file with the paths replaced
  try {
    // Read the original config file
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Convert all paths to use the correct path format for the current OS
    let formattedBinariesDir = binariesDir;
    if (platform === 'win32') {
      formattedBinariesDir = formattedBinariesDir.replace(/\\/g, '\\\\');
    }
    
    // Replace all instances of $BINARY_DIR with the actual path
    configContent = configContent.replace(/\$BINARY_DIR/g, formattedBinariesDir);
    
    // Write the modified config to a temporary file
    fs.writeFileSync(tempConfigPath, configContent);
    
    console.log('Created temporary config file with resolved paths');
  } catch (error) {
    console.error(`Error creating temporary config file: ${error}`);
    return;
  }

  console.log('Starting llama-swap server...')
  console.log(`Binary: ${binaryPath}`)
  console.log(`Config: ${tempConfigPath}`)

  // Create log file stream
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  // Start the process
  try {
    // On macOS and Linux, ensure the binary is executable
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, '755')
      fs.chmodSync(llamaServerPath, '755')
    }

    llamaSwapProcess = spawn(binaryPath, ['--config', tempConfigPath, '--listen', ':8091'], {
      detached: platform !== 'win32', // Detach on Unix-like systems
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: binariesDir  // Set the working directory to the binaries directory
    })

    // If detached on Unix, unref to allow the Node process to exit independently
    if (platform !== 'win32') {
      llamaSwapProcess.unref()
    }

    // Log output
    llamaSwapProcess.stdout.pipe(logStream)
    llamaSwapProcess.stderr.pipe(logStream)

    llamaSwapProcess.stdout.on('data', (data) => {
      console.log(`llama-swap stdout: ${data}`)
    })

    llamaSwapProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString()
      console.error(`llama-swap stderr: ${errorMsg}`)
      
      // Check if error is just that the server is already running
      if (errorMsg.includes('address already in use')) {
        console.log('llama-swap server is already running on port 8091, continuing...')
        // Clean up the process since we don't need it
        if (llamaSwapProcess) {
          llamaSwapProcess.kill()
          llamaSwapProcess = null
        }
      }
    })

    llamaSwapProcess.on('error', (error) => {
      console.error(`Failed to start llama-swap: ${error}`)
      llamaSwapProcess = null
    })

    llamaSwapProcess.on('close', (code) => {
      if (code !== 0) {
        console.log(`llama-swap process exited with code ${code}`)
      }
      llamaSwapProcess = null
      
      // Clean up the temporary config file
      try {
        fs.unlinkSync(tempConfigPath);
      } catch (error) {
        console.error(`Error removing temporary config file: ${error}`);
      }
    })

    console.log('llama-swap server started on port 8091')
  } catch (error) {
    console.error(`Exception starting llama-swap: ${error}`)
    
    // Clean up the temporary config file on error
    try {
      fs.unlinkSync(tempConfigPath);
    } catch (unlinkError) {
      console.error(`Error removing temporary config file: ${unlinkError}`);
    }
  }
}

// Function to stop the llama-swap server
function stopLlamaSwapServer() {
  if (!llamaSwapProcess) {
    console.log('llama-swap server is not running')
    return
  }

  console.log('Stopping llama-swap server...')
  
  try {
    // Kill the process
    if (os.platform() === 'win32') {
      // On Windows
      spawn('taskkill', ['/pid', llamaSwapProcess.pid, '/f', '/t'])
    } else {
      // On Unix-like systems
      process.kill(llamaSwapProcess.pid)
    }
    
    console.log('llama-swap server stopped')
  } catch (error) {
    console.error(`Error stopping llama-swap server: ${error}`)
  } finally {
    llamaSwapProcess = null
  }
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
  // Start the llama-swap server when the app is ready
  startLlamaSwapServer()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Stop the llama-swap server before the app quits
app.on('will-quit', () => {
  stopLlamaSwapServer()
}) 