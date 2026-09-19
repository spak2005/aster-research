import copy
import json
import unittest
from scripts.validate_recording import ROOT,validate_recording

class RecordingContractTests(unittest.TestCase):
    def setUp(self):
        self.recording=json.loads((ROOT/'contracts/examples/contract-test.json').read_text())
    def test_fixture_schema_and_links(self):
        validate_recording(self.recording)
    def test_fixture_cannot_be_published(self):
        with self.assertRaisesRegex(ValueError,'fixtures'):
            validate_recording(self.recording,public=True)
    def test_nonfinite_metric_rejected(self):
        self.recording['experiments'][0]['metrics']['fusion_energy_mj']=float('nan')
        with self.assertRaisesRegex(ValueError,'number'):
            validate_recording(self.recording)
    def test_profile_shape_mismatch_rejected(self):
        self.recording['experiments'][0]['frames'][0]['rho'].pop()
        with self.assertRaisesRegex(ValueError,'lengths differ'):
            validate_recording(self.recording)
    def test_duplicate_sequence_rejected(self):
        self.recording['events'][1]['sequence']=0
        with self.assertRaisesRegex(ValueError,'strictly increasing'):
            validate_recording(self.recording)
    def test_unknown_evidence_rejected(self):
        self.recording['conclusion']['evidence_ids']=['invented']
        with self.assertRaisesRegex(ValueError,'Unknown evidence'):
            validate_recording(self.recording)
    def test_cyclic_ancestry_rejected(self):
        self.recording['hypotheses'][0]['parent_id']='h1'
        with self.assertRaisesRegex(ValueError,'cycle'):
            validate_recording(self.recording)
    def test_summary_matches_measured_frame(self):
        self.recording['experiments'][0]['metrics']['fusion_energy_mj']=9999
        with self.assertRaisesRegex(ValueError,'differs from final'):
            validate_recording(self.recording)
    def test_dangling_experiment_rejected(self):
        self.recording['events'][2]['experiment_id']='nonexistent'
        with self.assertRaisesRegex(ValueError,'unknown experiment'):
            validate_recording(self.recording)

if __name__=='__main__':unittest.main()
