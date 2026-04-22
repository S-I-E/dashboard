#!/usr/bin/env python3
"""
Best-effort placeholder inserter working directly on document.xml when python-docx isn't available.
Usage: python3 insert_placeholders_manual_xml.py <filename.docx>
Writes edited docx and json to templates/legal_instruments/generated/clean/
"""
import re
import sys
from pathlib import Path
import zipfile
import json
import unicodedata

TEMPLATES_DIR = Path.cwd() / 'templates' / 'legal_instruments' / 'generated'
OUT_DIR = TEMPLATES_DIR / 'clean'
OUT_DIR.mkdir(parents=True, exist_ok=True)

LABELS = [
    'Cidade', 'UF', 'CEP', 'Representante legal', 'C.P.F./M.F.', 'CPF', 'CNPJ', 'Identidade n.º', 'Nacionalidade', 'Cargo', 'Ato de Nomeação',
    'Instituição', 'Natureza Jurídica', 'Endereço', 'Objeto', 'Plano de trabalho', 'Vigência', 'Valor', 'Prazo', 'Data', 'Partes',
]

def slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode('ascii')
    s = re.sub(r'[^a-zA-Z0-9]+','_', s)
    return s.strip('_').lower()

def insert_placeholders_in_xml(xml: str):
    inserted = set()
    # operate on xml string: look for patterns like 'Label\s*[:\-]\s*TEXT' where TEXT is plain text (no '<')
    for label in LABELS:
        id = slugify(label)
        # regex: label, optional spaces, colon/dash, then capture up to next < (start tag) or </w:p>
        pattern = re.compile(r'(' + re.escape(label) + r')\s*[:\-–]\s*([^<\r\n]{1,200})', flags=re.IGNORECASE)
        def repl(m):
            inserted.add(id)
            return m.group(1) + ': {{' + id + '}}'
        xml, n = pattern.subn(repl, xml)
    return xml, inserted

def process(docx_name: str):
    src = TEMPLATES_DIR / docx_name
    if not src.exists():
        print('Source not found:', src)
        return
    with zipfile.ZipFile(src, 'r') as zin:
        namelist = zin.namelist()
        if 'word/document.xml' not in namelist:
            print('document.xml not found in', src)
            return
        xml = zin.read('word/document.xml').decode('utf-8')
        new_xml, inserted = insert_placeholders_in_xml(xml)
        # write new docx
        out_path = OUT_DIR / src.name
        with zipfile.ZipFile(out_path, 'w') as zout:
            for name in namelist:
                if name == 'word/document.xml':
                    zout.writestr(name, new_xml.encode('utf-8'))
                else:
                    zout.writestr(name, zin.read(name))
    # write json
    fields = []
    for id in sorted(inserted):
        fields.append({'id': id, 'name': id, 'type': 'text', 'label': id.replace('_',' ').capitalize(), 'required': False})
    json_path = OUT_DIR / (src.stem + '.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({'template': out_path.name, 'fields': fields}, f, ensure_ascii=False, indent=2)
    print('Wrote:', out_path)
    print('Wrote:', json_path)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: insert_placeholders_manual_xml.py <filename.docx>')
        sys.exit(2)
    process(sys.argv[1])
