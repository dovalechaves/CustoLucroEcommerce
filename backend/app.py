import os
import time
import requests
import pyodbc
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()
from db import db
from buscar_produto import buscar_produtos_ecommerce

app = Flask(__name__)
CORS(app, origins="*")

# ── Cache em memória para custo operacional (TTL = 30 min) ──────────────────
_custo_cache = {'base': None, 'ts': 0}
_CUSTO_TTL = 1800  # segundos

def _get_sqlserver_conn(database=None):
    host = os.environ.get('SQLSERVER_HOST', '192.168.10.13')
    port = os.environ.get('SQLSERVER_PORT', '1433')
    db_name = database or os.environ.get('SQLSERVER_DB', 'DOVALE')
    user = os.environ.get('SQLSERVER_USER', 'sa')
    pwd  = os.environ.get('SQLSERVER_PASS', 'Elavod@2018@')
    return pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={host},{port};DATABASE={db_name};"
        f"UID={user};PWD={pwd};TrustServerCertificate=yes;"
    )

ML_API = 'https://api.mercadolibre.com'

def get_token(req):
    auth = req.headers.get('Authorization')
    if auth and auth.startswith('Bearer '):
        token = auth.split(' ')[1]
        if token and token not in ('null', 'undefined'):
            return token
    return None

def ml_headers(token):
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

def format_ml_date(date_str):
    if len(date_str) == 10:
        return f"{date_str}T00:00:00.000-00:00"
    return date_str

def get_fallback_rate(listing_type_id):
    rates = {
        'gold_pro': 0.165,
        'gold_special': 0.14,
        'free': 0.0
    }
    return rates.get(listing_type_id, 0.14)

# ── Tabela Hardcoded de Fretes (Mercado Envios) ─────────────────────────
SHIPPING_TABLE_GREEN = [
    {"max_weight": 0.3, "costs": [5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95]},
    {"max_weight": 0.5, "costs": [5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55]},
    {"max_weight": 1.0, "costs": [6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65]},
    {"max_weight": 1.5, "costs": [6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65]},
    {"max_weight": 2.0, "costs": [6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65]},
    {"max_weight": 3.0, "costs": [6.35, 7.15, 8.35, 15.75, 18.35, 21.05, 23.65, 26.25]},
    {"max_weight": 4.0, "costs": [6.45, 7.35, 8.55, 17.05, 19.85, 22.75, 25.65, 28.35]},
    {"max_weight": 5.0, "costs": [6.55, 7.55, 8.75, 18.45, 21.55, 24.65, 27.75, 30.75]},
    {"max_weight": 9.0, "costs": [6.85, 7.95, 9.15, 25.45, 28.55, 32.65, 35.75, 39.75]},
    {"max_weight": 13.0, "costs": [8.35, 9.65, 11.25, 41.25, 46.25, 52.95, 57.95, 64.35]},
    {"max_weight": 17.0, "costs": [8.35, 9.65, 11.25, 45.95, 51.55, 58.95, 64.55, 71.65]},
    {"max_weight": 30.0, "costs": [8.35, 9.65, 11.25, 49.45, 55.45, 63.45, 69.45, 77.15]}
]

def pegar_preco_frete(price, weight_grams):
    weight_kg = weight_grams / 1000.0
    row = next((r for r in SHIPPING_TABLE_GREEN if weight_kg <= r["max_weight"]), SHIPPING_TABLE_GREEN[-1])
    
    p = float(price)
    if p < 19: return row["costs"][0]
    if p < 49: return row["costs"][1]
    if p < 79: return row["costs"][2]
    if p < 100: return row["costs"][3]
    if p < 120: return row["costs"][4]
    if p < 150: return row["costs"][5]
    if p < 200: return row["costs"][6]
    return row["costs"][7]

@app.route('/api/token-salvo')
def token_salvo():
    try:
        conn = _get_sqlserver_conn()
        cursor = conn.cursor()
        cursor.execute('SELECT TOP 1 TOKEN FROM TOKEN_FULL ORDER BY id DESC')
        row = cursor.fetchone()
        conn.close()

        if not row or not row[0]:
            return jsonify({'error': 'Token não encontrado'}), 404

        return jsonify({'token': row[0]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/custo-operacional')
def custo_operacional():
    """
    Retorna o custo operacional unitário por produto.
    Baseia-se nos últimos 3 meses completos do calendário.
    Aceita ?valor_participacao=2000000 (padrão).
    Resultado em cache por 30 min — apenas o cálculo final varia com o parâmetro.
    """
    valor_participacao = float(request.args.get('valor_participacao', 2000000))

    try:
        # ── Recarrega base do SQL Server se cache expirou ──────────────────
        if _custo_cache['base'] is None or (time.time() - _custo_cache['ts']) > _CUSTO_TTL:
            bi_db = os.environ.get('SQLSERVER_DB_BI', 'DOVALE')
            conn = _get_sqlserver_conn(bi_db)
            cursor = conn.cursor()

            cursor.execute("""
                DECLARE @D0 DATE = DATEADD(MONTH, DATEDIFF(MONTH,0,GETDATE())-3, 0);
                DECLARE @D1 DATE = EOMONTH(GETDATE(),-1);

                WITH
                comercial AS (
                    SELECT CODIGO AS PRO_CODIGO,
                           SUM(VALORTOTAL)  AS VALOR_COMERCIAL,
                           SUM(QTD)         AS QTD_TOTAL
                    FROM [TI-COMERCIAL_62-ControleEP]
                    WHERE DATA BETWEEN @D0 AND @D1
                    GROUP BY CODIGO
                ),
                desconto AS (
                    SELECT PRO_CODIGO,
                           SUM(PRECO_DESCONTO) AS VALOR_DESCONTO,
                           SUM(QTDE)           AS QTD_TOTAL
                    FROM [TI-VENDAS_25-Desconto]
                    WHERE PDV_DATA BETWEEN @D0 AND @D1
                    GROUP BY PRO_CODIGO
                ),
                ecommerce AS (
                    SELECT TRY_CAST(PRO_CODIGO AS INT) AS PRO_CODIGO,
                           SUM(VALORTOTALITEM)         AS VALOR_ECOMMERCE,
                           SUM(PVI_QUANTIDADE)         AS QTD_TOTAL
                    FROM [TI-MARKETING_95-VendaEcommerce]
                    WHERE EMP = 'FULL'
                      AND PDV_DATA BETWEEN @D0 AND @D1
                    GROUP BY TRY_CAST(PRO_CODIGO AS INT)
                ),
                todos AS (
                    SELECT CODIGO AS PRO_CODIGO
                    FROM [TI-COMERCIAL_62-ControleEP] WHERE DATA BETWEEN @D0 AND @D1
                    UNION
                    SELECT PRO_CODIGO
                    FROM [TI-VENDAS_25-Desconto] WHERE PDV_DATA BETWEEN @D0 AND @D1
                    UNION
                    SELECT TRY_CAST(PRO_CODIGO AS INT)
                    FROM [TI-MARKETING_95-VendaEcommerce]
                    WHERE EMP = 'FULL' AND PDV_DATA BETWEEN @D0 AND @D1
                      AND TRY_CAST(PRO_CODIGO AS INT) IS NOT NULL
                ),
                consolidado AS (
                    SELECT
                        t.PRO_CODIGO,
                        COALESCE(c.VALOR_COMERCIAL,0)
                            + COALESCE(d.VALOR_DESCONTO,0)
                            + COALESCE(e.VALOR_ECOMMERCE,0)  AS VENDA_TOTAL,
                        COALESCE(c.QTD_TOTAL,0)
                            + COALESCE(d.QTD_TOTAL,0)
                            + COALESCE(e.QTD_TOTAL,0)        AS QTD_TOTAL
                    FROM todos t
                    LEFT JOIN comercial c ON t.PRO_CODIGO = c.PRO_CODIGO
                    LEFT JOIN desconto  d ON t.PRO_CODIGO = d.PRO_CODIGO
                    LEFT JOIN ecommerce e ON t.PRO_CODIGO = e.PRO_CODIGO
                ),
                grand AS (
                    SELECT SUM(VENDA_TOTAL) AS TOTAL FROM consolidado WHERE VENDA_TOTAL > 0
                )
                SELECT c.PRO_CODIGO,
                       c.VENDA_TOTAL,
                       c.QTD_TOTAL,
                       g.TOTAL AS GRAND_TOTAL
                FROM consolidado c
                CROSS JOIN grand g
                WHERE c.VENDA_TOTAL > 0
            """)

            rows = cursor.fetchall()
            conn.close()

            # Armazena dados base no cache (sem dependência de valor_participacao)
            base = {}
            for row in rows:
                pro_codigo, venda_total, qtd_total, grand_total = row
                if pro_codigo is None:
                    continue
                base[int(pro_codigo)] = {
                    'venda_total':  float(venda_total  or 0),
                    'qtd_total':    float(qtd_total    or 0),
                    'grand_total':  float(grand_total  or 0),
                }
            _custo_cache['base'] = base
            _custo_cache['ts'] = time.time()

        # ── Aplica valor_participacao sobre o cache ────────────────────────
        result = {}
        for pro_codigo, item in _custo_cache['base'].items():
            grand = item['grand_total']
            if grand <= 0:
                continue
            perc = item['venda_total'] / grand          # 0..1
            valor_rateado = perc * valor_participacao
            qtd_media = item['qtd_total'] / 3.0
            custo_unit = round(valor_rateado / qtd_media, 4) if qtd_media > 0 else None
            result[pro_codigo] = {
                'perc_participacao':        round(perc * 100, 4),
                'valor_participacao_rateado': round(valor_rateado, 2),
                'qtd_media_mensal':         round(qtd_media, 2),
                'custo_operacional_unit':   custo_unit,
            }

        return jsonify(result)

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'detail': traceback.format_exc()}), 500


@app.route('/auth/token', methods=['POST'])
def auth_token():
    token = get_token(request)
    if not token and request.is_json:
        token = request.json.get('access_token')
        
    if not token:
        return jsonify({"error": "Preencha com o seu token de acesso ML"}), 400

    try:
        res = requests.get(f"{ML_API}/users/me", headers=ml_headers(token))
        res.raise_for_status()
        data = res.json()
        return jsonify({
            "message": "Autenticado com sucesso",
            "seller_id": data.get("id"),
            "nickname": data.get("nickname")
        })
    except Exception as e:
        return jsonify({"error": "Token inválido ou logado fora do ar"}), 401

@app.route('/api/user', methods=['GET'])
def api_user():
    token = get_token(request)
    print(token)
    if not token:
        return jsonify({"error": "Header Authorization: Bearer <token> obrigatório"}), 401
    try:
        res = requests.get(f"{ML_API}/users/me", headers=ml_headers(token))
        if not res.ok:
            return jsonify({"error": "Token inválido ou expirado"}), res.status_code
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/my-items', methods=['GET'])
def api_my_items():
    token = get_token(request)
    if not token:
        return jsonify({"error": "Header Authorization: Bearer <token> obrigatório"}), 401

    seller_id = request.args.get('seller_id')
    if not seller_id:
        return jsonify({"error": "seller_id é obrigatório"}), 400

    try:
        search_res = requests.get(f"{ML_API}/users/{seller_id}/items/search?status=active", headers=ml_headers(token))
        search_res.raise_for_status()
        ids = search_res.json().get('results', [])
        
        if not ids:
            return jsonify({"items": []})

        top_ids = ",".join(ids[:20])
        items_res = requests.get(f"{ML_API}/items?ids={top_ids}&attributes=id,title,price,category_id,listing_type_id,thumbnail", headers=ml_headers(token))
        items_res.raise_for_status()
        
        items = [i.get('body') for i in items_res.json()]
        return jsonify({"items": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fees/<item_id>', methods=['GET'])
def api_fees(item_id):
    token = get_token(request)
    if not token:
        return jsonify({"error": "Header Authorization: Bearer <token> obrigatório"}), 401
    try:
        item_res = requests.get(f"{ML_API}/items/{item_id}", headers=ml_headers(token))
        item_res.raise_for_status()
        item_data = item_res.json()
        price = item_data.get('price')
        
        fees_res = requests.get(f"{ML_API}/items/{item_id}/fees?price={price}", headers=ml_headers(token))
        fees_res.raise_for_status()
        
        return jsonify({
            "item_price": price,
            "fees": fees_res.json()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/simulate', methods=['POST'])
def api_simulate():
    data = request.json or {}
    item_id = data.get('item_id')
    seller_id = data.get('seller_id')
    price = data.get('price')
    quantity = int(data.get('quantity', 1))
    cost = float(data.get('cost', 0))
    tax_regime = data.get('tax_regime', 'simples')
    listing_type_id = data.get('listing_type_id')
    shipping_cost = float(data.get('shipping_cost', 0))
    weight = int(data.get('weight', 500))
    free_shipping = data.get('free_shipping', True)
    category_id = data.get('category_id')

    if not price:
        return jsonify({"error": "price é obrigatório"}), 400

    price = float(price)

    if data.get('tax_rate') is not None:
        tax_rate = float(data['tax_rate']) / 100
    else:
        TAX_RATES = {'mei': 0.03, 'simples': 0.06, 'presumido': 0.08}
        tax_rate = TAX_RATES.get(tax_regime, 0.21)
    gross_revenue = price * quantity

    ml_fee_percent = get_fallback_rate(listing_type_id)
    ml_fee_amount = gross_revenue * ml_fee_percent

    token = get_token(request)
    
    if token and item_id:
        try:
            fees_res = requests.get(f"{ML_API}/items/{item_id}/fees?price={price}&quantity={quantity}", headers=ml_headers(token))
            fees_res.raise_for_status()
            fees_data = fees_res.json()
            sale_fee_details = fees_data.get('sale_fee_details')
            if sale_fee_details and 'percentage' in sale_fee_details:
                ml_fee_percent = sale_fee_details['percentage'] / 100.0
                ml_fee_amount = sale_fee_details.get('amount') or (gross_revenue * ml_fee_percent)
            elif 'sale_fee' in fees_data:
                ml_fee_amount = fees_data['sale_fee']
                ml_fee_percent = ml_fee_amount / gross_revenue if gross_revenue else 0
        except:
            pass
    elif token and category_id and listing_type_id:
        try:
            ml_api_res = requests.get(f"{ML_API}/sites/MLB/listing_prices?price={price}&listing_type_id={listing_type_id}&category_id={category_id}", headers=ml_headers(token))
            ml_api_res.raise_for_status()
            site_data = ml_api_res.json()
            if site_data and 'sale_fee_amount' in site_data:
                ml_fee_amount = site_data['sale_fee_amount'] * quantity
                ml_fee_percent = ml_fee_amount / gross_revenue if gross_revenue else 0
        except:
            pass

    final_shipping_cost = shipping_cost

    if price >= 79 or free_shipping:
        api_success = False
        if token and seller_id:
            try:
                dim = f"15x15x15,{weight}"
                l_type = listing_type_id or 'gold_pro'
                ship_res = requests.get(f"{ML_API}/users/{seller_id}/shipping_options/free?item_price={price}&dimensions={dim}&listing_type_id={l_type}&condition=new", headers=ml_headers(token))
                ship_res.raise_for_status()
                coverage = ship_res.json().get('coverage', {}).get('all_country', {})
                if 'promotional_cost' in coverage or 'list_cost' in coverage:
                    final_shipping_cost = coverage.get('promotional_cost', coverage.get('list_cost', 0))
                    api_success = True
            except:
                pass
        
        if not api_success:
            final_shipping_cost = pegar_preco_frete(price, weight)

    final_shipping_cost *= quantity
    product_cost = cost * quantity
    tax_amount = gross_revenue * tax_rate
    net_profit = gross_revenue - ml_fee_amount - final_shipping_cost - tax_amount - product_cost
    margin = (net_profit / gross_revenue) * 100 if gross_revenue > 0 else 0

    return jsonify({
        "input": {
            "price": price, "quantity": quantity, "cost": cost, 
            "tax_regime": tax_regime, "listing_type_id": listing_type_id, 
            "shipping_cost": final_shipping_cost, "weight": weight, "free_shipping": free_shipping
        },
        "results": {
            "gross_revenue": gross_revenue,
            "ml_fee_percent": ml_fee_percent * 100,
            "ml_fee_amount": ml_fee_amount,
            "shipping_cost": final_shipping_cost,
            "tax_rate_percent": tax_rate * 100,
            "tax_amount": tax_amount,
            "product_cost": product_cost,
            "net_profit": net_profit,
            "margin_percent": margin
        }
    })

@app.route('/api/produto/<int:codigo>', methods=['GET'])
def api_produto(codigo):
    try:
        query = """
            SELECT
                pro.pro_codigo,
                pro.pro_resumo         AS resumo,
                tp.tbp_custo           AS custo,
                pt.ptr_peso_embalagem  AS peso
            FROM produtos pro
            INNER JOIN tabelas_produtos tp ON tp.tbp_pro_codigo = pro.pro_codigo
            INNER JOIN produtos_tray pt ON pt.ptr_pro_codigo = pro.pro_codigo
            WHERE tp.tbp_tab_codigo = 1
              AND pro.pro_codigo = ?
        """
        produto = db.fetch_one(query, params=(codigo,))
        if not produto:
            return jsonify({'error': 'Produto não encontrado'}), 404
        return jsonify(produto)
    except Exception as e:
        import traceback
        return jsonify({'error': 'Erro interno', 'detail': traceback.format_exc()}), 500

@app.route('/api/produtos', methods=['GET'])
def api_produtos():
    try:
        produtos = buscar_produtos_ecommerce()
        return jsonify(produtos)
    except Exception as e:
        import traceback
        return jsonify({'error': 'Erro interno', 'detail': traceback.format_exc()}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=True)
