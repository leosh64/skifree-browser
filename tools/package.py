"""Build a single offline HTML release using Python's standard library."""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SCRIPTS = [
    'original-data.js', 'original-controls.js', 'original-world.js',
    'original-collision.js', 'engine.js', 'assets.js', 'game.js',
]


def build():
    DIST.mkdir(exist_ok=True)
    manifest = json.loads((ROOT / 'assets/manifest.json').read_text())
    # Keep the editable page's asset declarations synchronized with the manifest.
    (ROOT / 'assets.js').write_text(
        'globalThis.SKI_SPRITES = ' + json.dumps(manifest, indent=2) + ';\n'
    )
    embedded = {
        key: {**meta, 'file': 'data:image/png;base64,' + base64.b64encode(
            (ROOT / meta['file']).read_bytes()).decode()}
        for key, meta in manifest.items()
    }
    html = (ROOT / 'index.html').read_text()
    html = html.replace(
        '<link rel="stylesheet" href="style.css">',
        '<style>\n' + (ROOT / 'style.css').read_text() + '\n</style>',
    )
    for script in SCRIPTS:
        content = ('globalThis.SKI_SPRITES = ' + json.dumps(embedded) + ';'
                   if script == 'assets.js' else (ROOT / script).read_text())
        html = html.replace(f'<script defer src="{script}"></script>', '')
        html = html.replace('</body>', '<script>\n' + content.replace(
            '</script', '<\\/script') + '\n</script>\n</body>')
    html = html.replace('href="assets/1.png"', 'href="' + embedded['1']['file'] + '"')
    standalone = DIST / 'SkiFree.html'
    standalone.write_text(html)

    print('Standalone:', standalone)


if __name__ == '__main__':
    build()
