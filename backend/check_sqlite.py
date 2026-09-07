import sqlite3

try:
    conn = sqlite3.connect(r'c:\Users\yaman\OneDrive\Desktop(1)\attendance\server\attendance.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    for table in tables:
        t_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM [{t_name}]")
        count = cursor.fetchone()[0]
        print(f"Table {t_name}: {count} rows")
        if count > 0:
            cursor.execute(f"SELECT * FROM [{t_name}] LIMIT 5")
            cols = [d[0] for d in cursor.description]
            print(f"  Cols: {cols}")
            for row in cursor.fetchall():
                print(f"  Row: {row}")
except Exception as e:
    print("Error:", e)
