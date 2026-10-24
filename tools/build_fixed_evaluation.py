"""Build the frozen human schedule from the unchanged PPO evaluation dataset."""
import argparse,hashlib,json,sys
from pathlib import Path
import numpy as np

def build(rl_project):
    sys.path.insert(0,str(rl_project))
    from alchemy_rl.chemistry import Chemistry,VERTICES,EDGE_INDEX,compile_rules
    from alchemy_rl.env import AlchemyEnv
    source=rl_project/'data/evaluation_chemistries.jsonl'
    rows=[json.loads(line) for line in source.read_text(encoding='utf-8').splitlines() if line.strip()]
    assert len(rows)==6278
    rng=np.random.default_rng(0)
    chosen=[]
    for level in range(4):
        pool=[r for r in rows if r['num_preconditions']==level]
        for index in rng.permutation(len(pool)):
            row=pool[int(index)]
            if chosen and any(row[key]==chosen[-1][key] for key in
                             ('potion_permutation','potion_reflections','stone_reflections')):continue
            if any(row['behavior_sha256']==r['behavior_sha256'] for r in chosen):continue
            chosen.append(row)
            if len(chosen)==(level+1)*5:break
        assert len(chosen)==(level+1)*5
    web_edges=[]
    def vec(n):return tuple(1 if n&(1<<axis) else -1 for axis in range(3))
    for n in range(8):
        for axis in range(3):
            w=n^(1<<axis)
            if n<w:web_edges.append((vec(n),vec(w)))
    colors=('green','red','yellow','orange','teal','pink')
    episodes=[]
    for i,row in enumerate(chosen):
        chemistry=Chemistry.from_record(row)
        values,transitions=compile_rules(chemistry)
        mask=sum(1<<j for j,(a,b) in enumerate(web_edges)
                 if row['graph_edge_mask']&(1<<EDGE_INDEX[frozenset((a,b))]))
        directions={color:{'axis':row['potion_permutation'][j//2],
                     'direction':(1 if j%2==0 else -1)*row['potion_reflections'][row['potion_permutation'][j//2]]}
                    for j,color in enumerate(colors)}
        env=AlchemyEnv();env.reset(chemistry,row['evaluation_episode_seed'])
        visible=env.trial_stones.astype(int).tolist()
        latent=[[[int(VERTICES[sid][axis]*row['stone_reflections'][axis]) for axis in range(3)]
                 for sid in triple] for triple in visible]
        episodes.append({'episode':i+1,'source':row,'chemistry':{
            'graphMask':mask,'constraintCount':row['num_preconditions'],
            'constraints':row['graph_preconditions'],'potionDirections':directions,
            'reflect':row['stone_reflections'],'rotation':0},
            'initialVisibleStateIds':visible,'initialLatentStones':latent,
            'expectedVisibleValues':values.astype(int).tolist(),
            'expectedVisibleTransitions':transitions.astype(int).tolist()})
    schedule={'schemaVersion':1,'selectionSeed':0,'episodesCount':20,'trialsPerEpisode':10,
              'sourceDataset':'evaluation_chemistries.jsonl','sourceDatasetCount':6278,
              'sourceDatasetSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
              'selectionAlgorithm':'numpy.default_rng(0); shuffle each precondition tier; first five satisfying adjacent permutation, potion reflections and stone reflections differences',
              'trialSeedPolicy':'retain each selected evaluation_episode_seed and original uint8 10x3 NumPy draw',
              'episodes':episodes}
    canonical=json.dumps(schedule,sort_keys=True,separators=(',',':'),ensure_ascii=False)
    schedule['scheduleId']='eval20-seed0-'+hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return schedule

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rl-project',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    schedule=build(args.rl_project)
    content='/* Generated frozen evaluation schedule; rebuild with tools/build_fixed_evaluation.py. */\n(function(root){\nconst schedule='+json.dumps(schedule,ensure_ascii=False,separators=(',',':'))+';\nif(typeof module!=="undefined"&&module.exports)module.exports=schedule;\nroot.AlchemyEvaluationSchedule=schedule;\n})(typeof globalThis!=="undefined"?globalThis:this);\n'
    args.output.write_text(content,encoding='utf-8')
    print(json.dumps({'scheduleId':schedule['scheduleId'],'selectedIds':[e['source']['chemistry_id'] for e in schedule['episodes']],
                      'groupCounts':[sum(e['source']['num_preconditions']==n for e in schedule['episodes']) for n in range(4)],
                      'sizeBytes':len(content.encode())}))
