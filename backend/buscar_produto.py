import sys
import json
from db import db

def buscar_produto(codigo):
    query = """
        SELECT
            pro.pro_codigo,
            pro.pro_resumo AS resumo,
            tp.tbp_custo   AS custo,
            pt.ptr_peso_embalagem AS peso
        FROM produtos pro
        INNER JOIN tabelas_produtos tp ON tp.tbp_pro_codigo = pro.pro_codigo
        INNER JOIN produtos_tray pt ON pt.ptr_pro_codigo = pro.pro_codigo
        WHERE tp.tbp_tab_codigo = 1
          AND pro.pro_codigo = ?
    """
    return db.fetch_one(query, params=(codigo,))


if __name__ == '__main__':
    try:
        if len(sys.argv) < 2:
            print(json.dumps({'error': 'Código do produto não informado'}))
            sys.exit(1)
        codigo = int(sys.argv[1])
        resultado = buscar_produto(codigo)
        if resultado:
            print(json.dumps(resultado))
        else:
            print(json.dumps({'error': 'Produto não encontrado'}))
    except Exception as e:
        import traceback
        print(json.dumps({'error': str(e), 'detail': traceback.format_exc()}))