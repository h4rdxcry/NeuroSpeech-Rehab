from huggingface_hub import list_repo_files
import os

# List files in the dataset repo
files = list_repo_files(repo_id='Bhargav0044/svarah1', repo_type='dataset')
print('All files in repo:')
for f in sorted(files):
    print(f'  {f}')