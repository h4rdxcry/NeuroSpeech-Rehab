import pyarrow.parquet as pq
import os

# Collect parquet files from both possible locations
data_dir = 'data/raw/svarah/data/'
data_subdir = 'data/raw/svarah/data/data/'

parquet_files = [
    os.path.join(data_dir, 'train-00000-of-00003-515ef1a9be6813c7.parquet'),
    os.path.join(data_subdir, 'train-00001-of-00003-d4f46a21f844aacf.parquet'),
    os.path.join(data_subdir, 'train-00002-of-00003-98d00f23d8e54466.parquet'),
]

# Check which files exist
for pf in parquet_files:
    print(f'{os.path.basename(pf)}: exists={os.path.exists(pf)}')

os.makedirs(data_dir, exist_ok=True)
saved = 0
skipped = 0

for pf in parquet_files:
    if not os.path.exists(pf):
        print(f'Skipping missing: {os.path.basename(pf)}')
        skipped += 1
        continue
    print(f'Processing {os.path.basename(pf)}...')
    table = pq.read_table(pf)
    audio_col = table.column('audio')
    num_rows = table.num_rows
    print(f'  {num_rows} rows')
    
    for i in range(num_rows):
        entry = audio_col[i]
        d = dict(entry)
        bytes_val = d['bytes']
        path_val = str(d['path'])  # Convert StringScalar to str
        
        # path_val already ends with .wav, use as-is
        output_path = os.path.join(data_dir, path_val)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write raw WAV bytes
        if hasattr(bytes_val, 'as_py'):
            wav_bytes = bytes_val.as_py()
        else:
            wav_bytes = bytes_val
            
        if hasattr(wav_bytes, '__len__') and len(wav_bytes) > 0:
            with open(output_path, 'wb') as f:
                f.write(wav_bytes)
            saved += 1
            if saved % 1000 == 0:
                print(f'  Saved {saved} files...')

print(f'Total saved: {saved}')
print(f'Skipped (missing parquet): {skipped}')