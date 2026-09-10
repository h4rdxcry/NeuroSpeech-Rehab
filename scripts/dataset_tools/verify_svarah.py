from datasets import load_dataset
ds = load_dataset('Bhargav0044/svarah1')
print(f'Dataset splits: {ds.keys()}')
print(f'Train examples: {len(ds["train"])}')
for i in [0, 100, 1000, 5000]:
    example = ds['train'][i]
    print(f'Example {i}: audio_shape={example["audio"]["array"].shape}, text={example["text"][:50]}...')