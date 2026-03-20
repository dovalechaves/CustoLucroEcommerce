from db import db

def testar_banco():
    print("Teste willian viadinho")

    try:
        produto = db.fetch_one("SELECT FIRST 1 * FROM PRODUTOS")
        
        if produto:
            print("\n Produto Único Encontrado:")
            print(f"--> Nome: {produto.get('PRO_NOME', 'N/A')}")
        else:
            print("\nNenhum produto encontrado (a tabela está vazia ou o nome está incorreto).")
    except Exception as e:
        print(f"\n Erro no Exemplo 1: {e}")

if __name__ == "__main__":
    testar_banco()
