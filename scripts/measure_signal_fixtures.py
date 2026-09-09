"""Reproducible synthetic signal checks, not hardware or clinical accuracy."""
import json, sys, hashlib
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'backend'))
from app.services.signal_processing import process_biosignal, synchronize
t = np.arange(512)/256
eeg = process_biosignal((20*np.sin(2*np.pi*10*t))[:, None], 256, 'EEG', 'uV', ['Cz'])
t = np.arange(4000)/2000
emg = process_biosignal((30*np.sin(2*np.pi*100*t))[:, None], 2000, 'EMG', 'uV', ['masseter'])
sync = synchronize([{'modality':'EEG','clock_id':'synthetic-clock','timestamps_seconds':[0,.01,.02]}, {'modality':'EMG','clock_id':'synthetic-clock','timestamps_seconds':[.001,.011,.021]}])
source = ROOT/'backend/app/services/signal_processing.py'
report = {'measured_at':datetime.now(timezone.utc).isoformat(), 'population':'synthetic deterministic mathematical signals; no human participants',
          'eeg_input':{'samples':512,'rate_hz':256,'sine_hz':10,'amplitude_uV':20},
          'emg_input':{'samples':4000,'rate_hz':2000,'sine_hz':100,'amplitude_uV':30},
          'eeg':eeg,'emg':emg,'sync':sync,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
(ROOT/'work/verification-20260909/signal-fixtures.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
