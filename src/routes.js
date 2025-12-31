const express = require('express');
const router = express.Router();
const mercadoPagoService = require('./mercadoPagoService');
const paymentStore = require('./paymentStore');

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
        
        // Armazenar no paymentStore
        const storedPayment = paymentStore.createPayment(paymentData);
        
        res.json({
            success: true,
            data: {
                paymentId: storedPayment.paymentId,
                qr_code: storedPayment.qr_code,
                qr_code_base64: storedPayment.qr_code_base64,
                amount: storedPayment.transaction_amount,
                description: description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`,
                expiration_date: storedPayment.date_of_expiration,
                status: storedPayment.status,
                created_at: storedPayment.date_created,
                sandbox: storedPayment.sandbox,
                mock: storedPayment.mock
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

// Rota de status (melhorada)
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        console.log('🔍 Verificando status:', paymentId);
        
        // Buscar do paymentStore
        const payment = paymentStore.getPayment(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Incrementar tentativas
        paymentStore.updatePayment(paymentId, { 
            attempts: (payment.attempts || 0) + 1 
        });
        
        // Se já está aprovado no store, retornar
        if (payment.approved) {
            return res.json({
                success: true,
                data: {
                    paymentId,
                    status: 'approved',
                    approved: true,
                    pending: false,
                    last_check: new Date().toISOString(),
                    approved_at: payment.approvedAt
                }
            });
        }
        
        // Verificar com Mercado Pago (para pagamentos reais)
        if (!payment.mock && !payment.sandbox) {
            const mpStatus = await mercadoPagoService.checkPaymentStatus(paymentId);
            
            if (mpStatus === 'approved') {
                paymentStore.approvePayment(paymentId);
                
                return res.json({
                    success: true,
                    data: {
                        paymentId,
                        status: 'approved',
                        approved: true,
                        pending: false,
                        last_check: new Date().toISOString(),
                        approved_at: new Date().toISOString()
                    }
                });
            }
        }
        
        // Para pagamentos mock, simular aprovação após 45 segundos
        if (payment.mock || payment.sandbox) {
            const now = new Date();
            const created = new Date(payment.createdAt || payment.date_created);
            const elapsed = now - created;
            
            // Aprovar após 45 segundos
            if (elapsed > 45000) {
                paymentStore.approvePayment(paymentId);
                
                return res.json({
                    success: true,
                    data: {
                        paymentId,
                        status: 'approved',
                        approved: true,
                        pending: false,
                        last_check: new Date().toISOString(),
                        approved_at: new Date().toISOString()
                    }
                });
            }
            
            // 30% chance de aprovar após 15 segundos
            if (elapsed > 15000 && Math.random() < 0.3) {
                paymentStore.approvePayment(paymentId);
                
                return res.json({
                    success: true,
                    data: {
                        paymentId,
                        status: 'approved',
                        approved: true,
                        pending: false,
                        last_check: new Date().toISOString(),
                        approved_at: new Date().toISOString()
                    }
                });
            }
        }
        
        // Se ainda não aprovado
        res.json({
            success: true,
            data: {
                paymentId,
                status: payment.status || 'pending',
                approved: false,
                pending: true,
                last_check: new Date().toISOString(),
                created_at: payment.createdAt || payment.date_created,
                attempts: payment.attempts || 0,
                elapsed_seconds: Math.floor((Date.now() - new Date(payment.createdAt || payment.date_created).getTime()) / 1000)
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

// Nova rota para webhook (Mercado Pago envia aqui quando pagamento é aprovado)
router.post('/payments/webhook', async (req, res) => {
    try {
        console.log('🔔 Webhook recebido:', req.body);
        
        const { data } = req.body;
        const paymentId = data?.id;
        
        if (!paymentId) {
            return res.status(400).json({ error: 'ID não fornecido' });
        }
        
        // Atualizar status no paymentStore
        const payment = paymentStore.getPayment(paymentId);
        
        if (payment) {
            paymentStore.approvePayment(paymentId);
            console.log(`✅ Webhook: Pagamento ${paymentId} aprovado`);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Rota para aprovar manualmente (para testes)
router.post('/payments/:id/approve', async (req, res) => {
    try {
        const paymentId = req.params.id;
        console.log(`👑 Aprovação manual: ${paymentId}`);
        
        const payment = paymentStore.approvePayment(paymentId);
        
        if (payment) {
            res.json({
                success: true,
                message: 'Pagamento aprovado manualmente',
                payment
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
    } catch (error) {
        console.error('Erro na aprovação manual:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

// Rota para listar todos os pagamentos (apenas para debug)
router.get('/payments', async (req, res) => {
    try {
        const payments = [];
        
        for (const [id, payment] of paymentStore.payments.entries()) {
            payments.push({
                id,
                status: payment.status,
                approved: payment.approved,
                amount: payment.transaction_amount,
                created: payment.createdAt,
                lastChecked: payment.lastChecked,
                attempts: payment.attempts || 0,
                mock: payment.mock,
                sandbox: payment.sandbox
            });
        }
        
        res.json({
            success: true,
            count: payments.length,
            payments
        });
        
    } catch (error) {
        console.error('Erro ao listar pagamentos:', error);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

module.exports = router;