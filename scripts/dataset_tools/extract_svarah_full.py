import pyarrow.parquet as pq
import torch
import torchaudio
import os

# Collect all parquet files
parquet_files = [
    'data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet',
    'data/raw/svarah/data/train-00001-of-00003-d4f46a21f844aacf.parquet',
    'data/raw/svarah/data/train-00002-of-00003-98d00f23d8e54466.parquet',
]

# Check which files exist
for pf in parquet_files:
    if os.path.exists(pf):
        print(f'Exists: {pf}')
    else:
        print(f'Missing: {pf}')

# Process all parquet files
os.makedirs('data/raw/svarah/data', exist_ok=True)
saved = 0

for pf in parquet_files:
    if not os.path.exists(pf):
        print(f'Skipping missing: {pf}')
        continue
    print(f'Processing {pf}...')
    table = pq.read_table(pf)
    audio_col = table.column('audio')
    num_rows = table.num_rows
    print(f'  {num_rows} rows')
    
    for i in range(num_rows):
        entry = audio_col[i]
        d = dict(entry)
        bytes_val = d['bytes']
        path_val = d['path']
        
        # Convert bytes to wav file
        if hasattr(bytes_val, 'as_py'):
            wav_bytes = bytes_val.as_py()
        else:
            wav_bytes = bytes_val
            
        if hasattr(wav_bytes, '__len__') and len(wav_bytes) > 0:
            # Save as WAV using torchaudio
            # The bytes are already WAV format, so we can use torchaudio.load to read them
            # then torchaudio.save to write them properly
            try:
                import io
                buf = io.BytesIO(wav_bytes)
                waveform, sample_rate = torchaudio.load(buf)
                output_path = os.path.join('data/raw/svarah/data', f'{path_val}.wav')
                torchaudio.save(output_path, waveform, sample_rate=sample_rate)
                saved += 1
                if (saved) % 500 == 0:
                    print(f'  Saved {saved} files...')
            except Exception as e:
                print(f'  Error saving row {i}: {e}')

print(f'Total saved: {saved}')