const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const solve = require('./solver.js');
puppeteer.use(StealthPlugin());
const { app, BrowserWindow } = require('electron')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 950,
        height: 710,
        resizable: false
    })
    win.loadFile('index.html')
    win.setMenu(null)
    win.webContents.openDevTools()
}

app.whenReady().then(() => {
createWindow()

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit()
})



const status = {
    started: new Date().toISOString(),
    lastSent: "",
    avgPerMinute: NaN,
    instantAvg: [],
    delay: 20,
    totalSent: 0,
    notSent: 0,
    errorIntervals: [],
    errorLastDate: '',
    captchaIntervals: [],
    captchaLastDate: ''
};

var msg = "Some string for testing purposes";
var targetAvg = 25;
var headless = true;
var language = "pt-BR";

var browser;
var page;

async function launchBrowser(){
    console.log("Launching browser...");
    browser = await puppeteer.launch({ headless: headless, defaultViewport: null, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials']});
    agreementScreen();
}

async function agreementScreen(){
    try{
        console.log("Loading page...");
        page = await browser.newPage();
        let client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "language", {
                get: function() {
                    return "pt-BR";
                }
            });
        });

        await page.goto('https://omegle.com');
        console.log("Checking agreements...")
        await page.click("#textbtn", {delay: status.delay});
        await page.click("body > div:nth-child(11) > div > p:nth-child(2) > label > input[type=checkbox]", {delay: status.delay});
        await page.click("body > div:nth-child(11) > div > p:nth-child(3) > label > input[type=checkbox]", {delay: status.delay});
        await page.click("body > div:nth-child(11) > div > p:nth-child(4) > input[type=button]", {delay: status.delay});
        chatScreen()
    }catch(e){
        page.close();
        agreementScreen();
    }
}

async function chatScreen(){
    try{
        if(areIntervalsTooLow(status.captchaIntervals) || areIntervalsTooLow(status.errorIntervals)){
            throw new Error("Interval too low");
        }
        console.log("Waiting for stranger...")
        let inputOrCaptcha = await page.waitForFunction(() => {
                let element;
                element = document.querySelector('.chatmsg:not([disabled]');
                if(!!element) return "input";
                element = document.querySelector('iframe[src*="api2/anchor"]');
                if(!!element) return "captcha";         
        }, {timeout: 15000})
        if(inputOrCaptcha._remoteObject.value == "captcha"){
            console.log("Solving captcha...")
            if(status.captchaIntervals.length >= 5){ status.captchaIntervals.shift(); }
            if(status.captchaLastDate == ""){
                status.captchaIntervals.push(parseFloat(((new Date() - new Date(status.started))/1000/60).toFixed(1)));
            }else{
                status.captchaIntervals.push(parseFloat(((new Date() - new Date(status.captchaLastDate))/1000/60).toFixed(1)));
            }
            status.captchaLastDate = new Date().toISOString();
            let result = await solve(page);
            if(result === true){
                console.log("Captcha solved")
                await page.waitForSelector(".chatmsg:not([disabled]",{timeout: 10000});
                await page.close();
                console.table(status);
                agreementScreen();
                return
            }else{
                throw new Error(result);
            }
        }

        console.log("Typing message...");
        await page.type(".chatmsg:not([disabled]", msg, {delay: status.delay});
        console.log("Sending message...");
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
            console.log("Message sent")
        }catch{
            console.log("Message not sent, problably stranger disconnected");
            status.notSent++;
        }
        
        console.log("Reconnecting...");
        let textArea = await page.$(".chatmsg:not([disabled]");
        if(textArea != null){
            await page.keyboard.press('Escape'/*, {delay: status.delay}*/);
            await page.keyboard.press('Escape'/*, {delay: status.delay}*/);
            await page.keyboard.press('Escape', {delay: status.delay});
        }else{
            await page.keyboard.press('Escape', {delay: status.delay});
        }
        console.table(status);
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
        if(areIntervalsTooLow(status.captchaIntervals) || areIntervalsTooLow(status.errorIntervals)){
            console.log("\nERROR!!!  SOMETHING WENT WRONG!!!\n"+err+"\n");
            await browser.close();
        }else{
            console.log("\nERROR!!!  SOMETHING WENT WRONG!!! TRYING AGAIN!!!\n"+err+"\n");
            page.close()
            agreementScreen();
        }
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
    let sum = 0
    for(interval of intervals){
        sum += interval;
    }
    let avg = sum / intervals.length;
    if(intervals.length >= 3 && avg < 1){
        return true;
    }else{
        return false;
    }
}