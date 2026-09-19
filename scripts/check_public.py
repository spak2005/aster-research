"""Validate the recorded-only site catalog and every linked evidence artifact."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit
from validate_recording import ROOT,validate_recording

PUBLIC=ROOT/'public'

def public_file(value):
    url=urlsplit(value)
    if url.scheme or url.netloc or url.query or url.fragment:
        raise ValueError(f'Expected same-origin artifact path: {value}')
    path=(PUBLIC/value.lstrip('/')).resolve()
    if not path.is_relative_to(PUBLIC.resolve()):
        raise ValueError('Path escapes public directory')
    if not path.is_file():
        raise ValueError(f'Missing public artifact: {value}')
    return path

def main():
    index=json.loads((PUBLIC/'recordings/index.json').read_text())
    ids=set()
    for item in index:
        if item['id'] in ids:raise ValueError('Duplicate catalog ID')
        ids.add(item['id'])
        path=public_file(item['path'])
        recording=validate_recording(json.loads(path.read_text()),public=True)
        if recording['id']!=item['id']:raise ValueError('Catalog ID mismatch')
        if recording['mode']!='recorded':raise ValueError('Public replay must be explicitly recorded')
        for experiment in recording['experiments']:
            if experiment['status']=='completed' and not experiment['artifacts']:
                raise ValueError('Completed experiment missing evidence artifacts')
            for artifact in experiment['artifacts']:
                source=public_file(artifact['path'])
                actual=hashlib.sha256(source.read_bytes()).hexdigest()
                if artifact.get('sha256') and artifact['sha256']!=actual:
                    raise ValueError(f'Artifact hash mismatch: {source}')
        print(f'Public recording and artifacts verified: {item["id"]}')
    if not index:raise ValueError('No genuine public recordings')

if __name__=='__main__':main()
