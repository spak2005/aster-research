"""Dependency-free validation of the shared JSON schema and cross-record links."""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def validate_schema(value, schema, path='$'):
    if 'const' in schema and value != schema['const']:
        raise ValueError(f'{path}: expected {schema["const"]!r}')
    if 'enum' in schema and value not in schema['enum']:
        raise ValueError(f'{path}: invalid enum {value!r}')
    kinds = schema.get('type', [])
    if isinstance(kinds, str):
        kinds = [kinds]
    checks = {'object': lambda x:isinstance(x,dict), 'array': lambda x:isinstance(x,list),
              'string': lambda x:isinstance(x,str), 'null': lambda x:x is None,
              'integer':lambda x:isinstance(x,int) and not isinstance(x,bool),
              'number':lambda x:isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)}
    if kinds and not any(checks[k](value) for k in kinds):
        raise ValueError(f'{path}: expected {kinds}')
    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                raise ValueError(f'{path}: missing {key}')
        for key, entry in value.items():
            child = schema.get('properties',{}).get(key, schema.get('additionalProperties',{}))
            if isinstance(child,dict):
                validate_schema(entry, child, f'{path}.{key}')
    if isinstance(value,list):
        if len(value)<schema.get('minItems',0) or len(value)>schema.get('maxItems',math.inf):
            raise ValueError(f'{path}: array length out of bounds')
        for i, entry in enumerate(value):
            validate_schema(entry,schema.get('items',{}),f'{path}[{i}]')
    if isinstance(value,(int,float)) and value < schema.get('minimum',-math.inf):
        raise ValueError(f'{path}: below minimum')

def validate_recording(recording, *, public=False):
    schema=json.loads((ROOT/'contracts/recording.schema.json').read_text())
    validate_schema(recording,schema)
    if public and recording['mode']=='development-fixture':
        raise ValueError('Development fixtures must never be public research')
    for key, id_key in [('experiments','id'),('hypotheses','id'),('events','event_id')]:
        ids=[v[id_key] for v in recording[key]]
        if len(ids)!=len(set(ids)):
            raise ValueError(f'Duplicate {key} identifiers')
    experiments={v['id']:v for v in recording['experiments']}
    hypotheses={v['id']:v for v in recording['hypotheses']}
    if experiments and recording['baseline_id'] not in experiments:
        raise ValueError('Unknown baseline')
    if recording['best_experiment_id'] is not None and recording['best_experiment_id'] not in experiments:
        raise ValueError('Unknown best experiment')
    known_evidence=set(experiments) | {v['event_id'] for v in recording['events']}
    known_evidence.update(a['path'] for e in experiments.values() for a in e['artifacts'])
    for item in [*recording['events'],*recording['hypotheses'],recording['conclusion']]:
        if any(e not in known_evidence for e in item['evidence_ids']):
            raise ValueError('Unknown evidence reference')
    for hyp_id in hypotheses:
        visited=set()
        cursor=hyp_id
        while cursor is not None and cursor in hypotheses:
            if cursor in visited:raise ValueError('Hypothesis ancestry contains a cycle')
            visited.add(cursor)
            cursor=hypotheses[cursor]['parent_id']
    sequences=[v['sequence'] for v in recording['events']]
    if sequences!=sorted(set(sequences)):
        raise ValueError('Event sequences must be strictly increasing')
    for event in recording['events']:
        if event['run_id']!=recording['id']:
            raise ValueError('Event belongs to another run')
        for field, index in [('hypothesis_id',hypotheses),('experiment_id',experiments)]:
            if event.get(field) is not None and event[field] not in index:
                raise ValueError(f'Event references unknown {field}')
    for h in hypotheses.values():
        if h['parent_id'] is not None and h['parent_id'] not in hypotheses:
            raise ValueError('Unknown parent hypothesis')
        if any(e not in experiments for e in h['experiment_ids']):
            raise ValueError('Hypothesis references unknown experiment')
    for experiment in experiments.values():
        previous_time=-math.inf
        for frame in experiment['frames']:
            rho=frame['rho']
            if not rho or any(b<=a for a,b in zip(rho,rho[1:])):
                raise ValueError('Radial grid must be nonempty and strictly increasing')
            if rho[0]<0 or rho[-1]>1.000001:
                raise ValueError('Radial grid outside normalized plasma')
            if frame['time_s']<previous_time:
                raise ValueError('Frame times must be monotonic')
            previous_time=frame['time_s']
            for key in ['electron_temperature_kev','ion_temperature_kev']:
                if len(frame[key])!=len(rho):
                    raise ValueError('Temperature profile and radial grid lengths differ')
                if any(t<0 for t in frame[key]):
                    raise ValueError('Negative temperature')
        if experiment['status']=='completed' and experiment['frames']:
            final=experiment['frames'][-1]
            for metric,field in [('fusion_energy_mj','cumulative_fusion_energy_mj'),('heating_energy_mj','cumulative_heating_energy_mj')]:
                if not math.isclose(experiment['metrics'][metric],final[field],rel_tol=1e-6,abs_tol=1e-6):
                    raise ValueError('Reported metric differs from final recorded cumulative energy')
        if experiment['status']=='completed' and not experiment['frames']:
            raise ValueError('Completed experiment has no measured frames')
    return recording

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('paths',nargs='+',type=Path)
    parser.add_argument('--public',action='store_true')
    args=parser.parse_args()
    for path in args.paths:
        validate_recording(json.loads(path.read_text()),public=args.public)
        print(f'Valid recording: {path}')

if __name__=='__main__':main()
