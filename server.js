require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
const apiRoutes = require('./src/services/routes');
app.use('/api', apiRoutes);

// Rotas para páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

// Health check para Vercel
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL === '1',
    node_version: process.version,
    memory: process.memoryUsage()
  });
});

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Catch-all para erros 404
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Rota da API não encontrada',
      path: req.originalUrl
    });
  }
  
  // Para rotas não-API, servir index.html para SPA
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Erro no servidor:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Configuração da porta
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Pasta pública: ${path.join(__dirname, 'public')}`);
  
  // Verificar variáveis de ambiente
  if (process.env.MP_ACCESS_TOKEN) {
    console.log('💰 Mercado Pago: Configurado');
  } else {
    console.log('⚠️  Mercado Pago: Token não encontrado (modo teste)');
  }
});

module.exports = app;