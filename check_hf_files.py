import sys
sys.path.insert(0, 'D:/NeuroSpeech-Rehab/backend')
import urllib.request
import json

# Try to list files - this may be gated
url = 'https://huggingface.co/api/datasets/ai4bharat/Svarah/files'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print('Files listed successfully')
        print('Number of files:', len(data))
        for f in data[:5]:
            rfilename = f.get('rfilename', 'unknown')
            size = f.get('size', 'unknown')
            print(f'  - {rfilename}: {size} bytes')
except Exception as e:
    print(f'Error listing files: {e}')