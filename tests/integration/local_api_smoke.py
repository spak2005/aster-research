"""Opt-in real HTTP start/busy/cancel check. Runs at most one TORAX baseline."""
import argparse
import json
import time
import urllib.error
import urllib.request


def request(base,path,body=None):
    headers={'Accept':'application/json'}
    if body is not None:headers['Content-Type']='application/json'
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    with urllib.request.urlopen(req,timeout=10) as response:return json.load(response)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--real',action='store_true',required=True)
    p.add_argument('--base',default='http://127.0.0.1:5173/api')
    a=p.parse_args()
    assert request(a.base,'/health')['ready']
    run=request(a.base,'/runs',{'question':'Local API start/cancel integration check','preset':'fixed-energy','max_experiments':3,'seed':19})
    run_id=run['id']
    print('Started real local run:',run_id,flush=True)
    try:
        try:request(a.base,'/runs',{'preset':'fixed-energy','max_experiments':3})
        except urllib.error.HTTPError as e:assert e.code==409,e.code
        else:raise AssertionError('Concurrent start did not return 409')
    finally:
        canceled=request(a.base,f'/runs/{run_id}/cancel',{})
        assert canceled['status']=='cancel_requested'
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        recording=request(a.base,f'/runs/{run_id}')
        if recording['status'] not in ['running']:
            assert recording['status']=='canceled',recording['status']
            assert len(recording['experiments'])<=1
            assert all(e['role']=='baseline' for e in recording['experiments'])
            events=request(a.base,f'/runs/{run_id}/events?after=0')
            assert any(e['type']=='run.canceled' for e in events)
            assert not any(e['type']=='run.completed' for e in events)
            print(f'PASS: actual HTTP start, 409 contention, cooperative cancel; {len(recording["experiments"])} baseline experiment(s)',flush=True)
            return
        time.sleep(.5)
    raise TimeoutError('Canceled local run did not terminate within 120 seconds')

if __name__=='__main__':main()
