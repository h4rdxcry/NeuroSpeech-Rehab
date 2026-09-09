import pyarrow.parquet as pq

table = pq.read_table('data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet')
audio_col = table.column('audio')
first_entry = audio_col[0]
print('Type:', type(first_entry))
# Try to convert to dict
d = dict(first_entry)
print('As dict keys:', d.keys())
for k, v in d.items():
    print(f'  {k}: type={type(v).__name__}, value_len={len(v) if hasattr(v, "__len__") else "N/A"}')
    if hasattr(v, '__len__') and len(v) > 0:
        print(f'  first 10 bytes: {v[:10]}')