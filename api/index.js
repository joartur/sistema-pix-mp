const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Importar rotas
const paymentRoutes = require('./payments');

// Rotas da API
app.use('/api', paymentRoutes);

// Rota para arquivos estáticos
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'PIX Payment API'
    });
});

// Rota de teste simplificada
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Lidar com 404
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Lidar com erros
app.use((err, req, res, next) => {
    console.error('Erro no servidor:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Configuração para Vercel
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📁 Pasta pública: ${path.join(__dirname, '../public')}`);
        console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;