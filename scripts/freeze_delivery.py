"""Inventory current source, changes against the frontend backup, and runtime versions."""
import hashlib, importlib.metadata, json, platform, subprocess, zipfile
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/verification-20260909'
roots=['frontend/src','frontend/e2e','backend/app','backend/tests','backend/alembic','ml_training/src','ml_training/tests','ml_training/scripts','scripts','docs']
extensions={'.py','.ts','.tsx','.js','.cjs','.mjs','.css','.html','.json','.md','.ps1','.toml','.ini','.txt','.yaml','.yml'}
files=set()
for root in roots:
    for path in (ROOT/root).rglob('*'):
        if path.is_file() and path.suffix in extensions and '__pycache__' not in path.parts and path.name!='browser-fixture.json':files.add(path)
for directory in ['frontend','backend','ml_training']:
    for path in (ROOT/directory).iterdir():
        if path.is_file() and (path.suffix in extensions or path.name=='.env.example') and not path.name.startswith('test.') and not path.name.endswith('.tsbuildinfo'):files.add(path)
files.add(ROOT/'README.md')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
manifest=[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(files)]
(OUT/'source-manifest.json').write_text(json.dumps({'frozen_at':datetime.now(timezone.utc).isoformat(),'files':manifest},indent=2),encoding='utf-8')
old=json.loads((ROOT/'work/backups/frontend-before-stitch-20260909-051650/manifest.json').read_text(encoding='utf-8-sig'))
old={r['path'].replace('\\','/'):r['sha256'] for r in old}
changes=[]
for r in manifest:
    if r['path'].startswith('frontend/') and old.get(r['path'])!=r['sha256']:
        changes.append({'path':r['path'],'change':'modified' if r['path'] in old else 'added','sha256':r['sha256']})
for name in old:
    if not (ROOT/name).exists():changes.append({'path':name,'change':'removed'})
additional=['backend/app/schemas/dataset.py','backend/tests/test_dataset_registry.py','backend/tests/browser_seed.py','ml_training/src/ml_training/trainer.py','ml_training/train_baseline.py','ml_training/tests/test_evaluation_regression.py','README.md','docs/STITCH_FEATURE_MAP.md','docs/VERIFICATION_REPORT.md','docs/TRACEABILITY_MATRIX.md','docs/PROJECT_ROADMAP.md','docs/LIMITATIONS.md','docs/RESEARCH_METRICS.md','docs/INTEGRATION_REPORT.md','docs/CHANGED_FILES.md']
additional += [str(p.relative_to(ROOT)).replace('\\','/') for p in (ROOT/'scripts').glob('*') if p.name in {'setup_local_access.py','local_checkpoint.py','start-local.ps1','check_live_site.cjs','evaluate_validation.py','measure_signal_fixtures.py','build_research_metrics.py','freeze_delivery.py'}]
for name in additional:
    if (ROOT/name).exists(): changes.append({'path':name,'change':'integration work; no pre-change hash snapshot for this non-frontend file','sha256':sha(ROOT/name)})
(OUT/'changed-files.json').write_text(json.dumps(changes,indent=2),encoding='utf-8')
(ROOT/'docs/CHANGED_FILES.md').write_text('# Integration files changed\n\nFrontend status is compared against the pre-Stitch source/configuration hash manifest. Non-frontend changes are explicitly identified integration work; a Git diff is unavailable. Generated evidence is under work/verification-20260909.\n\n'+ '\n'.join('- '+r['path']+' — '+r['change'] for r in changes)+'\n',encoding='utf-8')
environment={'recorded_at':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'platform':platform.platform(),'python_packages':dict(sorted((d.metadata['Name'],d.version) for d in importlib.metadata.distributions() if d.metadata['Name']))}
for command in ['node','npm']:
    result=subprocess.run([command+('.cmd' if command=='npm' else ''),'--version'],capture_output=True,text=True)
    environment[command]=result.stdout.strip()
(OUT/'environment.json').write_text(json.dumps(environment,indent=2),encoding='utf-8')
print(json.dumps({'source_files':len(manifest),'changed_files':len(changes),'node':environment['node'],'npm':environment['npm']}))
