const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

// Fallback para index.html em qualquer rota
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ML Custo & Lucro - Frontend rodando         ║`);
  console.log(`║  http://localhost:${PORT}                      ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
