const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
let stop;

function createWindow () {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, 'logocropped.png'),
        webPreferences: {
            spellcheck: false,
            preload: path.join(__dirname, 'preload.js')
        },
        width: 950,
        height: 710,
        resizable: false,
    })
    mainWindow.loadFile('index.html')
    mainWindow.setMenu(null)
    //mainWindow.webContents.openDevTools()

    mainWindow.on('minimize',function(event){
        event.preventDefault();
        mainWindow.hide();
        const { Notification } = require('electron')
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
        if (process.platform !== 'darwin') app.quit()
        stop = true
    })

    const { ipcMain, Tray, Menu } = require('electron')
    
    tray = new Tray(path.join(__dirname, 'logocropped.png'))
    var contextMenu = Menu.buildFromTemplate([
        { label: 'Stop', click:  function(){
            stop = true;
        } },
        { label: 'Show App', click:  function(){
            mainWindow.show();
        } },
        { label: 'Quit', click:  function(){
            app.isQuiting = true;
            app.quit();
        } }
    ]);
    tray.on('click', () => {
        mainWindow.show();
    })
    tray.setToolTip('Omegle bot')
    tray.setContextMenu(contextMenu)

        
    ipcMain.on('start', function(event, args){
        launchBrowser(args.msg, args.targetAvg, args.headless, args.language);
    });

    ipcMain.on('stop', () =>{
        stop = true;
    })

    ipcMain.on('maximize', () => {
        mainWindow.show();
    })
})

async function launchBrowser(msg, targetAvg, headless, language){

    let status = {
        started: new Date().toISOString(),
        lastSent: "",
        avgPerMinute: NaN,
        instantAvg: [],
        delay: 50,
        totalSent: 0,
        notSent: 0,
        errorIntervals: [],
        errorLastDate: '',
        captchaIntervals: [],
        captchaLastDate: ''
    }
    stop = false;

    mainWindow.webContents.send('activity',"Launching browser...");
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const solve = require('./puppeteer-recaptcha-solver/index.js');
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({ headless: headless, defaultViewport: null, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials']});
    let page;
    agreementScreen();

    async function agreementScreen(){
        try{
            mainWindow.webContents.send('activity',"Loading page...");
            page = await browser.newPage();
            let client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');
            await page.evaluateOnNewDocument((language) => {
                Object.defineProperty(navigator, "language", {
                    get: function() {
                        return language;
                    }
                });
            }, language);
    
            await page.goto('https://omegle.com');
            mainWindow.webContents.send('activity',"Checking agreements...")
            await page.click("#textbtn", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(2) > label > input[type=checkbox]", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(3) > label > input[type=checkbox]", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(4) > input[type=button]", {delay: status.delay});
            chatScreen()
        }catch(e){
            await page.close();
            if(stop === false){
                agreementScreen();
            }else{
                await browser.close();
                mainWindow.webContents.send('stoped');
            }
        }
    }
    
    async function chatScreen(){
        try{
            if(stop === true){
                mainWindow.webContents.send('activity',"Stop request");
                mainWindow.webContents.send('activity',"Closing browser...");
                await browser.close();
                mainWindow.webContents.send('stoped');
                return
            }
            if(areIntervalsTooLow(status.captchaIntervals) || areIntervalsTooLow(status.errorIntervals)){
                mainWindow.webContents.send('activity',"Intervals too low");
                mainWindow.webContents.send('activity',"Closing browser...");
                await browser.close();
                mainWindow.webContents.send('stoped');
                return
            }
            mainWindow.webContents.send('activity',"Waiting for stranger...")
            let inputOrCaptcha = await page.waitForFunction(() => {
                    let element;
                    element = document.querySelector('.chatmsg:not([disabled]');
                    if(!!element) return "input";
                    element = document.querySelector('iframe[src*="api2/anchor"]');
                    if(!!element) return "captcha";         
            }, {timeout: 15000})
            if(inputOrCaptcha._remoteObject.value == "captcha"){
                mainWindow.webContents.send('activity',"Solving captcha...")
                if(status.captchaIntervals.length >= 5){ status.captchaIntervals.shift(); }
                if(status.captchaLastDate == ""){
                    status.captchaIntervals.push(parseFloat(((new Date() - new Date(status.started))/1000/60).toFixed(1)));
                }else{
                    status.captchaIntervals.push(parseFloat(((new Date() - new Date(status.captchaLastDate))/1000/60).toFixed(1)));
                }
                status.captchaLastDate = new Date().toISOString();
                let result = await solve(page,mainWindow);
                if(result === true){
                    mainWindow.webContents.send('activity',"Captcha solved")
                    await page.waitForSelector(".chatmsg:not([disabled]",{timeout: 10000});
                    await page.close();
                    mainWindow.webContents.send('statusUpdate',status);
                    agreementScreen();
                    return
                }else{
                    throw new Error(result);
                }
            }
    
            mainWindow.webContents.send('activity',"Typing message...");
            await page.type(".chatmsg:not([disabled]", msg, {delay: status.delay});
            mainWindow.webContents.send('activity',"Sending message...");
            await page.click("body > div.chatbox3 > div > div > div.controlwrapper > table > tbody > tr > td.sendbthcell > div > button", {delay: status.delay});
            
            try{ 
                await page.waitForResponse((response) => {
                    return response.url().includes('.omegle.com/send');
                }, {timeout: 3000});
                status.totalSent++;
                if(status.lastSent != "" )status.instantAvg.push(parseFloat((60 / ((new Date() - new Date(status.lastSent))/1000)).toFixed(2)));
                if(status.instantAvg.length > 5) status.instantAvg.shift();
                if(status.delay > 10){
                    getArrAvg(status.instantAvg) > targetAvg ? status.delay++ : status.delay--;
                }else{
                    status.delay++
                }
                status.lastSent = new Date().toISOString();
                status.avgPerMinute = parseFloat((status.totalSent / ((new Date(status.lastSent) - new Date(status.started)) / 1000 / 60)).toFixed(2));
                mainWindow.webContents.send('activity',"Message sent")
            }catch{
                mainWindow.webContents.send('activity',"Message not sent, problably stranger disconnected");
                status.notSent++;
            }
            
            mainWindow.webContents.send('activity',"Reconnecting...");
            let textArea = await page.$(".chatmsg:not([disabled]");
            if(textArea != null){
                await page.keyboard.press('Escape');
                await page.keyboard.press('Escape');
                await page.keyboard.press('Escape', {delay: status.delay});
            }else{
                await page.keyboard.press('Escape', {delay: status.delay});
            }
            mainWindow.webContents.send('statusUpdate',status);
            chatScreen();
        }
        catch(err){
            try{ await page.screenshot( { path: "./errors/"+Date.now()+".png", fullPage: true }); }catch{}
            if(status.errorIntervals.length >= 5){ status.errorIntervals.shift(); }
            if(status.errorLastDate == ""){
                status.errorIntervals.push(parseFloat(((new Date() - new Date(status.started))/1000/60).toFixed(1)));
            }else{
                status.errorIntervals.push(parseFloat(((new Date() - new Date(status.errorLastDate))/1000/60).toFixed(1)));
            }
            status.errorLastDate = new Date().toISOString();
            mainWindow.webContents.send('statusUpdate',status);
            mainWindow.webContents.send('activity',"ERROR!!!  SOMETHING WENT WRONG!!! TRYING AGAIN!!!\n"+err);
            page.close();
            agreementScreen();
        }
    }
    
    function getArrAvg(arr){
        let sum = 0;
        for(i of arr){
            sum += i
        }
        return sum/arr.length
    }
    
    function areIntervalsTooLow(intervals){
        let avg = getArrAvg(intervals)
        if(intervals.length >= 3 && avg < 1){
            return true;
        }else{
            return false;
        }
    }

}