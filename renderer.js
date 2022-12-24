function backdropRefresh(){
    if(Message.value.indexOf('\n') === 0) {
        Message.value = Message.value.slice(1, Message.value.length);
    }
    Message.value = Message.value.replace(/\n\n/g, '\n')
    let css = window.getComputedStyle(Message);
    let cssstring = "";
    for (let i = 0; i < css.length; i++) {
        cssstring +=(css[i] +': '+css.getPropertyValue(css[i])+";");
    }
    backdrop.style = cssstring;
    backdrop.style.position = 'absolute';
    backdrop.style.zIndex = '-1'
    backdrop.style.backgroundColor = '#fff';
    backdrop.scrollTop = Message.scrollTop;
    backdrop.innerHTML = "";    
    let colors = ['#ddd', '#eee'];
    let i = 0
    for(let section of Message.value.split("\n")){
        section = section.replace(/</g, '&lt');
        section = section.replace(/>/g, '&gt');
        backdrop.innerHTML += "<span class='backdropSpan' style='background-color: "+colors[i]+";'>"+section+"</span>"
        i < colors.length-1 ? i++ : i = 0
    }
}

function onButtonClick(){
    if(working === false){
        startBot();
    }else{
        resquestStop();
    }
}

function toggleForm() {
    OptionsFieldset.getAttribute('disabled') === null ? OptionsFieldset.setAttribute('disabled', 'disabled') : OptionsFieldset.removeAttribute('disabled')
}

function newActivity(lastActivity) {
    while(activity.value.length > 10000){
        activity.value = activity.value.slice(1000,activity.value.length)
    }
    activity.value += "\n" + lastActivity
    activity.scrollTop = activity.scrollHeight;
}

function updateStatus(status) {
    started.innerHTML = new Date(status.started).toLocaleString();
    lastSent.innerHTML = new Date(status.lastSent).toLocaleString();
    errorLastDate.innerHTML = new Date(status.errorLastDate).toLocaleString();
    captchaLastDate.innerHTML = new Date(status.captchaLastDate).toLocaleString();
    instantAvg.innerHTML = status.instantAvg.toString().replace(/,/g, ' ');
    errorIntervals.innerHTML = status.errorIntervals.toString().replace(/,/g, ' ');
    captchaIntervals.innerHTML = status.captchaIntervals.toString().replace(/,/g, ' ');
    avgPerMinute.innerHTML = status.avgPerMinute;
    reconnections.innerHTML = status.reconnections;
    totalSent.innerHTML = status.totalSent;
    notSent.innerHTML = status.notSent;
}

function startBot() {
    if(!Message.reportValidity()){ return }
    toggleForm();
    window.electronAPI.start({
        msg: Message.value,
        delay: delayinput.value,
        headless: Headless.checked,
        restart: restart.checked,
        language: Language.value
    })
    working = true;
    submit.style = "background: linear-gradient(180deg, rgba(255, 130, 130, 1) 0%, rgba(255, 0, 0, 1) 100%);";
    submit.value = "Stop";
}

function resquestStop() {
    if (window.confirm("Do you really want to stop?")) {
        window.electronAPI.stop();
        submit.style = "background: linear-gradient(180deg, rgba(255, 200, 100, 1) 0%, rgba(0, 0, 0, 1) 100%);";
        submit.value = "Wait";
    }
}

function botstopped(){
    working = false;
    toggleForm();
    submit.style = '';
    submit.value = 'Start'
    new Notification('Omegle-bot', { body: 'Bot stopped: see the activity and status section for more information' })
        .onclick = () => window.electronAPI.maximize();
}

delayspan.innerHTML = delayinput.value;
backdropRefresh();
window.addEventListener('resize', backdropRefresh);
let working  = false;

window.electronAPI.readedConfig((ev, args) => {
    args = JSON.parse(args);
    Message.value = args.msg;
    delayinput.value = args.delay;
    Headless.checked = args.headless;
    restart.checked = args.restart;
    Language.value = args.language;
    backdropRefresh();
    delayspan.innerHTML = delayinput.value;
});

window.electronAPI.stopped(()=>{
    botstopped();
})

window.electronAPI.activity((ev,args)=>{
    newActivity(args);
})

window.electronAPI.statusUpdate((ev,args)=>{
    updateStatus(args);
})