const express = require('express');
const app = express();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store em memória para pagamentos
const payments = new Map();

// CORS para todas as rotas
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// ============ ROTAS DA API ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'PIX Payment API',
        timestamp: new Date().toISOString(),
        node: process.version
    });
});

// Criar pagamento PIX
app.post('/api/payments/create', (req, res) => {
    try {
        const { amount, description } = req.body;
        
        console.log('💰 Criando pagamento:', { amount });
        
        // Validação
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        if (numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                error: 'Valor mínimo é R$ 0,01'
            });
        }
        
        // Gerar ID único
        const paymentId = `pix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Gerar QR Code mock
        const amountInCents = Math.round(numericAmount * 100);
        const qrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX DINAMICO6008BRASILIA62070503***6304`;
        
        // Criar pagamento
        const payment = {
            id: paymentId,
            paymentId,
            qr_code: qrCode,
            qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            amount: numericAmount,
            description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
            status: 'pending',
            approved: false,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60000)
        };
        
        // Armazenar
        payments.set(paymentId, payment);
        
        console.log(`✅ Pagamento criado: ${paymentId}`);
        
        res.json({
            success: true,
            data: payment
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno: ' + error.message
        });
    }
});

// Verificar status
app.get('/api/payments/:id/status', (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`🔍 Verificando: ${paymentId}`);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Verificar se deve aprovar automaticamente (para demonstração)
        const now = new Date();
        const created = new Date(payment.createdAt);
        const elapsedSeconds = Math.floor((now - created) / 1000);
        
        let approved = payment.approved;
        let status = payment.status;
        
        // Aprovar após 30 segundos
        if (!approved && elapsedSeconds > 30) {
            approved = true;
            status = 'approved';
            payment.approved = true;
            payment.status = 'approved';
            payment.approvedAt = now;
            console.log(`✅ Aprovado automaticamente: ${paymentId}`);
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status,
                approved,
                pending: !approved,
                amount: payment.amount,
                elapsed_seconds: elapsedSeconds,
                created_at: payment.createdAt,
                expires_at: payment.expiresAt
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status'
        });
    }
});

// Aprovar manualmente (para testes)
app.post('/api/payments/:id/approve', (req, res) => {
    try {
        const paymentId = req.params.id;
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        payment.status = 'approved';
        payment.approved = true;
        payment.approvedAt = new Date();
        
        console.log(`👑 Aprovado manualmente: ${paymentId}`);
        
        res.json({
            success: true,
            message: 'Pagamento aprovado',
            data: {
                paymentId,
                status: 'approved',
                approved: true
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno'
        });
    }
});

// Listar pagamentos (debug)
app.get('/api/payments', (req, res) => {
    try {
        const allPayments = Array.from(payments.values()).map(p => ({
            id: p.id,
            amount: p.amount,
            status: p.status,
            approved: p.approved,
            createdAt: p.createdAt,
            approvedAt: p.approvedAt
        }));
        
        res.json({
            success: true,
            count: allPayments.length,
            payments: allPayments
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

// ============ ROTAS PARA PÁGINAS ============

// Servir página inicial
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../public/index.html');
});

// Servir checkout
app.get('/checkout', (req, res) => {
    res.sendFile(__dirname + '/../public/checkout.html');
});

// Servir arquivos estáticos da pasta public
app.use(express.static(__dirname + '/../public'));

// ============ ROTA 404 ============
app.use((req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.path,
        method: req.method
    });
});

// ============ EXPORT PARA VERCEL ============
module.exports = app;