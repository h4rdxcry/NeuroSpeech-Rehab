import sys
sys.path.insert(0, "D:/NeuroSpeech-Rehab/backend")
from app.services.datasets.storage_guard import StorageGuard

guard = StorageGuard()
usage = guard.get_current_data_usage()
print('Current tracked storage:')
for k, v in usage.items():
    print(f'  {k}: {v}')
print()

result = guard.check_acquisition_safety(
    download_bytes=int(1.1 * 1024 * 1024 * 1024),
    extracted_bytes=int(1.1 * 1024 * 1024 * 1024)
)
print(f'Projected peak: {result.projected_peak_gb:.3f} GB')
print(f'Remaining buffer: {result.remaining_buffer_gb:.3f} GB')
print(f'Allowed: {result.allowed}')
print(f'Message: {result.message}')