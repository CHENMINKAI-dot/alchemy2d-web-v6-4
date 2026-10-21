/*
 * Alchemy human web experiment - independent deterministic rule engine.
 * Paper basis: Wang et al., NeurIPS 2021, Appendix A.1-A.2.
 * Rule probabilities are uniform over n=0,1,2,3 valid graph constraints,
 * then uniform over distinct graphs with that constraint count.
 * Apache-2.0 authorship notice is NOT implied: this is an independent implementation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AlchemyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COLORS = ['red', 'green', 'yellow', 'orange', 'pink', 'teal'];
  const COLOR_PAIRS = [['red', 'green'], ['yellow', 'orange'], ['pink', 'teal']];
  const VERTICES = Array.from({length: 8}, (_,i)=>i);
  const EDGES = [];
  for (const v of VERTICES) for (let axis=0; axis<3; axis++) {
    const w=v^(1<<axis);
    if (v<w) EDGES.push({from:v,to:w,axis});
  }
  const EDGE_KEYS = EDGES.map(e=>`${e.from}-${e.to}`);
  const CONSTRAINTS = [];
  for (let axis=0;axis<3;axis++) for (let other=0;other<3;other++) {
    if(axis===other) continue;
    for(const value of [-1,1]) CONSTRAINTS.push({axis,other,value});
  }
  function vectorToId(vec) {return (vec[0]===1?1:0) | (vec[1]===1?2:0) | (vec[2]===1?4:0);}
  function idToVector(n) {return [n&1?1:-1,n&2?1:-1,n&4?1:-1];}
  function canonicalEdgeKey(a,b) {return a<b?`${a}-${b}`:`${b}-${a}`;}
  function graphMaskFromConstraints(cs) {
    let mask=0;
    for(let i=0;i<EDGES.length;i++) {
      const edge=EDGES[i];
      let allowed=true;
      for(const condition of cs) {
        if(condition.axis!==edge.axis) continue;
        const bit=(edge.from>>condition.other)&1;
        if((bit===1?1:-1)!==condition.value) {allowed=false;break;}
      }
      if(allowed) mask|=(1<<i);
    }
    return mask;
  }
  function isConnected(mask) {
    const adjacency=Array.from({length:8},()=>[]);
    EDGES.forEach((e,i)=>{if(mask&(1<<i)) {adjacency[e.from].push(e.to);adjacency[e.to].push(e.from);}});
    const visited=new Set([0]);const stack=[0];
    while(stack.length) {
      const v=stack.pop();
      for(const w of adjacency[v]) if(!visited.has(w)) {visited.add(w);stack.push(w);}
    }
    return visited.size===8;
  }
  function enumerateGraphs() {
    const tiers=[[],[],[],[]];
    for(let n=0;n<=3;n++) {
      const found=new Set();
      function choose(start,selected) {
        if(selected.length===n) {
          const mask=graphMaskFromConstraints(selected);
          if(isConnected(mask)&&!found.has(mask)) {
            found.add(mask);
            tiers[n].push({ mask, constraintCount:n, constraints:selected.map(c=>({...c})) });
          }
          return;
        }
        for(let k=start;k<=CONSTRAINTS.length-(n-selected.length);k++) {
          choose(k+1,selected.concat(CONSTRAINTS[k]));
        }
      }
      choose(0,[]);
      tiers[n].sort((a,b)=>a.mask-b.mask);
    }
    return tiers;
  }
  const GRAPH_TIERS=enumerateGraphs();
  const GRAPH_COUNTS=GRAPH_TIERS.map(t=>t.length);
  if(GRAPH_COUNTS.join(',')!=='1,12,48,48') {
    throw new Error(`Graph grammar invalid: ${GRAPH_COUNTS.join(',')}`);
  }
  const ALL_VALID_MASKS=new Set(GRAPH_TIERS.flat().map(x=>x.mask));
  if(ALL_VALID_MASKS.size!==109) throw new Error('Expected 109 valid causal graphs');
  const POSSIBLE_CHEMISTRIES=109*48*8; // human adaptation: 8 reflections, no perceptual rotation
  const ORIGINAL_POSSIBLE_CHEMISTRIES=109*48*32; // reference task, with rotation

  function makeRng(seed) {
    let current=seed>>>0;
    return {
      next() {
        current=(current+0x6D2B79F5)>>>0;
        let t=current;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
      },
      int(n) {return Math.floor(this.next()*n);},
      pick(list) {return list[this.int(list.length)];},
      shuffle(list) {
        const a=[...list];
        for(let i=a.length-1;i>0;i--){const j=this.int(i+1);[a[i],a[j]]=[a[j],a[i]];}
        return a;
      },
      state() {return current>>>0;},
      restore(n) {current=n>>>0;},
    };
  }
  function normalizeSeed(seed) {
    if(Number.isInteger(Number(seed)) && String(seed).trim()!=='') return Number(seed)>>>0;
    if(typeof crypto!=='undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint32Array(1))[0]>>>0;
    }
    return (Date.now()^Math.floor(Math.random()*4294967296))>>>0;
  }
  function sampleChemistry(rng) {
    const tier=rng.int(4);
    const g=rng.pick(GRAPH_TIERS[tier]);
    const axes=rng.shuffle([0,1,2]);
    const potionDirections={};
    COLOR_PAIRS.forEach((pair,index)=>{
      const positive=rng.int(2)===1;
      potionDirections[pair[0]]={axis:axes[index],direction:positive?1:-1};
      potionDirections[pair[1]]={axis:axes[index],direction:positive?-1:1};
    });
    const reflect=[0,0,0].map(()=>rng.int(2)===1?1:-1);
    const rotation=0; // human adaptation: no rotation; reflections remain independently sampled
    return {
      graphMask:g.mask,
      constraintCount:tier,
      constraints:g.constraints.map(c=>({...c})),
      potionDirections,
      reflect,
      rotation,
    };
  }
  // Stable Chemistry identity: graph topology, six potion directions, and all
  // three perceptual reflections. Do not use constraints' array formatting.
  function chemistryFingerprint(chemistry) {
    const c=chemistry;
    return [
      c.graphMask,
      ...COLORS.map(color=>{
        const d=c.potionDirections[color];
        return `${d.axis}:${d.direction}`;
      }),
      c.reflect.join(','),
      c.rotation,
    ].join('|');
  }
  function potionMappingFingerprint(chemistry) {
    return COLORS.map(color=>{
      const d=chemistry.potionDirections[color];
      return `${d.axis}:${d.direction}`;
    }).join('|');
  }
  function chemistryChangeFlags(current,previous) {
    if (!previous) return {graphChanged:true,potionMappingChanged:true,reflectionChanged:true};
    return {
      graphChanged:current.graphMask!==previous.graphMask,
      potionMappingChanged:potionMappingFingerprint(current)!==potionMappingFingerprint(previous),
      reflectionChanged:current.reflect.some((sign,i)=>sign!==previous.reflect[i]),
    };
  }
  // Researcher requested constrained draws: the full Chemistry must never
  // recur within a session; *each* of graph, potion map and reflection must
  // also differ from the immediately preceding Episode. This is rejection
  // sampling from the same base prior, CONDITIONAL on these restrictions.
  // Note: this changes the independent-Episode sampling of the source paper.
  function sampleUniqueEpisodeChemistry(rng,previous=null,previousKeys=[]) {
    const forbidden=new Set(previousKeys);
    if (previous) forbidden.add(chemistryFingerprint(previous));
    if (forbidden.size>=POSSIBLE_CHEMISTRIES) {
      throw new RangeError('Every available Chemistry has been exhausted');
    }
    for(let attempt=0;attempt<100000;attempt++) {
      const candidate=sampleChemistry(rng);
      if (forbidden.has(chemistryFingerprint(candidate))) continue;
      const changed=chemistryChangeFlags(candidate,previous);
      if(!changed.graphChanged||!changed.potionMappingChanged||!changed.reflectionChanged)continue;
      return candidate;
    }
    // Never silently fall back to a repeated configuration.
    throw new Error('Unable to generate a Chemistry satisfying episode nonrepeat constraints');
  }

  function visibleAttributes(state,chemistry) {
    // The visible dimensions are not mixed in this adaptation. Each latent dimension maps
    // to one of two visible attribute levels, with independently sampled signs.
    if(chemistry.rotation!==0) throw new Error('Human adaptation does not allow perceptual rotation');
    const u=state.map((x,i)=>x*chemistry.reflect[i]);
    if(u.some(v=>v!==-1 && v!==1)) throw Error('Invalid latent/perceptual coordinate');
    return {size:u[0],color:u[1],shape:u[2]};
  }
  function reward(stoneState) {
    return stoneState.every(x=>x===1)?15:stoneState.reduce((a,b)=>a+b,0);
  }
  const REWARD_LEVELS=[-3,-1,1,15];
  function transition(currentState,color,chemistry) {
    const d=chemistry.potionDirections[color];
    if(!d) throw new Error(`Unknown potion: ${color}`);
    const before=[...currentState];
    const after=[...before];
    if(before[d.axis]===d.direction) return {before,after,changed:false,reason:'saturated'};
    after[d.axis]=d.direction;
    const from=vectorToId(before),to=vectorToId(after);
    const key=canonicalEdgeKey(from,to);
    const i=EDGE_KEYS.indexOf(key);
    if(i<0) throw Error('Transition is not a cube edge');
    if(!(chemistry.graphMask&(1<<i))) return {before,after:before,changed:false,reason:'blocked'};
    return {before,after,changed:true,reason:'changed'};
  }
  // A six-color TWO-BOTTLE GROUP is an indivisible placement unit.
  // Six groups are shuffled ONCE per participant session and placed in a stable
  // four-column by three-row grid as [A,A,B,B] / [C,C,D,D] / [E,E,F,F].
  // To avoid the prior spatial cue, true opposite-color partners MUST NOT occupy
  // the same row. This condition deliberately changes the layout distribution;
  // we make no claim that bottle placement is uniformly random over 12 slots.
  const OPPOSITE = Object.fromEntries(COLOR_PAIRS.flatMap(([a,b])=>[[a,b],[b,a]]));
  function makePotionLayout(rng) {
    // Rejection sampling is exactly uniform over the allowed six-group orders.
    // The valid set is substantial; the fallback prevents an infinite loop if
    // a test double supplies a degenerate shuffle function.
    for(let attempt=0;attempt<1000;attempt++) {
      const groups=rng.shuffle(COLORS);
      if([0,2,4].some(i=>OPPOSITE[groups[i]]===groups[i+1]))continue;
      const layout=groups.flatMap(color=>[color,color]);
      checkPotionLayout(layout);
      return layout;
    }
    throw new Error('Unable to place six adjacent potion pairs without opposite-colored row neighbors');
  }
  function checkPotionLayout(potionLayout) {
    if(!Array.isArray(potionLayout)||potionLayout.length!==12)
      throw new RangeError('Potion layout must have exactly 12 slots');
    if(potionLayout.some(color=>!COLORS.includes(color)))
      throw new RangeError('Potion layout contains an unknown color');
    for(const color of COLORS)
      if(potionLayout.filter(item=>item===color).length!==2)
        throw new RangeError(`Potion layout must contain exactly two ${color} potions`);
    const groups=[];
    for(let i=0;i<12;i+=2) {
      if(potionLayout[i]!==potionLayout[i+1])
        throw new RangeError('Each same-color bottle pair must occupy adjacent slots');
      groups.push(potionLayout[i]);
    }
    for(let i=0;i<6;i+=2)
      if(OPPOSITE[groups[i]]===groups[i+1])
        throw new RangeError('Opposite-color groups must not occupy the same row');
    if(new Set(groups).size!==6)
      throw new RangeError('Exactly six distinct two-bottle groups are required');
    return true;
  }
  function sampleTrialItems(rng,numStones=3,numPotions=12,potionLayout=null) {
    if(numPotions!==12) throw new RangeError('This version requires exactly 12 potions (two per color).');
    const layout=potionLayout===null?makePotionLayout(rng):potionLayout;
    checkPotionLayout(layout);
    const stones=Array.from({length:numStones},(_,i)=>({id:`S${i+1}`,latent:Array.from({length:3},()=>rng.int(2)?1:-1),submitted:false}));
    const potions=layout.map((color,slot)=>({id:`P${slot+1}`,color,used:false}));
    return {stones,potions};
  }
  return {
    COLORS,COLOR_PAIRS,EDGES,CONSTRAINTS,GRAPH_COUNTS,GRAPH_TIERS,ALL_VALID_MASKS,
    POSSIBLE_CHEMISTRIES,ORIGINAL_POSSIBLE_CHEMISTRIES,REWARD_LEVELS,
    graphMaskFromConstraints,isConnected,enumerateGraphs,vectorToId,idToVector,canonicalEdgeKey,
    makeRng,normalizeSeed,sampleChemistry,chemistryFingerprint,chemistryChangeFlags,
    sampleUniqueEpisodeChemistry,visibleAttributes,reward,transition,makePotionLayout,checkPotionLayout,sampleTrialItems,
  };
});
