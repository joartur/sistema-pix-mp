const express = require('express');
const router = express.Router();
const mercadoPagoService = require('./services/mercadoPagoService');

// ============================================
// ROTAS SIMPLIFICADAS - SEM PRODUTOS FIXOS
// ============================================

// Rota para criar pagamento PIX com valor personalizado
router.post('/payments/create', async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('💰 Criando pagamento PIX personalizado...');
        console.log('📊 Dados recebidos:', {
            amount,
            description: description?.substring(0, 50),
            email: customerEmail?.substring(0, 20),
            name: customerName?.substring(0, 20)
        });
        
        // Validar valor
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido. Digite um número válido.'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        // Validar limites (R$ 0,01 a R$ 99.999.999.999,99)
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
        
        // Descrição padrão se não for fornecida
        const paymentDescription = description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`;
        
        // Usar serviço do Mercado Pago
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: paymentDescription,
            email: customerEmail || 'pagador@pix.com',
            name: customerName || 'Pagador'
        });
        
        console.log('✅ Pagamento criado:', {
            id: paymentData.id,
            amount: paymentData.transaction_amount,
            status: paymentData.status
        });
        
        res.json({
            success: true,
            data: {
                paymentId: paymentData.id,
                qr_code: paymentData.qr_code,
                qr_code_base64: paymentData.qr_code_base64,
                amount: paymentData.transaction_amount,
                description: paymentDescription,
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
            error: 'Erro ao processar pagamento',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota para verificar status do pagamento
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`🔍 Verificando status: ${paymentId}`);
        
        const status = await mercadoPagoService.checkPaymentStatus(paymentId);
        
        // Para mocks, nunca cancelar
        let finalStatus = status;
        if (paymentId.startsWith('mock-')) {
            if (status === 'cancelled' || status === 'rejected') {
                finalStatus = 'pending';
            }
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: finalStatus,
                approved: finalStatus === 'approved',
                pending: finalStatus === 'pending',
                last_check: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status do pagamento'
        });
    }
});

// Rota para testar o sistema
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Sistema PIX funcionando!',
        endpoints: {
            create_payment: 'POST /api/payments/create',
            check_status: 'GET /api/payments/:id/status',
            test_qrcode: 'GET /api/test/qrcode'
        },
        limits: {
            min_value: 'R$ 0,01',
            max_value: 'R$ 99.999.999.999,99'
        }
    });
});

// Rota para gerar QR Code de teste
router.get('/test/qrcode', (req, res) => {
    const testAmount = req.query.amount || 10.00;
    const testCode = `00020101021226890014br.gov.bcb.pix2561qrcodepix.com.br/qr/v2/TESTE${Date.now()}52040000530398654${testAmount.toString().length.toString().padStart(2, '0')}${Math.round(testAmount * 100)}5802BR5913TESTE PIX6008BRASILIA62070503***6304`;
    
    res.json({
        success: true,
        test: true,
        data: {
            paymentId: 'test-' + Date.now(),
            qr_code: testCode,
            amount: parseFloat(testAmount),
            description: 'Pagamento de teste - R$ ' + parseFloat(testAmount).toFixed(2)
        }
    });
});

module.exports = router;