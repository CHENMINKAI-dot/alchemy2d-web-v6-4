/* IndexedDB incremental journal for 200-Trial sessions. No remote writes. */
(()=>{
 'use strict';
 const NAME='alchemy_human_experiment_v6_6_fixed_eval20_'+window.AlchemyEvaluationSchedule.scheduleId;
 let chain=Promise.resolve(),queued={sessionId:null,events:0,trials:0,episodes:0};
 const ready=new Promise((resolve,reject)=>{
  const request=indexedDB.open(NAME,1);
  request.onupgradeneeded=()=>{for(const name of ['session','events','trials','episodes'])request.result.createObjectStore(name);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
 // Handled again by each public operation; opening a failed database must not
 // create an unhandled rejection before the participant starts.
 ready.catch(()=>{});
 const transactionDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Local backup transaction aborted'));tx.onerror=()=>{};});
 const result=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 function save(snapshot){
  const {events,trials,episodes,...state}=snapshot;
  if(queued.sessionId!==snapshot.sessionId)queued={sessionId:snapshot.sessionId,events:0,trials:0,episodes:0};
  const offsets={...queued},data={events:events.slice(queued.events),trials:trials.slice(queued.trials),episodes:episodes.slice(queued.episodes)};
  const frozenState=structuredClone(state);
  queued={sessionId:snapshot.sessionId,events:events.length,trials:trials.length,episodes:episodes.length};
  const task=chain.catch(()=>{}).then(async()=>{
   const db=await ready,tx=db.transaction(['session','events','trials','episodes'],'readwrite');
   tx.objectStore('session').put(frozenState,'active');
   for(const name of ['events','trials','episodes'])data[name].forEach((value,i)=>tx.objectStore(name).put(value,[snapshot.sessionId,offsets[name]+i]));
   await transactionDone(tx);
  });
  chain=task.catch(error=>{queued={sessionId:null,events:0,trials:0,episodes:0};throw error;});
  chain.catch(()=>{});
  return task;
 }
 async function load(){
  await chain.catch(()=>{});
  const db=await ready;
  const tx=db.transaction('session','readonly');
  const state=await result(tx.objectStore('session').get('active'));
  if(!state)return null;
  const logs=db.transaction(['events','trials','episodes'],'readonly');
  const range=IDBKeyRange.bound([state.sessionId,0],[state.sessionId,Number.MAX_SAFE_INTEGER]);
  const arrays=await Promise.all(['events','trials','episodes'].map(name=>result(logs.objectStore(name).getAll(range))));
  const snapshot={...state,events:arrays[0],trials:arrays[1],episodes:arrays[2]};
  queued={sessionId:state.sessionId,events:arrays[0].length,trials:arrays[1].length,episodes:arrays[2].length};
  return snapshot;
 }
 function clear(){
  const task=chain.catch(()=>{}).then(async()=>{
   const db=await ready,tx=db.transaction(['session','events','trials','episodes'],'readwrite');
   for(const name of ['session','events','trials','episodes'])tx.objectStore(name).clear();
   await transactionDone(tx);
  });
  queued={sessionId:null,events:0,trials:0,episodes:0};chain=task;chain.catch(()=>{});return task;
 }
 window.AlchemySessionStore=Object.freeze({save,load,clear,flush:()=>chain});
})();
