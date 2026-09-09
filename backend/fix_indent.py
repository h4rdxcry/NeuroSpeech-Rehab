with open('tests/test_dataset_splitting.py', 'r') as f:
    content = f.read()

old = '''            })\nassert resp.status_code == 201\n    \n    # Get dataset to check split_definition\n    ds_resp = client.get(f"/api/v1/datasets/{dataset_id}", headers={"Authorization": f"Bearer {token}"})\n    assert ds_resp.status_code == 200\n    ds = ds_resp.json()\n    \n    split_def = ds.get("split_definition", {})\n    assert "original_openslr_train" in split_def\n    assert "original_openslr_test" in split_def\n    assert len(split_def["original_openslr_train"]) > 0\n    assert len(split_def["original_openslr_test"]) > 0\n    assert split_def["split_version"] == "v1"\n    assert split_def["seed"] == 42'''

new = '''            })\n        assert resp.status_code == 201\n        \n        # Get dataset to check split_definition\n        ds_resp = client.get(f"/api/v1/datasets/{dataset_id}", headers={"Authorization": f"Bearer {token}"})\n        assert ds_resp.status_code == 200\n        ds = ds_resp.json()\n        \n        split_def = ds.get("split_definition", {})\n        assert "original_openslr_train" in split_def\n        assert "original_openslr_test" in split_def\n        assert len(split_def["original_openslr_train"]) > 0\n        assert len(split_def["original_openslr_test"]) > 0\n        assert split_def["split_version"] == "v1"\n        assert split_def["seed"] == 42'''

with open('tests/test_dataset_splitting.py', 'r') as f:
    content = f.read()

if old in content:
    content = content.replace(old, new)
    with open('tests/test_dataset_splitting.py', 'w') as f:
        f.write(content)
    print('Fixed')
else:
    print('Pattern not found')