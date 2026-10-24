"""Reorder the archived balanced20 selection without changing any Episode payload."""
import argparse
import copy
import csv
import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path

BLOCKS = ['1234', '2413', '3142', '4321', '2143']
ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'docs/protocol_archive/oracle_balanced20_grouped'


def load_schedule(path):
    return json.loads(re.search(r'const schedule=(.*);\nif', path.read_text(encoding='utf-8')).group(1))


def build(old):
    tiers = [int(x) - 1 for x in ''.join(BLOCKS)]
    pools = [[i for i, e in enumerate(old['episodes']) if e['source']['num_preconditions'] == t] for t in range(4)]
    assert all(len(p) == 5 for p in pools)
    queues = copy.deepcopy(pools)
    preferred = [queues[t].pop(0) for t in tiers]
    keys = ['potion_permutation', 'potion_reflections', 'stone_reflections']
    compatible = [[all(a['source'][k] != b['source'][k] for k in keys) for b in old['episodes']] for a in old['episodes']]
    # Minimum number of displaced slots relative to stable within-tier interleaving.
    # Ties: preferred item first, then original source order. No randomness.
    for budget in range(21):
        @lru_cache(None)
        def search(pos, used, previous, remaining):
            if pos == 20:
                return ()
            for i in sorted(pools[tiers[pos]], key=lambda x: (x != preferred[pos], x)):
                cost = int(i != preferred[pos])
                if cost > remaining or used >> i & 1 or (previous >= 0 and not compatible[previous][i]):
                    continue
                tail = search(pos + 1, used | 1 << i, i, remaining - cost)
                if tail is not None:
                    return (i,) + tail
            return None
        order = search(0, 0, -1, budget)
        search.cache_clear()
        if order is not None:
            break
    assert order is not None
    new = copy.deepcopy(old)
    new.pop('scheduleId')
    new['ordering'] = {'blocks': BLOCKS, 'labels': {'1': 0, '2': 1, '3': 2, '4': 3},
                       'sourceScheduleId': old['scheduleId'], 'originalEpisodeOrder': [i + 1 for i in order],
                       'algorithm': 'minimum displaced slots from stable tier interleaving; deterministic original-index tie break; adjacent permutation/potion reflections/stone reflections all differ',
                       'displacedSlots': budget}
    new['episodes'] = []
    for pos, i in enumerate(order):
        e = copy.deepcopy(old['episodes'][i])
        e.update(episode=pos + 1, originalEpisode=e['episode'], block=pos // 4 + 1, positionInBlock=pos % 4 + 1)
        new['episodes'].append(e)
    canonical = json.dumps(new, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    new['scheduleId'] = 'eval20-blocks-seed0-' + hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return new


def write(new, output):
    js = '/* Frozen balanced20 selection; ordered by tools/reorder_block_schedule.py. */\n(function(root){\nconst schedule=' + json.dumps(new, ensure_ascii=False, separators=(',', ':')) + ';\nif(typeof module!=="undefined"&&module.exports)module.exports=schedule;\nroot.AlchemyEvaluationSchedule=schedule;\n})(typeof globalThis!=="undefined"?globalThis:this);\n'
    (output / 'evaluation_schedule.js').write_text(js, encoding='utf-8')
    fields = ['episode', 'original_episode', 'block', 'position_in_block', 'chemistry_id', 'preconditions', 'graph_id', 'evaluation_episode_seed', 'potion_permutation', 'potion_reflections', 'stone_reflections'] + [f'oracle_trial_{i}' for i in range(1, 11)]
    with (output / '固定实验场景清单.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for e in new['episodes']:
            s = e['source']
            row = dict(episode=e['episode'], original_episode=e['originalEpisode'], block=e['block'], position_in_block=e['positionInBlock'], chemistry_id=s['chemistry_id'], preconditions=s['num_preconditions'], graph_id=s['graph_id'], evaluation_episode_seed=s['evaluation_episode_seed'])
            row.update({k: json.dumps(s[k]) for k in ['potion_permutation', 'potion_reflections', 'stone_reflections']})
            row.update({f'oracle_trial_{i+1}': v for i, v in enumerate(e['oracleTrialScores'])})
            writer.writerow(row)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ARCHIVE / 'evaluation_schedule.js')
    parser.add_argument('--output', type=Path, default=ROOT)
    args = parser.parse_args()
    result = build(load_schedule(args.source))
    write(result, args.output)
    print(json.dumps({'scheduleId': result['scheduleId'], 'ordering': result['ordering']}, ensure_ascii=False, indent=2))
