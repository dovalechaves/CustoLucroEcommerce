import os
import fdb
from dotenv import load_dotenv

load_dotenv()

class FirebirdManager:
    def __init__(self):
        self.host = os.environ.get('DATABASE_HOST', '192.168.10.37')
        self.port = int(os.environ.get('DATABASE_PORT', 3050))
        self.db_replica = os.environ.get('DATABASE_NAME', 'C:/Replicacao/SJC/MSYSDADOS_REPLICA.FDB')
        self.db_audit = os.environ.get('DATABASE_NAME_LOG', 'C:/Microsys/SJC/MsysIndustrial/dados/AUDITLOG.FDB')
        self.user = os.environ.get('DATABASE_USER', 'SYSDBA')
        self.password = os.environ.get('DATABASE_PASSWORD', 'masterkey')
        self.charset = os.environ.get('DATABASE_CHARSET', 'UTF8')

    def _connect(self, database_path):
        return fdb.connect(
            host=f"{self.host}/{self.port}",
            database=database_path,
            user=self.user,
            password=self.password,
            charset=self.charset
        )

    def get_replica_connection(self):
        return self._connect(self.db_replica)

    def get_audit_connection(self):
        return self._connect(self.db_audit)

    def fetch_all(self, query, params=None, use_audit=False):
        conn = self.get_audit_connection() if use_audit else self.get_replica_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            columns = [desc[0] for desc in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return results
        finally:
            conn.close()

    def fetch_one(self, query, params=None, use_audit=False):
        conn = self.get_audit_connection() if use_audit else self.get_replica_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            row = cursor.fetchone()
            if not row:
                return None
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        finally:
            conn.close()

    # ✅ SUA FUNÇÃO NOVA AQUI
    def buscar_custo_produtos(self):
        query = """
            SELECT 
                pro.pro_codigo, 
                pro.pro_resumo, 
                tp.tbp_custo
            FROM produtos pro
            INNER JOIN tabelas_produtos tp ON tp.tbp_pro_codigo = pro.pro_codigo
            WHERE tp.tbp_tab_codigo = 1
        """
        return self.fetch_all(query)

db = FirebirdManager()