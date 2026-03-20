# ML Custo & Lucro

Aplicação para calcular custos e lucro de vendas no Mercado Livre usando a API oficial.

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Conta de desenvolvedor no Mercado Livre

---

## 1. Criar aplicação no ML Developers

1. Acesse [https://developers.mercadolivre.com.br/pt_br/registra-sua-aplicacion](https://developers.mercadolivre.com.br/pt_br/registra-sua-aplicacion)
2. Clique em **Criar aplicação**
3. Preencha os campos:
   - **Nome:** ML Custo & Lucro (ou qualquer nome)
   - **Descrição breve:** Análise de custos e lucros
   - **Domínio permitido / URI de redirecionamento:** `http://localhost:3001/auth/callback`
   - **Escopos:** marque `read`, `write` e `offline_access`
4. Salve e anote o **App ID** (client_id) e o **Client Secret**

---

## 2. Configurar o .env

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `backend/.env`:

```env
ML_CLIENT_ID=12345678          # Seu App ID do ML
ML_CLIENT_SECRET=AbCdEfGhIj    # Seu Client Secret do ML
ML_REDIRECT_URI=http://localhost:3001/auth/callback
FRONTEND_URL=http://localhost:3000
PORT=3001
```

> **Importante:** A `ML_REDIRECT_URI` deve ser exatamente igual à configurada no painel do ML Developers.

---

## 3. Instalar dependências

```bash
cd backend
npm install
```

---

## 4. Rodar o projeto

### Opção A: Script automático (Windows)

Dê duplo clique no arquivo `start-all.bat` na raiz do projeto.

O script irá:
- Verificar se o `.env` existe (e copiar o exemplo se não existir)
- Instalar dependências automaticamente se necessário
- Iniciar o backend na porta 3001
- Abrir o frontend no navegador

### Opção B: Manual

**Terminal 1 — Backend:**
```bash
cd backend
npm start
```

**Frontend:**
Abra o arquivo `frontend/index.html` diretamente no navegador.

Ou sirva com um servidor local:
```bash
npx serve frontend -p 3000
```

---

## 5. Uso

1. Acesse o `frontend/index.html` no navegador
2. Clique em **Conectar com Mercado Livre**
3. Autorize o acesso na página do ML
4. Após autorização, você será redirecionado de volta à aplicação
5. Use os filtros de período e status para buscar seus pedidos
6. Informe o **custo do produto** diretamente na tabela (campo editável)
7. Selecione o **regime tributário** (MEI / Simples Nacional / Lucro Presumido)
8. Veja os cálculos de lucro e margem em tempo real
9. Use o **Simulador** para calcular lucro antes de precificar

---

## Estrutura do Projeto

```
EcomerceCustoLucro/
├── backend/
│   ├── server.js          # Servidor Express com endpoints da API ML
│   ├── package.json
│   ├── .env.example       # Modelo de configuração
│   └── .env               # Suas credenciais (não commitar!)
├── frontend/
│   └── index.html         # SPA completa (HTML + CSS + JS)
├── start-all.bat          # Script de inicialização para Windows
└── README.md
```

---

## Endpoints do Backend

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/auth/url` | Retorna URL de autorização OAuth ML |
| GET | `/auth/callback?code=` | Troca code por access_token |
| GET | `/api/user?seller_id=` | Dados do usuário autenticado |
| GET | `/api/orders?seller_id=&date_from=&date_to=&status=` | Lista pedidos com filtros |
| GET | `/api/order/:id?seller_id=` | Detalhes de um pedido |
| GET | `/api/fees/:item_id?seller_id=&price=&quantity=` | Taxas ML para um item |
| POST | `/api/simulate` | Simula lucro com dados fornecidos |
| GET | `/health` | Status do servidor |

---

## Cálculo de Lucro

```
Receita Bruta    = Preço de Venda × Quantidade
Taxa ML          = Receita Bruta × % (vem da API /fees ou fallback por tipo)
Imposto          = Receita Bruta × Alíquota do Regime
Custo do Produto = Informado pelo usuário na tabela
Frete            = Custo de envio do pedido
─────────────────────────────────────────────────
Lucro Líquido    = Receita Bruta − Taxa ML − Frete − Imposto − Custo
Margem%          = (Lucro Líquido / Receita Bruta) × 100
```

### Alíquotas por Regime Tributário

| Regime | Alíquota estimada |
|--------|-------------------|
| MEI | ~3% |
| Simples Nacional | ~6% |
| Lucro Presumido | ~8% |

### Taxas ML por Tipo de Anúncio (fallback)

| Tipo | Taxa |
|------|------|
| Grátis | 0% |
| Clássico | 12% |
| Premium | 16% |

---

## Segurança

- O `access_token` é armazenado apenas em memória no backend (não persiste entre reinicializações)
- O `seller_id` é armazenado no `localStorage` do navegador
- **Nunca commite o arquivo `.env` com suas credenciais**
- Adicione `.env` ao seu `.gitignore`
