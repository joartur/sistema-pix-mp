const express = require('express');
const router = express.Router();

router.post('/payments/create', async (req, res) => {
    console.log('='.repeat(80));
    console.log('🔄 API: /payments/create CHAMADA');
    console.log('='.repeat(80));
    
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('📦 REQUEST BODY:', JSON.stringify(req.body, null, 2));
        console.log('🔍 Headers:', req.headers);
        
        // Debug: Verifique se o body está chegando
        console.log('✅ Body recebido:', {
            amount: amount,
            tipoAmount: typeof amount,
            email: customerEmail,
            name: customerName
        });
        
        // Validação SIMPLES primeiro
        if (!amount) {
            console.error('❌ Erro: amount não fornecido');
            return res.json({
                success: false,
                error: 'Valor não fornecido'
            });
        }
        
        const numericAmount = parseFloat(amount);
        console.log('💰 Valor convertido:', numericAmount);
        
        if (isNaN(numericAmount)) {
            console.error('❌ Erro: amount não é número');
            return res.json({
                success: false,
                error: 'Valor inválido. Digite um número válido.'
            });
        }
        
        // Verificar token do Mercado Pago
        console.log('🔑 Verificando MP_ACCESS_TOKEN:', {
            temToken: !!process.env.MP_ACCESS_TOKEN,
            tokenIniciaCom: process.env.MP_ACCESS_TOKEN?.substring(0, 10) + '...',
            length: process.env.MP_ACCESS_TOKEN?.length
        });
        
        // Criar descrição
        const paymentDescription = description || `PIX de R$ ${numericAmount.toFixed(2)}`;
        
        console.log('📤 Chamando MercadoPagoService...');
        const startTime = Date.now();
        
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: paymentDescription,
            email: customerEmail || 'pagador@exemplo.com',
            name: customerName || 'Pagador'
        });
        
        console.log('✅ MercadoPagoService retornou em', Date.now() - startTime, 'ms');
        console.log('📊 Dados retornados:', {
            id: paymentData.id,
            status: paymentData.status,
            mock: paymentData.mock,
            hasQRCode: !!paymentData.qr_code,
            qrCodeLength: paymentData.qr_code?.length
        });
        
        // Resposta SIMPLES para testar
        res.json({
            success: true,
            data: {
                paymentId: paymentData.id,
                qr_code: paymentData.qr_code || 'QR_CODE_TESTE_123',
                amount: paymentData.transaction_amount || numericAmount,
                status: paymentData.status || 'pending',
                mock: paymentData.mock || true,
                sandbox: paymentData.sandbox || true
            }
        });
        
        console.log('✅ Resposta enviada com sucesso');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('='.repeat(80));
        console.error('🔥 ERRO CRÍTICO CAPTURADO:');
        console.error('📌 Mensagem:', error.message);
        console.error('📌 Stack:', error.stack);
        console.error('📌 Tipo:', typeof error);
        console.error('📌 Timestamp:', new Date().toISOString());
        console.error('='.repeat(80));
        
        // Resposta de erro com detalhes para debug
        res.json({
            success: false,
            error: 'Erro interno: ' + error.message,
            debug: process.env.NODE_ENV === 'production' ? undefined : {
                stack: error.stack,
                type: typeof error
            }
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