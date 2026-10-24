/* Frozen validation scenarios: browser and Node share the same checks. */
(function(root,factory){
  const api=typeof module!=='undefined'&&module.exports
    ?factory(require('./alchemy_core.js'),require('./evaluation_schedule.js'))
    :factory(root.AlchemyCore,root.AlchemyEvaluationSchedule);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AlchemyFixedProtocol=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core,schedule){
  'use strict';
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const colors=['green','red','yellow','orange','teal','pink'];
  const visible=id=>[id&4?1:-1,id&2?1:-1,id&1?1:-1];
  const visibleId=v=>(v[0]===1?4:0)+(v[1]===1?2:0)+(v[2]===1?1:0);
  function requireValid(condition,message){if(!condition)throw Error('Fixed experiment integrity: '+message);}
  function validate(){
    requireValid(Core&&schedule,'missing protocol resource');
    requireValid(schedule.selectionSeed===0&&schedule.episodesCount===20&&schedule.trialsPerEpisode===10,'configuration');
    requireValid(schedule.sourceDatasetCount===6278&&schedule.episodes.length===20,'dataset size');
    const tierOrder=[0,1,2,3,1,3,0,2,2,0,3,1,3,2,1,0,1,0,3,2];
    requireValid(same(schedule.ordering.blocks,['1234','2413','3142','4321','2143']),'block specification');
    const identities=new Set(),behaviors=new Set(),fingerprints=new Set();
    schedule.episodes.forEach((e,i)=>{
      const c=e.chemistry,r=e.source,prior=schedule.episodes[i-1];
      requireValid(e.episode===i+1&&r.num_preconditions===tierOrder[i]&&c.constraintCount===tierOrder[i],'tier order');
      requireValid(e.block===Math.floor(i/4)+1&&e.positionInBlock===i%4+1&&e.originalEpisode===schedule.ordering.originalEpisodeOrder[i],'block provenance');
      requireValid(!identities.has(r.chemistry_id)&&!behaviors.has(r.behavior_sha256)&&!fingerprints.has(Core.chemistryFingerprint(c)),'duplicate Chemistry');
      identities.add(r.chemistry_id);behaviors.add(r.behavior_sha256);fingerprints.add(Core.chemistryFingerprint(c));
      if(prior){
        for(const key of ['potion_permutation','potion_reflections','stone_reflections'])
          requireValid(!same(r[key],prior.source[key]),'adjacent '+key);
        const flags=Core.chemistryChangeFlags(c,prior.chemistry);
        requireValid(flags.potionMappingChanged&&flags.reflectionChanged,'adjacent web rules');
      }
      requireValid(c.rotation===0&&Core.isConnected(c.graphMask),'graph or rotation');
      requireValid(e.initialLatentStones.length===10&&e.initialVisibleStateIds.length===10,'Trial count');
      e.initialLatentStones.forEach((triple,t)=>{
        requireValid(triple.length===3,'stone count');
        triple.forEach((latent,j)=>{
          const a=Core.visibleAttributes(latent,c);
          requireValid(same([a.size,a.color,a.shape],visible(e.initialVisibleStateIds[t][j])),'initial visible stone');
        });
      });
      for(let sid=0;sid<8;sid++){
        const latent=visible(sid).map((x,j)=>x*c.reflect[j]);
        requireValid(Core.reward(latent)===e.expectedVisibleValues[sid],'signed value conversion');
        colors.forEach((color,p)=>{
          const end=Core.transition(latent,color,c).after;
          requireValid(visibleId(end.map((x,j)=>x*c.reflect[j]))===e.expectedVisibleTransitions[sid][p],'edge/potion conversion');
        });
      }
    });
    return true;
  }
  validate();
  function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);}
  freeze(schedule);
  function episode(index){requireValid(Number.isInteger(index)&&index>=0&&index<20,'Episode index');return schedule.episodes[index];}
  function trialItems(index,trial,layout){
    const e=episode(index);requireValid(Number.isInteger(trial)&&trial>=0&&trial<10,'Trial index');
    Core.checkPotionLayout(layout);
    return {stones:e.initialLatentStones[trial].map((latent,i)=>({id:`S${i+1}`,latent:[...latent],submitted:false})),
            potions:layout.map((color,i)=>({id:`P${i+1}`,color,used:false}))};
  }
  function provenance(index){
    const e=episode(index),r=e.source;
    return {scheduleId:schedule.scheduleId,sourceChemistryId:r.chemistry_id,
            evaluationEpisodeSeed:r.evaluation_episode_seed,numPreconditions:r.num_preconditions,
            sourceBehaviorSha256:r.behavior_sha256,originalEpisode:e.originalEpisode,block:e.block,positionInBlock:e.positionInBlock};
  }
  return Object.freeze({schedule,validate,episode,trialItems,provenance});
});
