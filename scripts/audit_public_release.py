#!/usr/bin/env python3
from __future__ import annotations
import re,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve(); errors=[]
blocked_ext={'.parquet','.feather','.arrow','.sas7bdat','.dta','.rdata','.rds','.xlsx'}
blocked_names={'.env','SPX_WRDS_Thesis_Report_2005_2021.pdf','SPX_WRDS_Thesis_Report_2005_2021_v4_1.pdf'}
secret=re.compile(r'(WRDS_(?:USERNAME|PASSWORD)|api[_-]?key|password|secret)\s*[:=]\s*[^\s#]+',re.I)
for p in root.rglob('*'):
    if not p.is_file() or '.git' in p.parts: continue
    rel=p.relative_to(root).as_posix()
    if p.name in blocked_names: errors.append(f'blocked file: {rel}')
    if p.suffix.lower() in blocked_ext: errors.append(f'binary data file: {rel}')
    if p.suffix.lower() in {'.md','.txt','.py','.yml','.yaml','.json','.toml','.js','.html','.env'}:
        text=p.read_text(encoding='utf-8',errors='ignore')
        if p.name!='.env.example' and secret.search(text): errors.append(f'possible secret: {rel}')
if errors:
    print('PUBLIC RELEASE AUDIT FAILED',file=sys.stderr)
    for e in sorted(set(errors)): print('-',e,file=sys.stderr)
    raise SystemExit(1)
print('Playground public release audit passed.')
