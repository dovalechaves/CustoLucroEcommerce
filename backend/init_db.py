import sqlite3
import os

def init_database():
    db_path = 'local_database.db'
    if os.path.exists(db_path):
        print(f"Database {db_path} already exists.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
        CREATE TABLE produtos (
            pro_codigo INTEGER PRIMARY KEY,
            pro_resumo TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE tabelas_produtos (
            tbp_pro_codigo INTEGER,
            tbp_tab_codigo INTEGER,
            tbp_custo REAL,
            FOREIGN KEY (tbp_pro_codigo) REFERENCES produtos(pro_codigo)
        )
    ''')

    cursor.execute('''
        CREATE TABLE produtos_tray (
            ptr_pro_codigo INTEGER,
            ptr_peso_embalagem REAL,
            FOREIGN KEY (ptr_pro_codigo) REFERENCES produtos(pro_codigo)
        )
    ''')

    # Insert sample data
    produtos_data = [
        (17500, 'Produto Exemplo 1'),
        (17501, 'Produto Exemplo 2'),
        (17502, 'Produto Exemplo 3'),
    ]

    tabelas_produtos_data = [
        (17500, 1, 15.50),
        (17501, 1, 22.30),
        (17502, 1, 8.90),
    ]

    produtos_tray_data = [
        (17500, 250.0),
        (17501, 150.0),
        (17502, 500.0),
    ]

    cursor.executemany('INSERT INTO produtos (pro_codigo, pro_resumo) VALUES (?, ?)', produtos_data)
    cursor.executemany('INSERT INTO tabelas_produtos (tbp_pro_codigo, tbp_tab_codigo, tbp_custo) VALUES (?, ?, ?)', tabelas_produtos_data)
    cursor.executemany('INSERT INTO produtos_tray (ptr_pro_codigo, ptr_peso_embalagem) VALUES (?, ?)', produtos_tray_data)

    conn.commit()
    conn.close()
    print(f"Database {db_path} created with sample data.")

if __name__ == '__main__':
    init_database()