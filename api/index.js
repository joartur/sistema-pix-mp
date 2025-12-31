const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Importar rotas
const paymentRoutes = require('./payments');
const webhookRoutes = require('./webhook');

// Rotas da API
app.use('/api', paymentRoutes);
app.use('/api', webhookRoutes);

// Rotas para páginas
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
        service: 'PIX Payment System',
        timestamp: new Date().toISOString(),
        endpoints: {
            create_payment: 'POST /api/payments/create',
            check_status: 'GET /api/payments/:id/status',
            webhook: 'POST /api/payments/webhook',
            webhook_test: 'POST /api/payments/webhook/test',
            debug: 'GET /api/debug'
        }
    });
});

// Teste simples
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando!',
        environment: process.env.NODE_ENV || 'development',
        node: process.version,
        timestamp: new Date().toISOString()
    });
});

// Rota de debug
app.get('/api/debug', (req, res) => {
    res.json({
        success: true,
        message: 'Sistema de pagamento PIX',
        version: '1.0.0',
        features: [
            'Criação de pagamentos PIX',
            'QR Code dinâmico',
            'Webhook para notificações',
            'Interface responsiva',
            'Modo sandbox/teste'
        ],
        timestamp: new Date().toISOString()
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro:', err.stack);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Contate o administrador'
    });
});

// Configuração para Vercel
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
🚀 Servidor PIX iniciado!
📡 Porta: ${PORT}
🌐 Ambiente: ${process.env.NODE_ENV || 'development'}
📁 Pasta pública: ${path.join(__dirname, '../public')}
🛣️  Rotas disponíveis:
   • GET  /                 → Página inicial
   • GET  /checkout         → Checkout PIX
   • POST /api/payments/create → Criar pagamento
   • GET  /api/payments/:id/status → Verificar status
   • POST /api/payments/webhook → Webhook Mercado Pago
   • GET  /health           → Health check
        `);
    });
}

module.exports = app;