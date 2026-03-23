const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Rota que busca custo do produto no Firebird ──
app.get('/api/produto/:codigo', (req, res) => {
  const codigo = req.params.codigo;

  const python = spawn('python', [
    path.join(__dirname, '..', 'backend', 'buscar_produto.py'),
    codigo
  ]);

  let output = '';
  let erro = '';

  python.stdout.on('data', (data) => { output += data.toString(); });
  python.stderr.on('data', (data) => { erro += data.toString(); });

  python.on('close', (code) => {
    try {
      const resultado = JSON.parse(output);
      if (resultado.error) {
        return res.status(404).json(resultado);
      }
      res.json(resultado);
    } catch (e) {
      res.status(500).json({ error: 'Erro interno', detail: erro });
    }
  });
});

// Fallback para index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ML Custo & Lucro - Frontend rodando         ║`);
  console.log(`║  http://localhost:${PORT}                      ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});