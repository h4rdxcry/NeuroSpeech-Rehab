"""Validation-only audit of the deployed Tamil ASR checkpoint. Never opens final-test audio.
Selects two eligible utterances per validation participant by a fixed SHA-256 ordering.
Creates immutable run artifacts; does not retrain, tune, register predictions or mutate the DB.
"""
import os, sys, json, hashlib, time, platform
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
import numpy as np
import soundfile as sf
import torch
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'backend'))
sys.path.insert(0, str(ROOT/'ml_training'/'src'))
from app.services.asr import TamilASRInference
from ml_training.metrics import _levenshtein_distance

DATASET = 'ad5e2662-430d-4675-b72d-dad812fabbc1'
SAMPLES_PER_SPEAKER = 2
SEED = 42
BOOTSTRAPS = 2000

def main():
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = ROOT/'work'/'verification-20260909'/('asr-validation-'+stamp)
    output.mkdir(parents=True, exist_ok=False)
    url = make_url(os.environ['DATABASE_URL'])
    if url.host not in {'127.0.0.1','localhost'}:
        raise RuntimeError('This audit is scoped to the local project database')
    engine = create_engine(url.set(drivername='postgresql+psycopg2'))
    with engine.connect() as db:
        split_stats = [dict(r) for r in db.execute(text("""
            SELECT ds.split_type, count(DISTINCT ds.participant_id) participants,
              count(DISTINCT r.id) recordings, bool_and(ds.is_locked) all_locked
            FROM dataset_splits ds
            LEFT JOIN research_participants p ON p.pseudonym_id=ds.participant_id
            LEFT JOIN sessions s ON s.participant_id=p.id
            LEFT JOIN recordings r ON r.session_id=s.id AND r.source_dataset_id=ds.dataset_id
            WHERE ds.dataset_id=:dataset GROUP BY ds.split_type
        """), {'dataset':DATASET}).mappings()]
        leakage = db.execute(text("""SELECT count(*) FROM (
            SELECT participant_id FROM dataset_splits WHERE dataset_id=:dataset
            GROUP BY participant_id HAVING count(DISTINCT split_type)>1) x"""), {'dataset':DATASET}).scalar()
        if leakage: raise RuntimeError('Participant leakage detected')
        rows = [dict(r) for r in db.execute(text("""
            SELECT r.id::text recording_id, p.pseudonym_id participant, r.file_path,
                   d.bids_root, r.duration_seconds duration, a.label reference
            FROM recordings r JOIN sessions s ON s.id=r.session_id
            JOIN research_participants p ON p.id=s.participant_id
            JOIN dataset_splits ds ON ds.participant_id=p.pseudonym_id AND ds.dataset_id=r.source_dataset_id
            JOIN datasets d ON d.id=r.source_dataset_id
            JOIN annotations a ON a.recording_id=r.id AND a.annotation_type='TRANSCRIPT' AND a.is_ground_truth=true
            WHERE ds.split_type='validation' AND ds.final_test_flag=false AND ds.is_locked=false
              AND r.source_dataset_id=:dataset
            ORDER BY p.pseudonym_id,r.id
        """), {'dataset':DATASET}).mappings()]
    engine.dispose()
    candidates = defaultdict(list)
    excluded = []
    for row in rows:
        path = (Path(row['bids_root'])/row['file_path']) if row['bids_root'] else Path(row['file_path'])
        if 'test' in [part.lower() for part in path.parts]:
            excluded.append({'id':row['recording_id'],'reason':'physical test path excluded'}); continue
        if not path.is_file():
            excluded.append({'id':row['recording_id'],'reason':'file absent'}); continue
        if not row['reference'] or not row['reference'].strip():
            excluded.append({'id':row['recording_id'],'reason':'reference absent'}); continue
        info = sf.info(path)
        if info.samplerate != 16000 or info.channels != 1 or not 0 < info.duration <= 12:
            excluded.append({'id':row['recording_id'],'reason':'outside deployed 16kHz mono <=12-second contract'}); continue
        row['duration'] = info.duration
        row['audio_path']=str(path.resolve())
        row['reference']=row['reference'].strip()
        candidates[row['participant']].append(row)
    chosen=[]
    for speaker in sorted(candidates):
        ranked=sorted(candidates[speaker],key=lambda r:hashlib.sha256((str(SEED)+':'+r['recording_id']).encode()).hexdigest())
        chosen.extend(ranked[:SAMPLES_PER_SPEAKER])
    if not chosen: raise RuntimeError('No eligible validation recordings')
    manifest=json.dumps(chosen,ensure_ascii=False,sort_keys=True)
    (output/'manifest.json').write_text(manifest,encoding='utf-8')
    model=TamilASRInference()
    model._ensure_loaded()
    device='cuda' if torch.cuda.is_available() else 'cpu'
    model._model.to(device)
    model._model.eval()
    if device=='cuda': torch.cuda.reset_peak_memory_stats()
    records=[]
    started=time.perf_counter()
    with (output/'predictions.jsonl').open('w',encoding='utf-8') as log:
        for i,row in enumerate(chosen):
            path=Path(row['audio_path'])
            waveform,rate=sf.read(path,dtype='float32')
            if rate!=16000 or waveform.ndim!=1 or len(waveform)>192000:
                raise RuntimeError('Audio differs from 16kHz mono <=12-second selection: '+str(path))
            values=model._processor(waveform,sampling_rate=16000,return_tensors='pt').input_values.to(device)
            with torch.inference_mode():
                logits=model._model(values).logits
                prediction=model._decode_vocab(torch.argmax(logits,dim=-1)[0].tolist())
            ref=row['reference']
            record={**row,'prediction':prediction,'audio_sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest(),
                    'character_edits':_levenshtein_distance(prediction,ref),'reference_characters':len(ref),
                    'word_edits':_levenshtein_distance(prediction.split(),ref.split()),'reference_words':len(ref.split()),
                    'samples':len(waveform)}
            records.append(record); log.write(json.dumps(record,ensure_ascii=False)+'\n'); log.flush()
            if (i+1)%25==0: print(f'Evaluated {i+1}/{len(chosen)} validation utterances',flush=True)
    if device=='cuda': torch.cuda.synchronize()
    elapsed=time.perf_counter()-started
    counts=np.array([[r['character_edits'],r['reference_characters'],r['word_edits'],r['reference_words']] for r in records])
    totals=counts.sum(0)
    groups=np.array([counts[[i for i,r in enumerate(records) if r['participant']==speaker]].sum(0) for speaker in sorted(candidates) if any(r['participant']==speaker for r in records)])
    rng=np.random.default_rng(SEED)
    resampled=groups[rng.integers(0,len(groups),size=(BOOTSTRAPS,len(groups)))].sum(1)
    cis=np.quantile(np.column_stack([resampled[:,0]/resampled[:,1],resampled[:,2]/resampled[:,3]]),[.025,.975],axis=0)
    checkpoint=Path(model.checkpoint_path)
    report={'run_id':stamp,'started_at':stamp,'completed_at':datetime.now(timezone.utc).isoformat(),
        'method':'deployed inference preprocessing, greedy CTC, original transcript, Unicode codepoint CER incl spaces, whitespace-token WER; no text normalization; one utterance per inference',
        'split':'validation','selection':f'SHA256({SEED}:recording_id), first {SAMPLES_PER_SPEAKER} eligible utterances per participant; <=12s; no physical test paths',
        'dataset_id':DATASET,'split_metadata':split_stats,'participant_leakage_count':int(leakage),
        'queried_validation_rows':len(rows),'eligible_validation_rows':sum(len(v) for v in candidates.values()),'excluded_before_selection':excluded,'sample_count':len(records),'participant_count':len(groups),
        'cer':float(totals[0]/totals[1]),'wer':float(totals[2]/totals[3]),'character_edits':int(totals[0]),'reference_characters':int(totals[1]),'word_edits':int(totals[2]),'reference_words':int(totals[3]),
        'cer_ci95':cis[:,0].tolist(),'wer_ci95':cis[:,1].tolist(),'bootstrap_unit':'participant','bootstrap_samples':BOOTSTRAPS,'seed':SEED,
        'model_name':model._config.get('model_name'),'checkpoint':str(checkpoint),'checkpoint_sha256':hashlib.file_digest(checkpoint.open('rb'),'sha256').hexdigest(),
        'manifest_sha256':hashlib.sha256(manifest.encode()).hexdigest(),'script_sha256':hashlib.file_digest(Path(__file__).open('rb'),'sha256').hexdigest(),
        'device':device,'gpu':torch.cuda.get_device_name() if device=='cuda' else None,'torch':torch.__version__,'python':platform.python_version(),
        'evaluation_wall_seconds':elapsed,'peak_allocated_gpu_mib':torch.cuda.max_memory_allocated()/1024**2 if device=='cuda' else None,
        'audio_seconds':sum(r['samples']/16000 for r in records),'empty_predictions':sum(not r['prediction'] for r in records),
        'limitations':['Fixed small validation subset, selected without model outputs; not a full-validation or locked-test estimate.',
        'General Tamil speech, not dysarthric clinical population. Checkpoint was selected on validation historically.',
        'Legacy training metrics used CTC-collapsed references and an all-zero mask; those values are not directly comparable.',
        'GPU execution of the deployed CPU inference pipeline; numeric device differences are possible.',
        'Timing includes file reads, inference, decoding, distance calculation and artifact writes; not API latency.']}
    (output/'metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':main()
