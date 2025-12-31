const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// Store em memória
const payments = new Map();

// ============ FUNÇÕES PIX ============
function generatePixKey() {
    return `123e4567-e89b-12d3-a456-426614174${Math.random().toString().substr(2, 6)}`;
}

function generateCRC16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(amount, pixKey, merchantName = 'LOJA TESTE', merchantCity = 'SAO PAULO') {
    const amountStr = amount.toFixed(2);
    
    const payload = [
        '000201',
        '010212',
        '26',
        '00',
        '14br.gov.bcb.pix',
        '01',
        `${pixKey.length.toString().padStart(2, '0')}${pixKey}`,
        '52040000',
        '5303986',
        `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`,
        '5802BR',
        `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`,
        `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`,
        '6207',
        '05',
        '***',
        '6304'
    ].join('');
    
    const crc = generateCRC16(payload);
    return payload + crc;
}

// ============ ROTAS API ============
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'ok',
        service: 'PIX Payment API',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/payments/create', (req, res) => {
    try {
        const { amount } = req.body;
        
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
        
        const paymentId = `PIX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const pixKey = generatePixKey();
        
        const pixPayload = generatePixPayload(numericAmount, pixKey);
        
        const payment = {
            id: paymentId,
            paymentId,
            pix_payload: pixPayload,
            amount: numericAmount,
            status: 'pending',
            created: new Date().toISOString()
        };
        
        payments.set(paymentId, payment);
        
        res.json({
            success: true,
            data: {
                paymentId,
                pix_payload: pixPayload,
                amount: numericAmount,
                status: 'pending',
                created_at: payment.created
            }
        });
        
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno'
        });
    }
});

app.get('/api/payments/:id/status', (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        const created = new Date(payment.created);
        const now = new Date();
        const elapsed = (now - created) / 1000;
        
        let approved = payment.approved;
        let status = payment.status;
        
        // Aprovar após 45 segundos para teste
        if (!approved && elapsed > 45) {
            approved = true;
            status = 'approved';
            payment.approved = true;
            payment.status = 'approved';
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status,
                approved,
                pending: !approved,
                elapsed_seconds: Math.floor(elapsed),
                amount: payment.amount
            }
        });
        
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status'
        });
    }
});

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
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'approved',
                approved: true
            }
        });
        
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno'
        });
    }
});

// ============ ROTAS DE PÁGINAS ============

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Checkout page
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Página não encontrada</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #333; }
                a { color: #0066cc; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>404 - Página não encontrada</h1>
            <p>A página que você está procurando não existe.</p>
            <p><a href="/">Voltar para a página inicial</a></p>
            <p><a href="/checkout">Ir para o checkout</a></p>
        </body>
        </html>
    `);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Erro:', err.stack);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Erro interno</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #cc0000; }
            </style>
        </head>
        <body>
            <h1>Erro interno do servidor</h1>
            <p>Desculpe, algo deu errado.</p>
            <p><a href="/">Voltar para a página inicial</a></p>
        </body>
        </html>
    `);
});

// Export para Vercel
module.exports = app;