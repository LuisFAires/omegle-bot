const { app, BrowserWindow, Notification, ipcMain, Tray } = require('electron');
const fs = require('fs');
const path = require('path');
const bot = require(path.join(__dirname, 'bot.js'));
const status = require(path.join(__dirname, 'botstatus.js'));

let mainWindow;

function createWindow () {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, 'img/logocropped.png'),
        webPreferences: {
            spellcheck: false,
            preload: path.join(__dirname, 'preload.js')
        },
        minWidth: 800,
        minHeight: 765,
    })
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setMenu(null);
    mainWindow.maximize();
    //mainWindow.webContents.openDevTools()

    mainWindow.on('minimize',function(event){
        event.preventDefault();
        mainWindow.hide();
        new Notification({ title: 'Omegle-bot', body: 'App hidden, available in system tray' }).show()
    });
}

if (process.platform === 'win32'){
    app.setAppUserModelId(app.name);
}

app.whenReady().then(async () => {
    await createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin'){
            app.quit()
            status.stop = true
        }
    })

    mainWindow.on('ready-to-show', () => {
        fs.readFile(path.join(__dirname, 'botconfig.json'), 'utf8', (err, data) => {
            mainWindow.webContents.send('readedConfig', data);;
        });
    })
    
    tray = new Tray(path.join(__dirname, 'img/logocropped.png'))
    tray.on('click', () => {
        mainWindow.show();
    })
    tray.setToolTip('Omegle bot');

        
    ipcMain.on('start', function(event, args){
        tray.setImage(path.join(__dirname, 'img/working.png'));
        let config = JSON.stringify(args, null, 4);
        fs.writeFileSync(path.join(__dirname, 'botconfig.json'), config);
        bot.launchBrowser(args, mainWindow);
    });

    ipcMain.on('stop', () =>{
        status.stop = true;
    })

    ipcMain.on('maximize', () => {
        mainWindow.show();
    })
})