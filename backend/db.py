import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

class DatabaseManager:
    def __init__(self):
        self.use_sqlite = os.environ.get('USE_SQLITE', 'false').lower() == 'true'
        if self.use_sqlite:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            default_db = os.path.join(base_dir, 'local_database.db')
            self.db_path = os.environ.get('SQLITE_DB_PATH', default_db)
        else:

            self.host = os.environ.get('DATABASE_HOST', '192.168.10.37')
            self.port = int(os.environ.get('DATABASE_PORT', 3050))
            self.db_replica = os.environ.get('DATABASE_NAME', 'C:/Microsys/SJC/MsysIndustrial/dados/MSYSDADOS.FDB')
            self.db_audit = os.environ.get('DATABASE_NAME_LOG', 'C:/Microsys/SJC/MsysIndustrial/dados/AUDITLOG.FDB')
            self.user = os.environ.get('DATABASE_USER', 'SYSDBA')
            self.password = os.environ.get('DATABASE_PASSWORD', 'masterkey')
            self.charset = os.environ.get('DATABASE_CHARSET', 'UTF8')

    def _connect_sqlite(self):
        return sqlite3.connect(self.db_path)

    def _connect_firebird(self, database_path):
        import locale
        if not hasattr(locale, 'resetlocale'):
            locale.resetlocale = lambda: None
        import fdb
        return fdb.connect(
            host=f"{self.host}/{self.port}",
            database=database_path,
            user=self.user,
            password=self.password,
            charset=self.charset
        )

    def get_connection(self, use_audit=False):
        if self.use_sqlite:
            return self._connect_sqlite()
        else:
            database_path = self.db_audit if use_audit else self.db_replica
            return self._connect_firebird(database_path)

    def fetch_all(self, query, params=None, use_audit=False):
        conn = self.get_connection(use_audit)
        try:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            columns = [desc[0].lower() for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        finally:
            conn.close()

    def fetch_one(self, query, params=None, use_audit=False):
        conn = self.get_connection(use_audit)
        try:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            row = cursor.fetchone()
            if not row:
                return None
            columns = [desc[0].lower() for desc in cursor.description]
            return dict(zip(columns, row))
        finally:
            conn.close()

    def execute(self, query, params=None, use_audit=False):
        conn = self.get_connection(use_audit)
        try:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()

# Initialize database
db = DatabaseManager()