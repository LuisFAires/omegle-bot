targetspan.innerHTML = Target.value;

/*
let infos = document.getElementsByClassName('status');
for (info of infos) {
    info.innerHTML = "[00.00, 00.00, 00.00, 00.00, 00.00]";
    //info.innerHTML = "2011-10-05T14:48:00.000Z";
    activity.value += "\nsomething\nsomething else\nMessage not sent, problably stranger disconnected\nmore";
}*/

activity.scrollTop = activity.scrollHeight;

let working = false;

function onButtonClick(){
    if(working === false){
        startBot();
    }else{
        waitForStop();
    }
}

function toggleForm() {
    OptionsFieldset.getAttribute('disabled') === null ? OptionsFieldset.setAttribute('disabled', 'disabled') : OptionsFieldset.removeAttribute('disabled')
}

function newActivity(lastActivity) {
    //LIMPAR
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

function waitForStop() {
    window.electronAPI.stop();
    submit.style = "background: linear-gradient(180deg, rgba(255, 200, 100, 1) 0%, rgba(0, 0, 0, 1) 100%);";
    submit.value = "Wait";
}

function botStoped(){
    working = false;
    toggleForm();
    submit.style = '';
    submit.value = 'Start'
}

window.electronAPI.stoped((ev,args)=>{
    botStoped();
    new Notification('Omegle-bot', { body: 'Bot stoped: see the activity and status section for more information' })
})

window.electronAPI.activity((ev,args)=>{
    newActivity(args);
})

window.electronAPI.statusUpdate((ev,args)=>{
    updateStatus(args);
})