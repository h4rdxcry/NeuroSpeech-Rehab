import pyarrow.parquet as pq

# Read the parquet file
table = pq.read_table('data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet')
audio_col = table.column('audio')
first_entry = audio_col[0]
print('First entry type:', type(first_entry))
print('First entry keys:', first_entry.keys() if isinstance(first_entry, dict) else 'N/A')
if isinstance(first_entry, dict):
    for k, v in first_entry.items():
        if isinstance(v, bytes):
            print(f'  {k}: bytes len={len(v)}')
        else:
            print(f'  {k}: type={type(v).__name__}, value={str(v)[:200]}')