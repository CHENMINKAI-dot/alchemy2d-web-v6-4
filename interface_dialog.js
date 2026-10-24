/* App-owned notices use the same atlas panels as the experiment. */
(()=>{
 'use strict';
 let queue=Promise.resolve();
 function ask(message,{title='实验提示',confirmText='继续',cancelText='返回',cancel=true}={}){
  const task=queue.then(async()=>{
   if(window.alchemyResourcesReady)await window.alchemyResourcesReady;
   return new Promise(resolve=>{
    const dialog=document.getElementById('noticeDialog');
    const yes=document.getElementById('noticeConfirmBtn'),no=document.getElementById('noticeCancelBtn');
    document.getElementById('noticeTitle').textContent=title;
    document.getElementById('noticeMessage').textContent=message;
    yes.textContent=confirmText;no.textContent=cancelText;no.classList.toggle('hidden',!cancel);
    let finished=false;
    const finish=value=>{
     if(finished)return;finished=true;dialog.close();
     yes.removeEventListener('click',accept);no.removeEventListener('click',decline);dialog.removeEventListener('cancel',escape);
     resolve(value);
    };
    const accept=()=>finish(true),decline=()=>finish(false),escape=e=>{e.preventDefault();finish(!cancel);};
    yes.addEventListener('click',accept);no.addEventListener('click',decline);dialog.addEventListener('cancel',escape);
    dialog.showModal();yes.focus();
   });
  });
  queue=task.catch(()=>{});return task;
 }
 window.AlchemyInterface=Object.freeze({ask,tell:(message,options={})=>ask(message,{...options,cancel:false})});
})();
