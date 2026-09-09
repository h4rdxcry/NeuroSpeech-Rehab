import pyarrow.parquet as pq
import torch
import torchaudio
import os

# Read the first parquet file
table = pq.read_table('data/raw/svarah/data/train-00000-of-00003-515ef1a9be6813c7.parquet')
audio_col = table.column('audio')
num_rows = table.num_rows
print(f'Parquet 0: {num_rows} rows')

# Check first few entries
for i in range(min(3, num_rows)):
    entry = audio_col[i]
    d = dict(entry)
    bytes_val = d['bytes']
    path_val = d['path']
    print(f'  Row {i}: bytes_type={type(bytes_val).__name__}, path={path_val}')
    if hasattr(bytes_val, 'as_py'):
        bytes_py = bytes_val.as_py()
        print(f'    bytes len: {len(bytes_py) if hasattr(bytes_py, "__len__") else "N/A"}')
        if hasattr(bytes_py, '__len__') and len(bytes_py) > 0:
            print(f'    first 20 bytes: {bytes_py[:20]}')

# Read the second parquet file
try:
    table2 = pq.read_table('data/raw/svarah/data/train-00001-of-00003-d4f46a21f844aacf.parquet')
    audio_col2 = table2.column('audio')
    num_rows2 = table2.num_rows
    print(f'Parquet 1: {num_rows2} rows')
    for i in range(min(3, num_rows2)):
        entry = audio_col2[i]
        d = dict(entry)
        bytes_val = d['bytes']
        path_val = d['path']
        print(f'  Row {i}: bytes_type={type(bytes_val).__name__}, path={path_val}')
        if hasattr(bytes_val, 'as_py'):
            bytes_py = bytes_val.as_py()
            print(f'    bytes len: {len(bytes_py) if hasattr(bytes_py, "__len__") else "N/A"}')
except Exception as e:
    print(f'Parquet 1 error: {e}')

# Read the third parquet file
try:
    table3 = pq.read_table('data/raw/svarah/data/train-00002-of-00003-98d00f23d8e54466.parquet')
    audio_col3 = table3.column('audio')
    num_rows3 = table3.num_rows
    print(f'Parquet 2: {num_rows3} rows')
    for i in range(min(3, num_rows3)):
        entry = audio_col3[i]
        d = dict(entry)
        bytes_val = d['bytes']
        path_val = d['path']
        print(f'  Row {i}: bytes_type={type(bytes_val).__name__}, path={path_val}')
        if hasattr(bytes_val, 'as_py'):
            bytes_py = bytes_val.as_py()
            print(f'    bytes len: {len(bytes_py) if hasattr(bytes_py, "__len__") else "N/A"}')
except Exception as e:
    print(f'Parquet 2 error: {e}')