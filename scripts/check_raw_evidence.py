"""Independently compare exported replay values with their TORAX NetCDF source."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import xarray as xr


def check(recording_path:Path,source_root:Path):
    recording=json.loads(recording_path.read_text())
    count=0
    for experiment in recording['experiments']:
        if experiment['status']!='completed':continue
        artifacts=[a for a in experiment['artifacts'] if a['path'].endswith('.nc')]
        if len(artifacts)!=1:raise ValueError('Expected one raw TORAX NetCDF per completed experiment')
        artifact=artifacts[0]
        original=artifact['path']
        path=(source_root/'public'/original.lstrip('/')) if original.startswith('/recordings/') else source_root/original
        path=path.resolve()
        if not path.is_relative_to(source_root.resolve()):raise ValueError('Evidence path escapes source checkout')
        if artifact.get('sha256') and hashlib.sha256(path.read_bytes()).hexdigest()!=artifact['sha256']:
            raise ValueError('Raw evidence hash changed')
        with xr.open_datatree(path) as tree:
            scalars=tree['scalars'].to_dataset()
            profiles=tree['profiles'].to_dataset()
            times=np.asarray(tree['time'].values)
            ti=np.asarray(profiles['T_i'].values)
            te=np.asarray(profiles['T_e'].values)
            radial_dim=profiles['T_i'].dims[-1]
            rho=np.asarray(profiles.coords[radial_dim].values)
            np.testing.assert_allclose(experiment['metrics']['fusion_energy_mj'],scalars['E_fusion'].values[-1]/1e6,rtol=1e-10)
            np.testing.assert_allclose(experiment['metrics']['heating_energy_mj'],scalars['E_aux_total'].values[-1]/1e6,rtol=1e-10)
            np.testing.assert_allclose(experiment['metrics']['peak_ion_temperature_kev'],ti.max(),rtol=1e-10)
            for frame in experiment['frames']:
                indices=np.flatnonzero(np.isclose(times,frame['time_s'],rtol=0,atol=1e-10))
                if len(indices)!=1:raise ValueError('Exported frame is not a unique measured time sample')
                i=int(indices[0])
                np.testing.assert_allclose(frame['rho'],rho,rtol=0,atol=1e-10)
                np.testing.assert_allclose(frame['ion_temperature_kev'],ti[i],rtol=1e-10)
                np.testing.assert_allclose(frame['electron_temperature_kev'],te[i],rtol=1e-10)
                for field,source in [('fusion_power_mw','P_fusion'),('cumulative_fusion_energy_mj','E_fusion'),('cumulative_heating_energy_mj','E_aux_total')]:
                    np.testing.assert_allclose(frame[field],scalars[source].values[i]/1e6,rtol=1e-10,atol=1e-12)
                count+=1
    print(f'Raw evidence verified: {recording["id"]}, {count} exact recorded profile frames')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('recording',type=Path)
    p.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[1])
    a=p.parse_args();check(a.recording,a.source_root)
