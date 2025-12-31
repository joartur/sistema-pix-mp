const express = require('express');
const app = express();

// ============ CORS CONFIG ============
app.use((req, res, next) => {
    // Lista de origens permitidas
    const allowedOrigins = [
        'https://fazmeupix.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Responder a preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Middleware para parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store em memória
const payments = new Map();

// ============ ROTAS ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Criar pagamento
app.post('/api/payments/create', (req, res) => {
    try {
        console.log('📥 Recebido:', req.body);
        
        const { amount, description } = req.body;
        
        // Validação
        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'Valor é obrigatório'
            });
        }
        
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido. Mínimo: R$ 0,01'
            });
        }
        
        // Criar ID
        const paymentId = `pix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Simular QR Code
        const qrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${Math.round(numericAmount * 100)}5802BR5913PIX TESTE6008BRASILIA62070503***6304`;
        
        const payment = {
            id: paymentId,
            paymentId,
            qr_code: qrCode,
            amount: numericAmount,
            description: description || `Pagamento PIX R$ ${numericAmount.toFixed(2)}`,
            status: 'pending',
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 1800000).toISOString() // 30 minutos
        };
        
        payments.set(paymentId, payment);
        
        console.log(`✅ Criado: ${paymentId} - R$ ${numericAmount.toFixed(2)}`);
        
        res.json({
            success: true,
            data: payment
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno'
        });
    }
});

// Status do pagamento
app.get('/api/payments/:id/status', (req, res) => {
    try {
        const paymentId = req.params.id;
        console.log(`🔍 Status: ${paymentId}`);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Simular aprovação após 30 segundos
        const created = new Date(payment.created);
        const now = new Date();
        const elapsed = (now - created) / 1000;
        
        let approved = false;
        let status = 'pending';
        
        // Aprovar após 30 segundos
        if (elapsed > 30) {
            approved = true;
            status = 'approved';
            payment.status = 'approved';
            payment.approvedAt = now.toISOString();
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status,
                approved,
                pending: !approved,
                elapsed_seconds: Math.floor(elapsed),
                amount: payment.amount,
                created: payment.created,
                expires: payment.expires
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

// Listar pagamentos (debug)
app.get('/api/payments', (req, res) => {
    res.json({
        success: true,
        count: payments.size,
        payments: Array.from(payments.entries()).map(([id, p]) => ({
            id,
            amount: p.amount,
            status: p.status,
            created: p.created
        }))
    });
});

// ============ ARQUIVOS ESTÁTICOS ============

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PIX Payment</title>
            <style>
                body { font-family: sans-serif; padding: 40px; text-align: center; }
                h1 { color: #333; }
                input, button { padding: 10px; margin: 10px; font-size: 16px; }
            </style>
        </head>
        <body>
            <h1>💰 Gerador PIX</h1>
            <input type="number" id="amount" placeholder="Valor" value="10.00" step="0.01">
            <button onclick="generate()">Gerar QR Code</button>
            <script>
                function generate() {
                    const amount = document.getElementById('amount').value;
                    window.location.href = '/checkout.html?amount=' + amount;
                }
            </script>
        </body>
        </html>
    `);
});

// Servir arquivos estáticos da pasta public
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Rota para checkout.html
app.get('/checkout.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🔥 Erro:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
    });
});

// Export para Vercel
module.exports = app;