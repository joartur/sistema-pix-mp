const express = require('express');
const router = express.Router();

// Simular o serviço (para evitar erros de import)
const mercadoPagoService = {
    createPixPayment: async (data) => {
        console.log('🎭 Criando pagamento mock:', data);
        
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Gerar código PIX mock
        const amountInCents = Math.round(data.amount * 100);
        const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX DINAMICO6008BRASILIA62070503***6304`;
        
        return {
            id: paymentId,
            qr_code: mockQrCode,
            qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            transaction_amount: data.amount,
            date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
            status: 'pending',
            date_created: new Date().toISOString(),
            sandbox: true,
            mock: true
        };
    }
};

// Store em memória
const payments = new Map();

// Rota para criar pagamento PIX
router.post('/payments/create', async (req, res) => {
    try {
        const { amount, description } = req.body;
        
        console.log('💰 Criando pagamento PIX:', { amount });
        
        // Validação simples
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
        
        // Criar pagamento
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`
        });
        
        // Armazenar
        payments.set(paymentData.id, {
            ...paymentData,
            paymentId: paymentData.id,
            status: 'pending',
            approved: false,
            createdAt: new Date()
        });
        
        console.log('✅ Pagamento criado:', paymentData.id);
        
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
            error: 'Erro ao processar pagamento: ' + error.message
        });
    }
});

// Rota de status
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log('🔍 Verificando status:', paymentId);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Simular aprovação após 30 segundos
        const elapsed = Date.now() - new Date(payment.createdAt).getTime();
        const approved = elapsed > 30000; // 30 segundos
        
        if (approved && !payment.approved) {
            payment.approved = true;
            payment.status = 'approved';
            console.log(`✅ Pagamento aprovado: ${paymentId}`);
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: payment.status,
                approved: payment.approved,
                pending: !payment.approved,
                last_check: new Date().toISOString(),
                created_at: payment.createdAt,
                elapsed_seconds: Math.floor(elapsed / 1000)
            }
        });
        
    } catch (error) {
        console.error('Erro no status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao verificar status' 
        });
    }
});

// Rota de debug
router.get('/debug', (req, res) => {
    res.json({
        success: true,
        message: 'API de pagamentos funcionando!',
        payments_count: payments.size,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;