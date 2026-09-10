import sys
sys.path.insert(0, 'D:/NeuroSpeech-Rehab/backend')
import urllib.request
import json

# Try to access the dataset with anonymouse - check if we can get any file info
url = 'https://huggingface.co/api/datasets/ai4bharat/Svarah'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print('Dataset info: gated =', data.get('gated'), ', private =', data.get('private'))
except Exception as e:
    print(f'Error: {e}')

# Try to access the repo directly
url2 = 'https://huggingface.co/ai4bharat/Svarah/'
req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req2, timeout=30) as resp:
        print(f'Repo page status: {resp.status}')
except Exception as e:
    print(f'Repo page error: {e}')