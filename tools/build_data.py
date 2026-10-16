#!/usr/bin/env python3
"""Build assets/js/data.js (window.RB_DATA) from the paper's LaTeX sources.

Every number shown by the site's charts comes from here. Table rows are parsed from the paper's
tables/*.tex; numbers that only appear in running text or inline tables are listed explicitly and
checked against the source with expect(), so a changed number fails the build instead of drifting.

Usage:  python3 tools/build_data.py --paper ../reprobridge_arxiv
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--paper', default=str(ROOT.parent / 'reprobridge_arxiv'), help='path to the paper LaTeX repo')
ap.add_argument('--out', default=str(ROOT / 'assets/js/data.js'))
args = ap.parse_args()
P = Path(args.paper)
CHECKS = []


def src(rel):
    return (P / rel).read_text(encoding='utf-8')


def norm(s):
    return re.sub(r'\s+', ' ', s)


def expect(rel, snippet):
    """Assert that a LaTeX snippet appears in a source file (whitespace-normalised)."""
    if norm(snippet) not in norm(src(rel)):
        sys.exit(f'FIDELITY CHECK FAILED: {rel} no longer contains: {snippet!r}')
    CHECKS.append(rel)


def rows(rel):
    out = []
    for line in src(rel).splitlines():
        line = line.strip()
        if not line or line.startswith('%'):
            continue
        line = re.sub(r'\\rowcolor\{[^}]*\}', '', line)
        line = re.sub(r'\\\\\s*$', '', line)
        cells = [c.strip() for c in re.split(r'(?<!\\)&', line)]
        out.append(cells)
    return out


def num(s):
    s = re.sub(r'\\textbf\{([^}]*)\}', r'\1', s)
    s = s.replace('{,}', '').replace(',', '').replace('$', '').replace('+', '').strip()
    return float(s)


def pm(cell):
    """'$72.3_{\\pm 1.1}$' or '$\\mathbf{91.6}_{\\pm 3.4}$' -> (72.3, 1.1)"""
    m = re.fullmatch(r'\$(?:\\mathbf\{)?((?:[0-9.]|\{,\})+)\}?_\{\\pm\s*((?:[0-9.]|\{,\})+)\}\$', cell.strip())
    if not m:
        sys.exit(f'cannot parse mean/sd cell {cell!r}')
    return num(m.group(1)), num(m.group(2))


MODELS = [
    {'key': 's46', 'name': 'Sonnet 4.6', 'short': 'Sonnet 4.6'},
    {'key': 's5', 'name': 'Sonnet 5', 'short': 'Sonnet 5'},
    {'key': 'o5', 'name': 'Opus 5', 'short': 'Opus 5'},
    {'key': 'g38', 'name': 'Gemini 3.8 Flash', 'short': 'Gemini 3.8'},
]
NAME2KEY = {'Sonnet 4.6': 's46', 'Sonnet 5': 's5', 'Opus 5': 'o5', 'Gemini 3.8': 'g38', 'Gemini 3.8 Flash': 'g38'}

D = {}
D['meta'] = {
    'title': 'ReproBridge: Building Reproducibility into ML Research Artifacts',
    'authors': [
        {'name': 'Yubo Wang', 'aff': [1, 2]}, {'name': 'Rui Meng', 'aff': [2]}, {'name': 'Jaehyun Nam', 'aff': [2]},
        {'name': 'Tomas Pfister', 'aff': [2]}, {'name': 'Jinsung Yoon', 'aff': [2]},
    ],
    'affiliations': ['University of Waterloo', 'Google'],
}
for a in ['Yubo Wang', 'Rui Meng', 'Jaehyun Nam', 'Tomas Pfister', 'Jinsung Yoon']:
    expect('main.tex', a)
expect('main.tex', r'\affil[1]{University of Waterloo}')
expect('main.tex', r'\affil[2]{Google}')
D['models'] = MODELS

# ---------------------------------------------------------------- main results (tab:main, 3-evaluation means)
main = []
for c in rows('tables/main_efficiency_rows.tex'):
    k = NAME2KEY[c[0]]
    sr, srsd = pm(c[1]); sa, sasd = pm(c[2])
    tr, trsd = pm(c[4]); ta, tasd = pm(c[5])
    ar, arsd = pm(c[7]); aa, aasd = pm(c[8])
    main.append({'model': k,
                 'success': {'raw': sr, 'raw_sd': srsd, 'rra': sa, 'rra_sd': sasd, 'gain': num(c[3]), 'gain_str': c[3]},
                 'tokens_b': {'raw': tr, 'raw_sd': trsd, 'rra': ta, 'rra_sd': tasd, 'red': num(c[6])},
                 'api_usd': {'raw': ar, 'raw_sd': arsd, 'rra': aa, 'rra_sd': aasd, 'red': num(c[9])}})
D['main'] = main
mean = lambda xs: sum(xs) / len(xs)
h = {
    'raw_mean': round(mean([m['success']['raw'] for m in main]), 1),
    'rra_mean': round(mean([m['success']['rra'] for m in main]), 1),
    'api_red_mean': round(mean([m['api_usd']['red'] for m in main]), 1),
    'spread_raw': round(max(m['success']['raw'] for m in main) - min(m['success']['raw'] for m in main), 1),
    'spread_rra': round(max(m['success']['rra'] for m in main) - min(m['success']['rra'] for m in main), 1),
    'gain_min': min(m['success']['gain'] for m in main), 'gain_max': max(m['success']['gain'] for m in main),
    'api_red_min': min(m['api_usd']['red'] for m in main), 'api_red_max': max(m['api_usd']['red'] for m in main),
    'tok_red_min': min(m['tokens_b']['red'] for m in main), 'tok_red_max': max(m['tokens_b']['red'] for m in main),
}
assert (h['raw_mean'], h['rra_mean'], h['api_red_mean'], h['spread_raw'], h['spread_rra']) == (76.4, 92.6, 19.7, 21.6, 3.9), h
expect('sections/0_abstract.tex', 'raise mean reproduction success from 76.4\\% to 92.6\\% and reduce downstream API spending by 19.7\\% on average')
expect('sections/0_abstract.tex', 'narrows from 21.6 to 3.9 percentage points')
expect('sections/1_introduction.tex', 'improve success by 5.5 to 23.2~pp and reduce downstream API spending by 16.8\\% to 23.7\\%')
expect('sections/6_experiments.tex', 'with 6.3\\% to 19.8\\% fewer tokens')
D['headline'] = h

# ---------------------------------------------------------------- robustness (first evaluation)
rob = []
for c in rows('tables/robustness_rows.tex'):
    i, t, w = [int(x) for x in c[4].split('/')]
    rob.append({'model': NAME2KEY[c[0]], 'macro': {'raw': num(c[1]), 'rra': num(c[2]), 'gain': num(c[3]), 'gain_str': c[3], 'improved': i, 'tied': t, 'worse': w},
                'strict80': {'raw': num(c[5]), 'rra': num(c[6]), 'gain': num(c[7]), 'gain_str': c[7]}})
D['robustness'] = rob
D['strata'] = [{'model': NAME2KEY[c[0]], 'cat': int(c[1]), 'raw': num(c[2]), 'rra': num(c[3]), 'gain': num(c[4]), 'gain_str': c[4]}
               for c in rows('tables/strata_rows.tex')]
D['strata_n'] = {'1': 701, '2': 328}
expect('sections/appendix.tex', 'Stable (Cat.~1, $n=701$) and higher-variability (Cat.~2, $n=328$)')

# ---------------------------------------------------------------- audit sensitivity (first evaluation)
aud = []
for c in rows('tables/audit_rows.tex'):
    ci, cm = [int(x) for x in c[2].split('/')]
    li, lm = [int(x) for x in c[4].split('/')]
    aud.append({'model': NAME2KEY[c[0]], 'input': c[1], 'codex': {'invalid': ci, 'matched': cm, 'success': num(c[3])},
                'claude': {'invalid': li, 'matched': lm, 'success': num(c[5])}})
for a in aud:  # Success is 100(matched - invalid)/1,029
    for k in ('codex', 'claude'):
        assert round(100 * (a[k]['matched'] - a[k]['invalid']) / 1029, 1) == a[k]['success'], a
D['audit_sensitivity'] = aud

# ---------------------------------------------------------------- human validation of the Auditors
val = []
for c in rows('tables/audit_validation_rows.tex'):
    val.append({'scope': c[0], 'auditor': c[1], 'flagged': int(c[2]), 'tp': int(c[3]), 'fp': int(c[4]), 'fn': int(c[5]),
                'precision': num(c[6]), 'recall': num(c[7])})
valid = {'Raw': 376, 'RRA': 403, 'All': 779}
invalid = {'Raw': 33, 'RRA': 6, 'All': 39}
for v in val:
    v['tn'] = valid[v['scope']] - v['fp']
    assert v['tp'] + v['fn'] == invalid[v['scope']], v
expect('sections/appendix.tex', 'comprising 376 raw-codebase and 403 refined-artifact outcomes')
expect('sections/appendix.tex', 'It identifies 39 invalid outcomes: 33 with raw code and six with refined artifacts.')
D['audit_validation'] = val
D['human_review'] = {'papers': 8, 'tasks': 409, 'outcomes': 818, 'invalid': 39, 'invalid_raw': 33, 'invalid_rra': 6,
                     'valid': 779, 'false_flags_each': 4, 'false_flag_rate': 0.5, 'codex_misses': 8, 'claude_misses': 15}
expect('sections/6_experiments.tex', 'all 409 selected tasks from eight randomly selected papers under both Raw and RRA conditions, totaling 818 outcomes')
expect('sections/6_experiments.tex', 'Codex achieves 88.6\\% precision and 79.5\\% recall, versus Claude\'s 85.7\\% and 61.5\\%')
expect('sections/6_experiments.tex', 'Each Auditor falsely flags four of 779 valid outcomes (0.5\\%)')
expect('sections/6_experiments.tex', 'Codex misses eight of these outcomes, and Claude misses 15')

# ---------------------------------------------------------------- CORE-Bench Hard (inline table)
for s in ['Raw & 62.2 & 8.43 & 33.0', 'VERITAS & 68.9 & 6.78 & 24.5', '\\textbf{RRA} & \\best{73.3} & \\best{4.34} & \\best{14.4}',
          'Raw & 50.0 & 76.9 & 64.3', 'VERITAS & 61.1 & \\best{84.6} & 64.3', '\\textbf{RRA} & \\best{66.7} & \\best{84.6} & \\best{71.4}',
          'CS (18) & Med. (13) & Soc. (14)', '45 capsules', '79 questions overall', 'Sonnet~4.5 reproduces 45 capsules']:
    expect('sections/6_experiments.tex', s)
D['corebench'] = {
    'capsules': 45, 'questions': 79, 'reproducer': 'Sonnet 4.5', 'constructor': 'Sonnet 5',
    'overall': [{'handoff': 'Raw', 'success': 62.2, 'usd_per_success': 8.43, 'minutes': 33.0},
                {'handoff': 'VERITAS', 'success': 68.9, 'usd_per_success': 6.78, 'minutes': 24.5},
                {'handoff': 'RRA', 'success': 73.3, 'usd_per_success': 4.34, 'minutes': 14.4}],
    'areas': [{'area': 'Computer science', 'short': 'CS', 'n': 18, 'Raw': 50.0, 'VERITAS': 61.1, 'RRA': 66.7},
              {'area': 'Medical science', 'short': 'Med.', 'n': 13, 'Raw': 76.9, 'VERITAS': 84.6, 'RRA': 84.6},
              {'area': 'Social science', 'short': 'Soc.', 'n': 14, 'Raw': 64.3, 'VERITAS': 64.3, 'RRA': 71.4}],
}

# ---------------------------------------------------------------- ablation (inline table, Sonnet 5, 287 tasks, 12 papers)
abl = [('Raw code', 73.9, None, 'handoff'), ('Ordinary outputs', 81.2, None, 'handoff'), ('Full RRA', 93.0, None, 'handoff'),
       ('Refined codebase', 87.8, 5.2, 'removed'), ('Environment setup', 88.5, 4.5, 'removed'),
       ('Reproduction guide', 89.2, 3.8, 'removed'), ('Experiment launchers', 89.9, 3.1, 'removed')]
for label, s, loss, kind in abl:
    if label == 'Full RRA':
        expect('sections/6_experiments.tex', '\\textbf{Full RRA} & \\best{93.0} & ---')
    elif loss is None:
        expect('sections/6_experiments.tex', f'{label} & {s:.1f} & ---')
    else:
        expect('sections/6_experiments.tex', f'\\quad {label} & {s:.1f} & {loss:.1f}')
        assert round(93.0 - s, 1) == loss
expect('sections/6_experiments.tex', 'Sonnet~5, 287 tasks, 12 papers, one evaluation')
D['ablation'] = {'model': 'Sonnet 5', 'tasks': 287, 'papers': 12, 'evaluations': 1,
                 'rows': [{'label': l, 'success': s, 'loss': loss, 'kind': k} for l, s, loss, k in abl],
                 'full_vs_ordinary': 11.8}
expect('sections/6_experiments.tex', 'The complete artifact outperforms ordinary outputs by 11.8~pp')
D['ablation_papers'] = [{'id': int(c[0]), 'name': c[1], 'experiments': int(c[2]), 'tasks': int(c[3]), 'cpu_tasks': int(c[4])}
                        for c in rows('tables/ablation_subset_rows.tex')]
assert sum(p['tasks'] for p in D['ablation_papers']) == 287 and sum(p['experiments'] for p in D['ablation_papers']) == 155

# ---------------------------------------------------------------- transitions and diagnostics (first evaluation)
tr = []
for c in rows('tables/first_evaluation_transition_rows.tex'):
    name = re.sub(r'\\textbf\{([^}]*)\}', r'\1', c[0])
    vals = [int(num(x)) for x in c[1:]]
    tr.append({'model': NAME2KEY.get(name, 'total'), 'raw': vals[0], 'rra': vals[1], 'recoveries': vals[2], 'reversals': vals[3], 'net': vals[4]})
D['transitions'] = tr
D['recoveries_by_raw_outcome'] = [{'key': 'mismatch', 'label': 'Numerical mismatch', 'n': 348},
                                  {'key': 'notrun', 'label': 'Not run (execution/resource barrier)', 'n': 210},
                                  {'key': 'invalid', 'label': 'Audit-invalid numerical match', 'n': 255}]
expect('sections/6_experiments.tex', 'Across paired task--model outcomes, 813 raw failures become successes, against 136 reversals')
expect('sections/6_experiments.tex', 'Recoveries include 348 numerical mismatches, 210 unexecuted tasks due to execution or resource barriers (\\emph{Not run}), and 255 audit-invalid numerical matches')
D['reversals_by_rra_outcome'] = [{'label': c[0], 'n': int(c[1]), 'share': num(c[2])} for c in rows('tables/regression_rows.tex')]
D['reversal_concentration'] = {'AuxiliaryMCMC': 50, 'Manifold-Aware Perturbations': 19, 'LiME': 14, 'ExactFANOVA': 10, 'top4': 93, 'top4_share': 68.4,
                               'aux_lime_share': 47.1}
expect('sections/appendix.tex', 'AuxiliaryMCMC contributes 50, Manifold-Aware Perturbations 19, LiME 14, and ExactFANOVA 10. These four papers account for 93/136 reversals (68.4\\%)')
expect('sections/6_experiments.tex', 'AuxiliaryMCMC and LiME account for 50 and 14 reversals, respectively, or 47.1\\% combined')
diag = []
for c in rows('tables/execution_diagnostics_rows.tex'):
    diag.append({'model': NAME2KEY[c[0]], 'patch_papers_raw': int(c[1]), 'patch_papers_rra': int(c[2]),
                 'first_exec_h_raw': num(c[3]), 'first_exec_h_rra': num(c[4])})
# Median minutes printed in figures/transitions.pdf (right panel); equal to the table's hours x 60.
FIG_MIN = {'s46': (30.0, 16.2), 's5': (54.0, 31.8), 'o5': (32.4, 19.2), 'g38': (43.8, 15.6)}
for d in diag:
    d['first_exec_min_raw'], d['first_exec_min_rra'] = FIG_MIN[d['model']]
    assert round(d['first_exec_h_raw'] * 60, 1) == d['first_exec_min_raw'] and round(d['first_exec_h_rra'] * 60, 1) == d['first_exec_min_rra'], d
D['diagnostics'] = diag
assert sum(d['patch_papers_raw'] for d in diag) == 113 and sum(d['patch_papers_rra'] for d in diag) == 54
expect('sections/6_experiments.tex', 'Model--paper sessions changing code downstream fall from 113/144 to 54/144')
D['attribution'] = [{'label': c[0], 'est': int(c[1]), 'share': num(c[2])} for c in rows('tables/attribution_rows.tex')]
assert sum(a['est'] for a in D['attribution']) == 813
D['attribution_pairs'] = 101
expect('sections/appendix.tex', 'An agent-assisted case review assigns primary explanations across 101 model--paper pairs')

# ---------------------------------------------------------------- cost and reuse
D['cost'] = {'construction_usd': 5026, 'per_paper_usd': 139.61,
             'break_even': [{'model': 's46', 'rounds': 8, 'continuous': 7.70, 'saving_per_round': 653},
                            {'model': 's5', 'rounds': 13, 'continuous': 12.29, 'saving_per_round': 409},
                            {'model': 'o5', 'rounds': 9, 'continuous': 8.17, 'saving_per_round': 615}]}
expect('sections/6_experiments.tex', 'Constructing the 36 artifacts costs \\$5,026 in API usage (\\$139.61 per paper)')
expect('sections/6_experiments.tex', '\\textbf{8, 13, and 9 reuse rounds} for Sonnet~4.6, Sonnet~5, and Opus~5')
expect('sections/6_experiments.tex', 'The corresponding API savings are \\$653, \\$409, and \\$615 per complete reuse round')
expect('sections/appendix.tex', 'The corresponding continuous crossover points are 7.70 rounds for Sonnet~4.6 and 8.17 for Opus~5')
expect('sections/appendix.tex', '12.29 rounds, hence 13 complete rounds to break even')
for b in D['cost']['break_even']:
    m = next(x for x in main if x['model'] == b['model'])
    sav = m['api_usd']['raw'] - m['api_usd']['rra']
    assert round(sav) == b['saving_per_round'] and math.ceil(5026 / sav) == b['rounds'], (b, sav)

# ---------------------------------------------------------------- benchmark construction
cats = [(1, 'Reproduced: stable', 'Compatible reference, low variability', 701, 47.9),
        (2, 'Reproduced: variable', 'Compatible reference, higher variability', 328, 22.4),
        (3, 'Numerical mismatch', 'Executed, but numerically incompatible', 183, 12.5),
        (4, 'Execution blocked', 'Missing artifacts, dependencies, or code defects', 186, 12.7),
        (5, 'Resource/access limit', 'Compute capacity or restricted access', 65, 4.4)]
for c, l, i, n, s in cats:
    expect('sections/4_benchmark.tex', f'{c} & {l} & {i} & {n} & {s}')
D['categories'] = [{'cat': c, 'label': l, 'interpretation': i, 'tasks': n, 'share': s} for c, l, i, n, s in cats]
expect('sections/4_benchmark.tex', 'The sampling manifest starts with 742 ICML 2026 Spotlight papers, identifies 241 with code and non-purely-theoretical content, and randomly samples 50')
expect('sections/4_benchmark.tex', 'Excluding six for artifact or code availability, four for compute requirements, and four for closed-model access yields 36 retained test papers')
expect('sections/4_benchmark.tex', 'The 36 papers yield 1,463 curated tasks from 502 experiments')
expect('sections/4_benchmark.tex', '1,029 tasks (70.3\\%) have numerically compatible reference results and form the downstream evaluation set, spanning 387 experiments')
D['selection'] = {'spotlights': 742, 'eligible': 241, 'sampled': 50, 'retained': 36,
                  'excluded': [{'reason': 'Artifact or code availability', 'n': 6}, {'reason': 'Compute requirements', 'n': 4}, {'reason': 'Closed-model access', 'n': 4}],
                  'tasks_curated': 1463, 'experiments_curated': 502, 'tasks_verified': 1029, 'experiments_verified': 387, 'verified_share': 70.3}
expect('sections/4_benchmark.tex', 'The evaluated set contains 631 full-procedure and 398 evaluation-only tasks (730 GPU, 299 CPU-only)')
expect('sections/4_benchmark.tex', 'The benchmark includes 586 lower-is-better and 443 higher-is-better measurements')
expect('sections/appendix.tex', 'Of the 36 papers, 28 are classified as GPU papers and eight as CPU-only papers')
expect('sections/6_experiments.tex', 'Both raw-code and refined-artifact conditions use a 24-hour wall-clock limit per paper. GPU experiments use eight H100-80GB GPUs.')
D['scope'] = {'full_procedure': 631, 'evaluation_only': 398, 'gpu_tasks': 730, 'cpu_tasks': 299, 'lower_better': 586, 'higher_better': 443,
              'gpu_papers': 28, 'cpu_papers': 8, 'wallclock_hours': 24, 'gpus': 'eight H100-80GB GPUs', 'evaluations': 3}
# Student-t quantiles with 4 degrees of freedom (Equation 1); the paper prints them as approximately 2.78 and 1.53.
T95, T80 = 2.7764451051977987, 1.5332062740589443
expect('sections/appendix.tex', 'The $t$ multipliers for $q=0.95$ and $q=0.80$ are approximately 2.78 and 1.53')
expect('sections/appendix.tex', 'The 1\\% tolerance floor is active on 197 retained tasks')
expect('sections/4_benchmark.tex', 't_{(1+q)/2,4}s_j\\sqrt{1+\\tfrac15},\\;0.01|\\bar{x}_j|')
expect('sections/4_benchmark.tex', 'Stable tasks satisfy $V_j\\le10$')
D['interval'] = {'n_refs': 5, 't': {'0.95': T95, '0.80': T80}, 'inflation': math.sqrt(1 + 1 / 5), 'floor': 0.01,
                 'stable_threshold_V': 10, 'floor_active_tasks': 197, 'zero_target_tasks': 21}
expect('sections/appendix.tex', 'all 21 retained zero-target tasks belong to the higher-variability group')

# ---------------------------------------------------------------- HELIX worked example (appendix)
for s in ['retains a shipped batch size of 32 and learning rate of approximately $6.29\\times10^{-4}$',
          "The guide's ambiguity entry A6 identifies revision \\texttt{9760b347}",
          'as the source for batch size 8 and learning rate $5.75\\times10^{-4}$',
          'The \\texttt{--paper\\_config} launcher makes this choice executable',
          'The recorded MAE changes from 0.15265 to 0.12986 for T004 and from 0.50527 to 0.41160 for T006; the respective compatibility intervals are [0.12524, 0.13448] and [0.38442, 0.43878]']:
    expect('sections/appendix.tex', s)
D['helix'] = {'paper_id': 40, 'model': 'Opus 5', 'metric': 'MAE', 'direction': 'lower is better',
              'raw_config': {'batch_size': '32', 'learning_rate': '≈6.29×10⁻⁴'}, 'rra_config': {'batch_size': '8', 'learning_rate': '5.75×10⁻⁴'},
              'revision': '9760b347', 'guide_entry': 'A6', 'launcher': '--paper_config',
              'tasks': [{'id': 'T004', 'interval': [0.12524, 0.13448], 'raw': 0.15265, 'rra': 0.12986},
                        {'id': 'T006', 'interval': [0.38442, 0.43878], 'raw': 0.50527, 'rra': 0.41160}]}

# ---------------------------------------------------------------- per-paper inventory + coverage taxonomy
meta = json.loads((ROOT / 'tools/paper_meta.json').read_text(encoding='utf-8'))
inv = {}
for c in rows('tables/paper_inventory_author_rows.tex'):
    pid = int(c[0]); n = int(c[2])
    raw, rra = [], []
    for cell in c[3:7]:
        a, b = [int(x) for x in cell.split('/')]
        raw.append(a); rra.append(b)
    inv[pid] = {'cite_key': re.search(r'citep\{([^}]+)\}', c[1]).group(1), 'tasks': n, 'raw': raw, 'rra': rra}
plist = []
for p in meta['papers']:
    r = inv[p['id']]
    assert r['cite_key'] == p['cite_key'], p
    plist.append({'id': p['id'], 'name': p['name'], 'title': p['title'], 'first_author': p['first_author'], 'family': p['family'],
                  'subdomain': p['subdomain'], 'tasks': r['tasks'], 'raw': r['raw'], 'rra': r['rra']})
assert len(plist) == 36 and sum(p['tasks'] for p in plist) == 1029
tot = next(t for t in tr if t['model'] == 'total')
for mi, m in enumerate(MODELS):
    t = next(x for x in tr if x['model'] == m['key'])
    assert sum(p['raw'][mi] for p in plist) == t['raw'] and sum(p['rra'][mi] for p in plist) == t['rra'], m
    rb = next(x for x in rob if x['model'] == m['key'])['macro']
    assert round(mean([100 * p['raw'][mi] / p['tasks'] for p in plist]), 1) == rb['raw']
    assert round(mean([100 * p['rra'][mi] / p['tasks'] for p in plist]), 1) == rb['rra']
    assert sum(p['rra'][mi] > p['raw'][mi] for p in plist) == rb['improved']
    assert sum(p['rra'][mi] == p['raw'][mi] for p in plist) == rb['tied']
    assert sum(p['rra'][mi] < p['raw'][mi] for p in plist) == rb['worse']
BINS = [('dec', 'Decrease', '#D77762'), ('tie', 'Unchanged', '#BFC6CE'), ('b0', '0–10 pp', '#B7DC90'),
        ('b10', '10–25 pp', '#85C788'), ('b25', '25–50 pp', '#3DA869'), ('b50', '>50 pp', '#08764B')]


def gbin(g):
    return 'dec' if g < 0 else 'tie' if g == 0 else 'b0' if g <= 10 else 'b10' if g <= 25 else 'b25' if g <= 50 else 'b50'


counts = {k: 0 for k, _, _ in BINS}
for p in plist:
    for mi in range(4):
        counts[gbin(100 * (p['rra'][mi] - p['raw'][mi]) / p['tasks'])] += 1
assert [counts[k] for k, _, _ in BINS] == [18, 37, 19, 26, 24, 20], counts
D['papers'] = {'basis': 'First evaluation, primary Codex auditing; successful task counts Raw / RRA per model (paper inventory table).',
               'families': meta['families'], 'subdomains': meta['subdomains'], 'list': plist,
               'gain_bins': [{'key': k, 'label': l, 'color': c, 'count': counts[k]} for k, l, c in BINS]}
fam_counts = {}
for c in rows('tables/domain_rows.tex'):
    fam_counts[c[0].replace('\\&', '&')] = int(c[2])
for f in meta['families']:
    assert sum(1 for p in plist if p['family'] == f['key']) == fam_counts[f['label']], f

# ---------------------------------------------------------------- paper-code alignment (separate static analysis)
D['alignment'] = {'findings': 293, 'in_scope': 238, 'tasks': 669, 'high_severity': 73, 'high_tasks': 482, 'high_papers': 25,
                  'absent_implementation': 44, 'paper_silent': 11,
                  'categories': [{'label': c[0], 'findings': int(c[1]), 'papers': int(c[2]), 'tasks': int(c[3])} for c in rows('tables/alignment_category_rows.tex')]}
expect('sections/appendix.tex', 'Among 293 recorded findings, 238 are in scope for contradiction analysis and touch 669 distinct tasks')
expect('sections/appendix.tex', 'High-severity labels occur on 73 findings touching 482 tasks; 25 papers have at least one such finding')
expect('sections/appendix.tex', 'This separates 44 absent-implementation records and 11 paper-silent records from the 238 in-scope findings')
expect('sections/7_discussion.tex', 'records 238 in-scope contradiction findings touching 669 distinct selected tasks')
D['artifact_corpus'] = {'ambiguity_entries': 932, 'launcher_scripts': 482}
expect('sections/appendix.tex', 'Across the 36 packaged repositories, normalized documents contain 932 ambiguity-table entries. The corpus contains 482 launcher scripts')

header = ('// GENERATED by tools/build_data.py from the paper LaTeX sources. Do not edit by hand.\n'
          f'// {len(CHECKS)} source checks passed.\n')
Path(args.out).write_text(header + 'window.RB_DATA = ' + json.dumps(D, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
print(f'wrote {args.out}: {len(CHECKS)} source checks passed')
