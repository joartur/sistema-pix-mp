const express = require('express');
const router = express.Router();

// Store em memória para pagamentos (simplificado)
const payments = new Map();

// Função para atualizar status do pagamento
function updatePaymentStatus(paymentId, status) {
    const payment = payments.get(paymentId);
    if (payment) {
        payment.status = status;
        payment.updatedAt = new Date();
        if (status === 'approved') {
            payment.approved = true;
            payment.approvedAt = new Date();
        }
        console.log(`✅ Status atualizado: ${paymentId} -> ${status}`);
        return payment;
    }
    return null;
}

// Webhook do Mercado Pago
router.post('/payments/webhook', async (req, res) => {
    try {
        console.log('🔔 Webhook recebido:', JSON.stringify(req.body, null, 2));
        
        const { type, data } = req.body;
        
        if (!data || !data.id) {
            console.warn('⚠️  Webhook sem ID válido');
            return res.status(400).json({ error: 'ID não fornecido' });
        }
        
        const paymentId = data.id;
        console.log(`📦 ID do pagamento: ${paymentId}`);
        
        if (type === 'payment') {
            // Em uma implementação real, você buscaria os detalhes do pagamento
            // Aqui vamos apenas simular a aprovação
            updatePaymentStatus(paymentId, 'approved');
            
            console.log(`🎉 Pagamento ${paymentId} processado via webhook`);
            
            return res.json({ 
                success: true, 
                message: 'Webhook processado com sucesso',
                paymentId,
                status: 'approved'
            });
        }
        
        console.log(`ℹ️  Tipo de webhook não processado: ${type}`);
        res.json({ success: true, message: 'Webhook recebido' });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ 
            error: 'Erro interno no webhook',
            message: error.message 
        });
    }
});

// Webhook de teste
router.post('/payments/webhook/test', async (req, res) => {
    try {
        console.log('🧪 Webhook de teste recebido');
        
        const { paymentId, action } = req.body;
        
        if (!paymentId) {
            return res.status(400).json({ 
                error: 'paymentId é obrigatório' 
            });
        }
        
        // Simular diferentes ações
        switch (action) {
            case 'approve':
                updatePaymentStatus(paymentId, 'approved');
                break;
            case 'reject':
                updatePaymentStatus(paymentId, 'rejected');
                break;
            case 'pending':
                updatePaymentStatus(paymentId, 'pending');
                break;
            default:
                updatePaymentStatus(paymentId, 'approved');
        }
        
        res.json({
            success: true,
            message: `Pagamento ${paymentId} ${action || 'approved'} via webhook`,
            paymentId,
            status: action || 'approved'
        });
        
    } catch (error) {
        console.error('❌ Erro no webhook de teste:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Verificar status via webhook (para polling do frontend)
router.get('/payments/webhook/status/:id', (req, res) => {
    try {
        const paymentId = req.params.id;
        console.log(`🔍 Verificando status via webhook: ${paymentId}`);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado',
                paymentId
            });
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: payment.status || 'pending',
                approved: payment.approved || false,
                pending: !payment.approved,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                approvedAt: payment.approvedAt,
                via_webhook: true
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Listar todos os pagamentos (apenas para debug)
router.get('/payments/webhook/all', (req, res) => {
    try {
        const allPayments = [];
        
        for (const [id, payment] of payments.entries()) {
            allPayments.push({
                id,
                status: payment.status,
                approved: payment.approved || false,
                amount: payment.amount,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                approvedAt: payment.approvedAt
            });
        }
        
        res.json({
            success: true,
            count: allPayments.length,
            payments: allPayments
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar pagamentos:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Criar pagamento de teste
router.post('/payments/webhook/create-test', (req, res) => {
    try {
        const { amount, description } = req.body;
        
        const paymentId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const payment = {
            paymentId,
            amount: amount || 10.00,
            description: description || 'Pagamento de teste',
            status: 'pending',
            approved: false,
            createdAt: new Date(),
            sandbox: true,
            mock: true
        };
        
        payments.set(paymentId, payment);
        
        console.log(`🧪 Pagamento de teste criado: ${paymentId}`);
        
        res.json({
            success: true,
            data: payment,
            webhook_urls: {
                test_approve: `/api/payments/webhook/test`,
                check_status: `/api/payments/webhook/status/${paymentId}`
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar teste:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Limpar todos os pagamentos (apenas para debug/testes)
router.delete('/payments/webhook/clear', (req, res) => {
    try {
        const count = payments.size;
        payments.clear();
        
        console.log(`🧹 Limpados ${count} pagamentos`);
        
        res.json({
            success: true,
            message: `Limpos ${count} pagamentos`,
            count
        });
        
    } catch (error) {
        console.error('❌ Erro ao limpar:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;