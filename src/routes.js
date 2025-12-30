const express = require('express');
const router = express.Router();

// ROTA SIMPLIFICADA PARA TESTE
router.post('/payments/create', async (req, res) => {
    try {
        console.log('💰 API Chamada - Criando pagamento...');
        console.log('📦 Body recebido:', req.body);
        
        const { amount } = req.body;
        
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        // SIMULAR PAGAMENTO - REMOVA DEPOIS
        console.log('🎭 Simulando pagamento mock...');
        
        const paymentId = `vercel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const amountInCents = Math.round(numericAmount * 100);
        
        // QR Code mock simples
        const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX VERCEL6008BRASILIA62070503***6304`;
        
        const response = {
            success: true,
            data: {
                paymentId: paymentId,
                qr_code: mockQrCode,
                qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                amount: numericAmount,
                description: `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
                expiration_date: new Date(Date.now() + 30 * 60000).toISOString(),
                status: 'pending',
                created_at: new Date().toISOString(),
                sandbox: true,
                mock: true
            }
        };
        
        console.log('✅ Pagamento mock criado:', paymentId);
        res.json(response);
        
    } catch (error) {
        console.error('❌ ERRO na rota /payments/create:', error);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: 'Erro ao criar pagamento',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
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