import pyarrow.parquet as pq
import os
import io

# Collect all parquet files
parquet_files = [
    'data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet',
    'data/raw/svarah/data/train-00001-of-00003-d4f46a21f844aacf.parquet',
    'data/raw/svarah/data/train-00002-of-00003-98d00f23d8e54466.parquet',
]

# Check which files exist
for pf in parquet_files:
    print(f'{pf}: exists={os.path.exists(pf)}')

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
        
        # Convert bytes to WAV file - write raw bytes directly
        if hasattr(bytes_val, 'as_py'):
            wav_bytes = bytes_val.as_py()
        else:
            wav_bytes = bytes_val
            
        if hasattr(wav_bytes, '__len__') and len(wav_bytes) > 0:
            output_path = os.path.join('data/raw/svarah/data', f'{path_val}.wav')
            with open(output_path, 'wb') as f:
                f.write(wav_bytes)
            saved += 1
            if saved % 1000 == 0:
                print(f'  Saved {saved} files...')

print(f'Total saved: {saved}')