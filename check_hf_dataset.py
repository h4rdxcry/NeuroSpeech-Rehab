import sys
sys.path.insert(0, 'D:/NeuroSpeech-Rehab/backend')
import urllib.request
import json

# Try the datasets API endpoint
url = 'https://huggingface.co/api/datasets/ai4bharat/Svarah'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print('Dataset info retrieved')
        print('Card data keys:', list(data.keys())[:10])
        # Try to get model_type or other access info
        if 'private' in data:
            print('Private dataset')
        if 'gated' in str(data).lower():
            print('Gated dataset')
        # Print license if available
        lic = data.get('license', 'N/A')
        print('License:', lic)
except Exception as e:
    print(f'Error: {e}')