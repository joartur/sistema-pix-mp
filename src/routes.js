const express = require('express');
const router = express.Router();
const mercadoPagoService = require('./services/mercadoPagoService');


// Rota para criar pagamento PIX
router.post('/payments/create', async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('💰 Criando pagamento PIX:', {
            amount,
            description: description?.substring(0, 50)
        });
        
        // Validação do valor
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
        
        if (numericAmount > 99999999999.99) {
            return res.status(400).json({
                success: false,
                error: 'Valor máximo é R$ 99.999.999.999,99'
            });
        }
        
        // Usar o serviço do Mercado Pago
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
            email: customerEmail || 'pagador@pix.com',
            name: customerName || 'Pagador'
        });
        
        console.log('✅ Pagamento criado com sucesso:', paymentData.id);
        
        res.json({
            success: true,
            data: {
                paymentId: paymentData.id,
                qr_code: paymentData.qr_code,
                qr_code_base64: paymentData.qr_code_base64,
                amount: paymentData.transaction_amount,
                description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
                expiration_date: paymentData.date_of_expiration,
                status: paymentData.status,
                created_at: paymentData.date_created,
                sandbox: paymentData.sandbox,
                mock: paymentData.mock
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao processar pagamento'
        });
    }
});

// Rota de status
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        console.log('🔍 Verificando status:', paymentId);
        
        // Simular status
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'pending',
                approved: false,
                pending: true,
                last_check: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Erro no status:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar status' });
    }
});

// Rota de teste
router.get('/debug', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando no Vercel!',
        environment: process.env.NODE_ENV || 'development',
        vercel: process.env.VERCEL === '1',
        node_version: process.version,
        timestamp: new Date().toISOString(),
        endpoints: {
            create_payment: 'POST /api/payments/create',
            check_status: 'GET /api/payments/:id/status',
            health: 'GET /health',
            test: 'GET /api/test'
        }
    });
});

module.exports = router;