import os
from huggingface_hub import hf_hub_download

# Download missing parquet files
parquet_files = [
    'data/train-00001-of-00003-d4f46a21f844aacf.parquet',
    'data/train-00002-of-00003-98d00f23d8e54466.parquet',
]

for fname in parquet_files:
    print(f'Downloading {fname}...')
    try:
        hf_hub_download(
            repo_id='Bhargav0044/svarah1',
            filename=fname,
            repo_type='dataset',
            local_dir='data/raw/svarah/data',
        )
        print(f'  Downloaded: {fname}')
    except Exception as e:
        print(f'  Failed: {e}')