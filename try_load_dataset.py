import sys
sys.path.insert(0, 'D:/NeuroSpeech-Rehab/backend')
from datasets import load_dataset

try:
    dataset = load_dataset("ai4bharat/Svarah", split="test")
    print("Dataset loaded successfully")
    print("Number of samples:", len(dataset))
    print("Sample:", dataset[0] if len(dataset) > 0 else "N/A")
except Exception as e:
    print(f"Error loading dataset: {type(e).__name__}: {e}")