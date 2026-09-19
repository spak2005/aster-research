"""Copy a real recording's evidence into a portable, hash-checked public bundle.

This does not run experiments, change outcomes, or invent absent evidence.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from validate_recording import ROOT,validate_recording


def package(source:Path, source_root:Path, destination:Path):
    recording=json.loads(source.read_text())
    validate_recording(recording,public=True)
    run_id=recording['id']
    if not re.fullmatch(r'[A-Za-z0-9_-]+',run_id):raise ValueError('Unsafe recording ID')
    public=ROOT/'public'
    bundle=public/'recordings/artifacts'/run_id
    bundle.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for experiment in recording['experiments']:
        if not re.fullmatch(r'[A-Za-z0-9_-]+',experiment['id']):raise ValueError('Unsafe experiment ID')
        for artifact in experiment['artifacts']:
            original=artifact['path']
            url=urlsplit(original)
            if url.scheme or url.netloc:raise ValueError('Remote evidence must be downloaded and reviewed separately')
            # Live artifacts are rooted in the source checkout. Already exported
            # artifacts are rooted in its public directory.
            rel=Path(original.lstrip('/'))
            if original.startswith('/recordings/'):
                path=(source_root/'public'/rel).resolve()
            elif Path(original).is_absolute():
                path=Path(original).resolve()
            else:path=(source_root/rel).resolve()
            if not path.is_relative_to(source_root.resolve()):raise ValueError('Artifact escapes source checkout')
            if path.suffix not in {'.nc','.json','.jsonl','.csv'}:raise ValueError('Unsupported evidence format')
            content=path.read_bytes()
            digest=hashlib.sha256(content).hexdigest()
            if artifact.get('sha256') and artifact['sha256']!=digest:raise ValueError(f'Evidence changed since execution: {original}')
            target=bundle/experiment['id']/f'{digest[:12]}-{path.name}'
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(content)
            public_path='/'+target.relative_to(public).as_posix()
            artifact.update(path=public_path,sha256=digest)
            manifest.append({'experiment_id':experiment['id'],'label':artifact['label'],'path':public_path,'sha256':digest,'bytes':len(content)})
    index=bundle/'manifest.json'
    index.write_text(json.dumps({'recording_id':run_id,'files':manifest},indent=2)+'\n')
    recording['provenance']['raw_artifact_path']='/'+index.relative_to(public).as_posix()
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(recording,indent=2,allow_nan=False)+'\n')
    validate_recording(recording,public=True)
    print(f'Packaged {run_id}: {len(manifest)} verified evidence files')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=Path)
    p.add_argument('--source-root',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    a=p.parse_args();package(a.source,a.source_root,a.output)
