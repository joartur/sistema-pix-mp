const express = require('express');
const router = express.Router();

// Store compartilhado (em produção, use um banco de dados)
const payments = new Map();

// Função auxiliar para criar pagamento
async function createMockPixPayment(data) {
    const paymentId = `pix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const amount = parseFloat(data.amount);
    
    console.log(`🎭 Criando pagamento mock: ${paymentId}`, {
        amount: `R$ ${amount.toFixed(2)}`,
        description: data.description?.substring(0, 50) || 'Pagamento PIX'
    });
    
    // Gerar código PIX mock (formato simplificado)
    const amountInCents = Math.round(amount * 100);
    const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX DINAMICO6008BRASILIA62070503***6304`;
    
    const payment = {
        id: paymentId,
        paymentId: paymentId,
        qr_code: mockQrCode,
        qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        transaction_amount: amount,
        description: data.description || `Pagamento PIX de R$ ${amount.toFixed(2)}`,
        date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
        status: 'pending',
        approved: false,
        created_at: new Date().toISOString(),
        createdAt: new Date(),
        sandbox: true,
        mock: true,
        customer_email: data.email || 'pagador@pix.com',
        customer_name: data.name || 'Pagador'
    };
    
    // Armazenar
    payments.set(paymentId, payment);
    
    return payment;
}

// Rota para criar pagamento PIX
router.post('/payments/create', async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('💰 Recebendo requisição de pagamento:', {
            amount,
            description: description?.substring(0, 50),
            customerEmail,
            customerName
        });
        
        // Validação
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido. Use um número válido (ex: 10.00)'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        if (numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                error: 'Valor mínimo é R$ 0,01'
            });
        }
        
        if (numericAmount > 999999.99) {
            return res.status(400).json({
                success: false,
                error: 'Valor máximo é R$ 999.999,99'
            });
        }
        
        // Criar pagamento
        const paymentData = await createMockPixPayment({
            amount: numericAmount,
            description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
            email: customerEmail,
            name: customerName
        });
        
        console.log(`✅ Pagamento criado com sucesso: ${paymentData.paymentId}`);
        
        res.json({
            success: true,
            data: {
                paymentId: paymentData.paymentId,
                qr_code: paymentData.qr_code,
                qr_code_base64: paymentData.qr_code_base64,
                amount: paymentData.transaction_amount,
                description: paymentData.description,
                expiration_date: paymentData.date_of_expiration,
                status: paymentData.status,
                created_at: paymentData.created_at,
                sandbox: paymentData.sandbox,
                mock: paymentData.mock,
                webhook_test_url: `/api/payments/webhook/test`
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno: ' + error.message
        });
    }
});

// Rota de status
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`🔍 Verificando status do pagamento: ${paymentId}`);
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado',
                paymentId
            });
        }
        
        // Verificar se já passou tempo suficiente para aprovar automaticamente
        const now = new Date();
        const created = new Date(payment.createdAt || payment.created_at);
        const elapsedSeconds = Math.floor((now - created) / 1000);
        
        let approved = payment.approved || false;
        let status = payment.status || 'pending';
        
        // Aprovar automaticamente após 45 segundos (para demonstração)
        if (!approved && elapsedSeconds > 45) {
            approved = true;
            status = 'approved';
            payment.approved = true;
            payment.status = 'approved';
            payment.approvedAt = now;
            console.log(`⏱️  Pagamento aprovado automaticamente após ${elapsedSeconds}s`);
        }
        
        // 20% chance de aprovar após 15 segundos (para testes mais rápidos)
        if (!approved && elapsedSeconds > 15 && Math.random() < 0.2) {
            approved = true;
            status = 'approved';
            payment.approved = true;
            payment.status = 'approved';
            payment.approvedAt = now;
            console.log(`🎲 Pagamento aprovado aleatoriamente após ${elapsedSeconds}s`);
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status,
                approved,
                pending: !approved,
                amount: payment.transaction_amount,
                description: payment.description,
                created_at: payment.created_at,
                elapsed_seconds: elapsedSeconds,
                last_check: now.toISOString(),
                webhook_available: true,
                can_test_webhook: payment.mock
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao verificar status: ' + error.message 
        });
    }
});

// Rota para aprovar manualmente (para testes)
router.post('/payments/:id/approve', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`👑 Aprovação manual solicitada: ${paymentId}`);
        
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
        
        console.log(`✅ Pagamento ${paymentId} aprovado manualmente`);
        
        res.json({
            success: true,
            message: 'Pagamento aprovado com sucesso',
            data: {
                paymentId,
                status: 'approved',
                approved: true,
                approved_at: payment.approvedAt
            }
        });
        
    } catch (error) {
        console.error('❌ Erro na aprovação manual:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno' 
        });
    }
});

// Listar todos os pagamentos (apenas para debug)
router.get('/payments', async (req, res) => {
    try {
        const allPayments = [];
        
        for (const [id, payment] of payments.entries()) {
            allPayments.push({
                id,
                paymentId: payment.paymentId,
                amount: payment.transaction_amount,
                status: payment.status,
                approved: payment.approved || false,
                created: payment.createdAt || payment.created_at,
                approvedAt: payment.approvedAt,
                mock: payment.mock || false,
                sandbox: payment.sandbox || true
            });
        }
        
        res.json({
            success: true,
            count: allPayments.length,
            payments: allPayments
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar pagamentos:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

module.exports = router;