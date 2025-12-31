const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Mercado Pago
const mercadopago = require('mercadopago');

// Configurar Mercado Pago
if (process.env.MP_ACCESS_TOKEN) {
    mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN,
        sandbox: process.env.MP_ACCESS_TOKEN.includes('TEST'), // Auto-detect sandbox
    });
    console.log('✅ Mercado Pago configurado');
} else {
    console.warn('⚠️  MP_ACCESS_TOKEN não configurado');
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store em memória (em produção, use um banco de dados)
const payments = new Map();

// ============ ROTAS DA API ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'PIX Payment API',
        mercadopago: !!process.env.MP_ACCESS_TOKEN,
        timestamp: new Date().toISOString()
    });
});

// Criar pagamento PIX com Mercado Pago
app.post('/api/payments/create', async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('💰 Criando pagamento PIX real:', { amount });
        
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
        
        if (numericAmount > 50000) {
            return res.status(400).json({
                success: false,
                error: 'Valor máximo é R$ 50.000,00'
            });
        }
        
        // Verificar se Mercado Pago está configurado
        if (!process.env.MP_ACCESS_TOKEN) {
            return res.status(500).json({
                success: false,
                error: 'Sistema de pagamento não configurado'
            });
        }
        
        // Criar pagamento no Mercado Pago
        const paymentData = {
            transaction_amount: numericAmount,
            description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
            payment_method_id: 'pix',
            payer: {
                email: customerEmail || 'cliente@pix.com',
                first_name: customerName?.split(' ')[0] || 'Cliente',
                last_name: customerName?.split(' ').slice(1).join(' ') || 'PIX',
                identification: {
                    type: 'CPF',
                    number: '12345678909' // Em produção, peça ao cliente
                }
            },
            notification_url: process.env.MP_WEBHOOK_URL,
            date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
            metadata: {
                system: 'fazmeupix',
                created_at: new Date().toISOString()
            }
        };
        
        console.log('📤 Enviando para Mercado Pago...');
        const response = await mercadopago.payment.create(paymentData);
        
        const mpPayment = response.body;
        
        console.log('✅ Pagamento criado no Mercado Pago:', mpPayment.id);
        
        // Extrair dados do PIX
        let qrCode = '';
        let qrCodeBase64 = '';
        let qrCodeText = '';
        
        if (mpPayment.point_of_interaction?.transaction_data) {
            const pixData = mpPayment.point_of_interaction.transaction_data;
            qrCode = pixData.qr_code || '';
            qrCodeBase64 = pixData.qr_code_base64 || '';
            qrCodeText = pixData.qr_code || pixData.ticket_url || '';
        }
        
        // Armazenar pagamento
        const payment = {
            id: mpPayment.id.toString(),
            paymentId: mpPayment.id.toString(),
            mp_id: mpPayment.id,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
            qr_code_text: qrCodeText,
            amount: numericAmount,
            description: paymentData.description,
            status: mpPayment.status || 'pending',
            status_detail: mpPayment.status_detail,
            created_at: new Date().toISOString(),
            expires_at: mpPayment.date_of_expiration,
            mp_data: mpPayment, // Salvar dados completos
            approved: false,
            paid: false
        };
        
        payments.set(payment.id, payment);
        
        res.json({
            success: true,
            data: {
                paymentId: payment.id,
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                qr_code_text: qrCodeText,
                amount: numericAmount,
                description: payment.description,
                status: payment.status,
                created_at: payment.created_at,
                expires_at: payment.expires_at,
                ticket_url: mpPayment.transaction_details?.external_resource_url,
                point_of_interaction: mpPayment.point_of_interaction
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        
        // Detalhar erro do Mercado Pago
        let errorMessage = 'Erro ao processar pagamento';
        if (error.response && error.response.body) {
            const mpError = error.response.body;
            errorMessage = mpError.message || JSON.stringify(mpError);
            console.error('Detalhes MP:', mpError);
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage,
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Verificar status do pagamento
app.get('/api/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`🔍 Verificando status real: ${paymentId}`);
        
        // Buscar do cache
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Verificar status no Mercado Pago (FORÇAR atualização)
        let mpStatus = payment.status;
        let approved = payment.approved;
        let paid = payment.paid;
        let statusDetail = payment.status_detail;
        
        if (process.env.MP_ACCESS_TOKEN) {
            try {
                console.log(`📡 Consultando Mercado Pago para: ${payment.mp_id}`);
                const response = await mercadopago.payment.get(payment.mp_id);
                const mpPayment = response.body;
                
                mpStatus = mpPayment.status;
                statusDetail = mpPayment.status_detail;
                
                console.log(`📊 Status MP: ${mpStatus}, Detail: ${statusDetail}`);
                
                // Atualizar cache
                payment.status = mpStatus;
                payment.status_detail = statusDetail;
                
                // Verificar se foi aprovado
                if (mpStatus === 'approved') {
                    approved = true;
                    paid = true;
                    payment.approved = true;
                    payment.paid = true;
                    payment.approved_at = new Date().toISOString();
                    console.log(`✅ Pagamento confirmado: ${paymentId}`);
                }
                
                // Se for rejeitado
                if (mpStatus === 'rejected') {
                    console.log(`❌ Pagamento rejeitado: ${paymentId}`);
                }
                
                // Salvar no cache
                payments.set(paymentId, payment);
                
            } catch (mpError) {
                console.error('Erro ao verificar no MP:', mpError.message);
                if (mpError.response && mpError.response.body) {
                    console.error('Detalhes MP:', mpError.response.body);
                }
            }
        }
        
        const created = new Date(payment.created_at);
        const now = new Date();
        const elapsed = Math.floor((now - created) / 1000);
        
        // Verificar se expirou
        let expired = false;
        if (payment.expires_at) {
            const expires = new Date(payment.expires_at);
            expired = now > expires;
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: mpStatus,
                status_detail: statusDetail,
                approved,
                paid,
                pending: !approved && mpStatus === 'pending',
                expired,
                elapsed_seconds: elapsed,
                amount: payment.amount,
                qr_code_base64: payment.qr_code_base64,
                qr_code_text: payment.qr_code_text,
                created_at: payment.created_at,
                expires_at: payment.expires_at,
                approved_at: payment.approved_at
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status',
            message: error.message
        });
    }
});

// Webhook do Mercado Pago
app.post('/api/payments/webhook', async (req, res) => {
    try {
        const { id, type } = req.body;
        
        console.log('🔔 Webhook recebido:', { id, type });
        
        if (type === 'payment') {
            const paymentId = id.toString();
            
            // Verificar pagamento no Mercado Pago
            if (process.env.MP_ACCESS_TOKEN) {
                try {
                    const response = await mercadopago.payment.get(id);
                    const mpPayment = response.body;
                    
                    console.log(`📊 Status do webhook: ${mpPayment.status}`);
                    
                    // Buscar pagamento local
                    const payment = payments.get(paymentId);
                    
                    if (payment) {
                        // Atualizar status
                        payment.status = mpPayment.status;
                        payment.status_detail = mpPayment.status_detail;
                        
                        if (mpPayment.status === 'approved') {
                            payment.approved = true;
                            payment.paid = true;
                            payment.approved_at = new Date().toISOString();
                            console.log(`✅ Webhook: Pagamento aprovado - ${paymentId}`);
                        }
                        
                        // Se for rejeitado
                        if (mpPayment.status === 'rejected') {
                            console.log(`❌ Webhook: Pagamento rejeitado - ${paymentId}`);
                        }
                    }
                    
                } catch (error) {
                    console.error('Erro no webhook MP:', error);
                }
            }
        }
        
        res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ error: 'Erro no webhook' });
    }
});

// Aprovação manual (apenas para testes em sandbox)
app.post('/api/payments/:id/approve', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`⚠️  Aprovação manual (apenas sandbox): ${paymentId}`);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Só permitir aprovação manual em sandbox
        if (!process.env.MP_ACCESS_TOKEN?.includes('TEST')) {
            return res.status(403).json({
                success: false,
                error: 'Aprovação manual só disponível em modo sandbox'
            });
        }
        
        payment.status = 'approved';
        payment.approved = true;
        payment.approved_at = new Date().toISOString();
        
        console.log(`✅ Aprovado manualmente: ${paymentId}`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'approved',
                approved: true,
                approved_at: payment.approved_at
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

// Listar pagamentos (apenas para debug)
app.get('/api/payments', (req, res) => {
    const allPayments = Array.from(payments.values()).map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        approved: p.approved,
        created: p.created_at,
        mp_id: p.mp_id
    }));
    
    res.json({
        success: true,
        count: allPayments.length,
        payments: allPayments
    });
});

// ============ ROTAS DE PÁGINAS ============

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Checkout
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Teste
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/test.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/success.html'));
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// 404 Handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>404</title></head>
        <body>
            <h1>404 - Página não encontrada</h1>
            <p><a href="/">Voltar</a></p>
        </body>
        </html>
    `);
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Erro:', err);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Erro</title></head>
        <body>
            <h1>Erro interno</h1>
            <p><a href="/">Voltar</a></p>
        </body>
        </html>
    `);
});

// Export
module.exports = app;