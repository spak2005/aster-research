"""Keep injected test measurements out of the real local research catalog."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from services.research import api,executor,orchestrator


class IsolatedResearchTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        temporary=tempfile.TemporaryDirectory(prefix='aster-test-')
        self.addCleanup(temporary.cleanup)
        root=Path(temporary.name)
        for module,name,value in [(api,'RUNS_DIR',root/'runs'),
                                  (orchestrator,'RUNS_DIR',root/'runs'),
                                  (executor,'EXPERIMENT_DIR',root/'experiments'),
                                  (executor,'RUNTIME_DIR',root)]:
            replacement=patch.object(module,name,value)
            replacement.start()
            self.addCleanup(replacement.stop)
