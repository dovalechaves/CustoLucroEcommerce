import sys
import json
from db import db

def buscar_produto(codigo):
    query = """
        SELECT 
            pro.pro_codigo, 
            pro.pro_resumo, 
            tp.tbp_custo,
            pt.ptr_peso_embalagem
        FROM produtos pro
        INNER JOIN tabelas_produtos tp ON tp.tbp_pro_codigo = pro.pro_codigo
        INNER JOIN produtos_tray pt ON pt.ptr_pro_codigo = pro.pro_codigo
        WHERE tp.tbp_tab_codigo = 1
          AND pro.pro_codigo = ?
    """
    return db.fetch_one(query, params=(codigo,))

if __name__ == '__main__':
    codigo = sys.argv[1] if len(sys.argv) > 1 else None
    if not codigo:
        print(json.dumps({'error': 'Codigo nao informado'}))
        sys.exit(1)

    produto = buscar_produto(codigo)

    if produto:
        print(json.dumps({
            'codigo': produto['pro_codigo'],
            'resumo': produto['pro_resumo'],
            'custo': float(produto['tbp_custo']),
            'peso': float(produto['ptr_peso_embalagem'])
        }))
    else:
        print(json.dumps({'error': 'Produto nao encontrado'}))
        sys.exit(1)