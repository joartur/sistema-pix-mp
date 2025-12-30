const express = require('express');
const router = express.Router();

router.post('/payments/create', async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('='.repeat(60));
        console.log('🔄 INICIANDO CRIAÇÃO DE PAGAMENTO');
        console.log('='.repeat(60));
        console.log('📦 Dados recebidos:', {
            amount,
            description: description?.substring(0, 50),
            email: customerEmail?.substring(0, 20),
            name: customerName?.substring(0, 20),
            timestamp: new Date().toISOString()
        });
        
        // Validar valor
        if (!amount || isNaN(parseFloat(amount))) {
            console.error('❌ Erro: Valor inválido');
            return res.status(400).json({
                success: false,
                error: 'Valor inválido. Digite um número válido.'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        if (numericAmount < 0.01) {
            console.error('❌ Erro: Valor abaixo do mínimo');
            return res.status(400).json({
                success: false,
                error: 'Valor mínimo é R$ 0,01'
            });
        }
        
        if (numericAmount > 99999999999.99) {
            console.error('❌ Erro: Valor acima do máximo');
            return res.status(400).json({
                success: false,
                error: 'Valor máximo é R$ 99.999.999.999,99'
            });
        }
        
        console.log('✅ Validação passada:', {
            valor: `R$ ${numericAmount.toFixed(2)}`,
            formatado: numericAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        });
        
        // Descrição padrão
        const paymentDescription = description || `Pagamento PIX de R$ ${numericAmount.toFixed(2)}`;
        
        // Criar pagamento
        console.log('📤 Chamando serviço Mercado Pago...');
        const startTime = Date.now();
        
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: paymentDescription,
            email: customerEmail || 'pagador@exemplo.com',
            name: customerName || 'Pagador'
        });
        
        const elapsedTime = Date.now() - startTime;
        
        console.log('✅ Pagamento criado em', elapsedTime, 'ms:', {
            id: paymentData.id,
            amount: paymentData.transaction_amount,
            status: paymentData.status,
            sandbox: paymentData.sandbox,
            mock: paymentData.mock,
            hasQRCode: !!paymentData.qr_code,
            qrCodeLength: paymentData.qr_code?.length
        });
        
        const responseData = {
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
        };
        
        console.log('📨 Enviando resposta para cliente');
        console.log('='.repeat(60));
        console.log('✅ CRIAÇÃO DE PAGAMENTO FINALIZADA');
        console.log('='.repeat(60));
        
        res.json(responseData);
        
    } catch (error) {
        console.error('='.repeat(60));
        console.error('❌ ERRO CRÍTICO NA CRIAÇÃO DE PAGAMENTO');
        console.error('='.repeat(60));
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Timestamp:', new Date().toISOString());
        
        // Em produção, não expor detalhes do erro
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? 'Erro ao processar pagamento. Tente novamente.' 
            : error.message;
        
        res.status(500).json({
            success: false,
            error: errorMessage
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