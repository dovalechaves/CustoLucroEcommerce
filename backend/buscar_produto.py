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

def buscar_produtos_ecommerce():
    query = """
        SELECT
            pro.pro_codigo,
            pro.pro_resumo            AS resumo,
            t1.tbp_custo              AS custo,
            t4.tbp_custo              AS preco,
            pt.ptr_peso_embalagem     AS peso
        FROM produtos pro
        LEFT JOIN tabelas_produtos t1 ON t1.tbp_pro_codigo = pro.pro_codigo AND t1.tbp_tab_codigo = 1
        LEFT JOIN tabelas_produtos t4 ON t4.tbp_pro_codigo = pro.pro_codigo AND t4.tbp_tab_codigo = 4
        INNER JOIN produtos_tray pt   ON pt.ptr_pro_codigo  = pro.pro_codigo
        WHERE t1.tbp_pro_codigo IS NOT NULL
    """
    return db.fetch_all(query)

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