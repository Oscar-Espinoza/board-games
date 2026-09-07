"""Build input validation needs no Wasm compilation."""
import copy
import unittest
import tempfile
from build_web import GAMES, validate

CATALOG = [dict(id=g['id'], route=f"/games/{g['id']}/", modes=[dict(kind='table')]) for g in GAMES]


class BuildValidation(unittest.TestCase):
    def test_current_inputs(self):
        validate(GAMES, CATALOG)

    def test_missing_asset(self):
        games = copy.deepcopy(GAMES)
        games[0]['assets'].append('web/missing.js')
        with self.assertRaisesRegex(ValueError, 'Missing build input'):
            validate(games, CATALOG)

    def test_stale_template_runtime(self):
        games = copy.deepcopy(GAMES)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html') as template:
            template.write('<body data-runtime="__ASSET_BASE__/obsolete_runtime.js">')
            template.flush()
            games[0]['template'] = template.name
            with self.assertRaisesRegex(ValueError, 'Unknown template release file'):
                validate(games, CATALOG)

    def test_duplicate_asset(self):
        games = copy.deepcopy(GAMES)
        games[0]['assets'].append(games[0]['assets'][0])
        with self.assertRaisesRegex(ValueError, 'Duplicate release filenames'):
            validate(games, CATALOG)

    def test_registration_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'catalog registrations'):
            validate(GAMES[:1], CATALOG)

    def test_missing_table_dependency(self):
        games = copy.deepcopy(GAMES)
        games[0]['table'] = False
        with self.assertRaisesRegex(ValueError, 'Table integration mismatch'):
            validate(games, CATALOG)


if __name__ == '__main__':
    unittest.main()
