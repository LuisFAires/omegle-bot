async function launchBrowser(args, mainWindow){

    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const path = require('path');
    const solve = require(path.join(__dirname, 'puppeteer-recaptcha-solver/index.js'));
    const status = require(path.join(__dirname, 'botstatus.js'));
    const restart = require(path.join(__dirname,'restart.js'));
    puppeteer.use(StealthPlugin());

    //SET STATUS
    status.started = new Date().toISOString();
    status.lastSent = '';
    status.avgPerMinute = NaN;
    status.instantAvg = [];
    status.delay = args.delay;
    status.totalSent = 0;
    status.notSent = 0;
    status.errorIntervals = [];
    status.errorLastDate = '';
    status.captchaIntervals = [];
    status.captchaLastDate = '';
    status.restart = args.restart;
    status.stop = false;
    status.reconnections = 0;

    mainWindow.webContents.send('activity',"Launching browser...");
    let browser = await puppeteer.launch({ headless: args.headless, defaultViewport: null, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials']});
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
            }, args.language);
    
            await page.goto('https://omegle.com');
            let banned = await page.$(".banned");
            if(banned != null){
                mainWindow.webContents.send('activity',"banned IP...");
                if(status.restart == true){
                    await restartAttempt();
                    return
                }else{
                    status.stop = true;
                }
            }
            mainWindow.webContents.send('activity',"Checking agreements...")
            await page.click("#textbtn", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(2) > label > input[type=checkbox]", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(3) > label > input[type=checkbox]", {delay: status.delay});
            await page.click("body > div:nth-child(11) > div > p:nth-child(4) > input[type=button]", {delay: status.delay});
            chatScreen()
        }catch(e){
            await page.close();
            if(status.stop === false){
                agreementScreen();
            }else{
                mainWindow.webContents.send('activity',"Closing browser...");
                await browser.close();
                tray.setImage(path.join(__dirname, 'img/stopped.png'));
                mainWindow.webContents.send('stopped');
            }
        }
    }
    
    async function chatScreen(){
        try{
            if(areIntervalsTooLow(status.captchaIntervals) || areIntervalsTooLow(status.errorIntervals)){
                mainWindow.webContents.send('activity',"Intervals too low");
                if(status.restart === true){
                   await restartAttempt();
                   return
                }else{
                    status.stop = true;
                }
            }
            if(status.stop === true){
                mainWindow.webContents.send('activity',"Closing browser...");
                await browser.close();
                tray.setImage(path.join(__dirname, 'img/stopped.png'));
                mainWindow.webContents.send('stopped');
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
            await page.type(".chatmsg:not([disabled]", args.msg, {delay: status.delay});
            mainWindow.webContents.send('activity',"Sending message...");
            await page.click("body > div.chatbox3 > div > div > div.controlwrapper > table > tbody > tr > td.sendbthcell > div > button", {delay: status.delay});
            
            try{ 
                await page.waitForResponse((response) => {
                    return response.url().includes('.omegle.com/send');
                }, {timeout: 3000});
                status.totalSent++;
                if(status.lastSent != "" )status.instantAvg.push(parseFloat((60 / ((new Date() - new Date(status.lastSent))/1000)).toFixed(2)));
                if(status.instantAvg.length > 5) status.instantAvg.shift();
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
            try{ await page.screenshot( { path: path.join(__dirname, "./errors/"+Date.now()+".png"), fullPage: true }); }catch{}
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
        let avg = getArrAvg(intervals.slice(intervals.length - 4, intervals.length - 1))
        if(intervals.length >= 3 && avg < 1){
            return true;
        }else{
            return false;
        }
    }

    async function restartAttempt(){
        await page.close();
        try{
            mainWindow.webContents.send('activity',"Restarting connection...");
            let initalIP = await getIP();
            let finalIP;
            do{
                await restart();
                finalIP = await getIP();
            }while(finalIP === initalIP || finalIP === false);
            status.reconnections++
            mainWindow.webContents.send('activity',"Connection restarted");
            status.errorIntervals = [];
            status.captchaIntervals = [];
            agreementScreen();
            return
        }catch(err){
            console.log(err);
            mainWindow.webContents.send('activity',"Unable to restart connection...");
            status.stop = true;
            mainWindow.webContents.send('stopped');
        }
    }

    async function getIP(){
        let axios = require("axios");

        try{
            return axios.get("http://ip-api.com/json/?fields=query,status").then((res) => {
                if(res.data.status != "success") {
                    return false
                }else{
                    return res.data.query;
                }
            })
        }catch{
            await new Promise(r => setTimeout(r, 1500));
            return false;
        }
    }
}

module.exports = {
    launchBrowser
}
