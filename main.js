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

    mainWindow.on('close',(event) =>{
        const { dialog } = require('electron')
        let choice = dialog.showMessageBoxSync({
            message:"Do you really want do exit?",
            type: "warning",
            buttons:["Yes", "No"]
        })
        if(choice == 1){
            event.preventDefault()
        }
    })
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
            status.stop = true
            app.quit();
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