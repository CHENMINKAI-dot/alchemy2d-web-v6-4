# Oracle-balanced fixed human experiment

Schedule: `eval20-oracle-balanced-seed0-2d7620305076e66b`.
Twenty held-out validation Episodes, five per 0/1/2/3 precondition tier, ten Trials each.
Source dataset: 6278 Chemistries, SHA256 `c2454d09798b81877eb2f0c81d2eb15770517203b0ca1fcb86448a17039d8285`.

The original per-Episode evaluation seeds, uint8 NumPy initial-stone draws and Trial order are retained.
Exact finite-resource dynamic programming supplies each candidate's known-rule maximum score.
Integer feasibility selects five per tier with equal ten-column sums; the shared target is 211 per tier per Trial.
Adjacent Episode potion permutation, potion reflections and stone reflections all differ; behaviors are unique.
Every tier/Trial has oracle scores `[31,45,45,45,45]`, mean 42.2.
An independent simple-path/resource-allocation solver verified all 200 selected Trials.
Initial scores and information-gathering difficulty have not been equated.

The previous runtime is archived at Git commit `2b2f920a1820d31f0a09f7328ae48628dc16f64d`.
Browser backups now use a schedule-specific IndexedDB name; the previous database is retained.
Formal sessions and JSON/CSV exports identify their schedule. Practice remains separate.

Validation: protocol validation checks all 960 transitions and 160 values;
`tests/qa_balanced20_game.cjs` completes all 200 Trials, checks the initial stones and provenance,
refresh restoration, history decision tracking, signed settlement, export, and old-database preservation.
