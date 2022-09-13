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
    while(activity.value.length > 1000){
        activity.value = activity.value.slice(100,activity.value.length)
    }
    activity.value += "\n" + lastActivity
    activity.scrollTop = activity.scrollHeight;
}

function updateStatus(status) {
    let statEl = document.getElementsByClassName('status')
    let i = 0;
    for (stat in status) {
        statEl[i].innerHTML = status[stat];
        i++
    }
    statEl[0].innerHTML = new Date(statEl[0].innerHTML).toLocaleString();
    statEl[1].innerHTML = new Date(statEl[1].innerHTML).toLocaleString();
    statEl[8].innerHTML = new Date(statEl[8].innerHTML).toLocaleString();
    statEl[10].innerHTML = new Date(statEl[10].innerHTML).toLocaleString();

    statEl[3].innerHTML = statEl[3].innerHTML.replace(/,/g, '    ');
    statEl[7].innerHTML = statEl[7].innerHTML.replace(/,/g, '    ');
    statEl[9].innerHTML = statEl[9].innerHTML.replace(/,/g, '    ');
}

function startBot() {
    if(!Message.reportValidity()){ return }
    toggleForm();
    window.electronAPI.start({
        msg: Message.value,
        targetAvg: parseInt(Target.value),
        headless: Headless.checked,
        language: Language.value
    })
    working = true;
    submit.style = "background: linear-gradient(180deg, rgba(255, 130, 130, 1) 0%, rgba(255, 0, 0, 1) 100%);";
    submit.value = "Stop";
}

function resquestStop() {
    window.electronAPI.stop();
    submit.style = "background: linear-gradient(180deg, rgba(255, 200, 100, 1) 0%, rgba(0, 0, 0, 1) 100%);";
    submit.value = "Wait";
}

function botstopped(){
    working = false;
    toggleForm();
    submit.style = '';
    submit.value = 'Start'
    new Notification('Omegle-bot', { body: 'Bot stopped: see the activity and status section for more information' })
        .onclick = () => window.electronAPI.maximize();
}

window.electronAPI.readedConfig((ev, args) => {
    args = JSON.parse(args);
    Message.value = args.msg;
    Target.value = args.targetAvg;
    Headless.checked = args.headless;
    Language.value = args.language;
    backdropRefresh();
    targetspan.innerHTML = Target.value;
});

targetspan.innerHTML = Target.value;
backdropRefresh();
let working  = false;

window.electronAPI.stopped(()=>{
    botstopped();
})

window.electronAPI.activity((ev,args)=>{
    newActivity(args);
})

window.electronAPI.statusUpdate((ev,args)=>{
    updateStatus(args);
})