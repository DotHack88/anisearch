import sqlite3
import os
from pathlib import Path

default_db = Path(__file__).resolve().parent / 'backend' / 'anisearch.db'
db_path = os.getenv('DB_PATH') or str(default_db)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA table_info(watchlist)")
cols = {row[1] for row in cur.fetchall()}
print('Colonne attuali:', cols)

new_cols = {
    'episodes_watched': 'INTEGER DEFAULT 0',
    'episodes_total':   'INTEGER',
    'notes':            'TEXT',
    'last_update':      'TEXT',
    'completed_at':     'TEXT',
}

for col, dtype in new_cols.items():
    if col not in cols:
        cur.execute(f'ALTER TABLE watchlist ADD COLUMN {col} {dtype}')
        print(f'Aggiunta colonna: {col}')
    else:
        print(f'Gia presente: {col}')

conn.commit()
conn.close()
print('Migrazione completata.')
