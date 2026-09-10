import pyarrow.parquet as pq

table = pq.read_table('data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet')
audio_col = table.column('audio')
first_entry = audio_col[0]
print('Type:', type(first_entry))
print('Schema names:', first_entry.schema.names)
for field_name in first_entry.schema.names:
    value = first_entry[field_name]
    print(f'  {field_name}: type={type(value).__name__}, value={str(value)[:200] if not hasattr(value, "__len__") else f"len={len(value)}"}')