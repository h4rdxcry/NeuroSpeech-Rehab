# Camera test fixture provenance

`astronaut.png` is the unmodified 512 × 512 NASA photograph distributed as
`skimage.data.astronaut` by scikit-image. It is a software test fixture only: it
is not a patient record, training example, clinical evaluation or evidence of
rehabilitation efficacy. Tests run the actual MediaPipe detector and compute
geometry from its returned landmarks. No landmarks or clinical results are
stored in the fixture.

- Source, pinned release: https://raw.githubusercontent.com/scikit-image/scikit-image/v0.24.0/skimage/data/astronaut.png
- Provenance and public-domain statement: https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut
- SHA-256: `88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5`
- Retrieved: 2026-09-08.

The no-face test generates a separate, explicitly synthetic blank image in
memory. Neither fixture is imported into production or research datasets.

Run from `backend` using the Python 3.11 environment with the project's camera
requirements:

```powershell
.\.venv-ml\Scripts\python.exe -m pip install -r requirements-camera.txt
.\.venv-ml\Scripts\python.exe -m pytest tests/test_camera.py -q
```

The camera verification tests deliberately fail if MediaPipe is unavailable or
incompatible. The application's explicit unavailable response remains useful
for deployments that do not enable camera analysis.
