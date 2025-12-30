const express = require('express');
const router = express.Router();
const mercadoPagoService = require('./services/mercadoPagoService');

// Rota para criar pagamento PIX com valor personalizado
router.post('/payments/create', async (req, res) => {
    console.log('='.repeat(60));
    console.log('💰 NOVA SOLICITAÇÃO DE PAGAMENTO');
    console.log('='.repeat(60));
    
    try {
        const { amount, description, customerEmail, customerName } = req.body;
        
        console.log('📊 Dados recebidos:', {
            amount,
            description: description?.substring(0, 50),
            hasEmail: !!customerEmail,
            hasName: !!customerName,
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });
        
        // Validar valor
        if (!amount || isNaN(parseFloat(amount))) {
            console.error('❌ VALOR INVÁLIDO:', amount);
            return res.status(400).json({
                success: false,
                error: 'Valor inválido. Digite um número válido (ex: 10.50).'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        // Validar limites
        if (numericAmount < 0.01) {
            console.error('❌ VALOR MUITO BAIXO:', numericAmount);
            return res.status(400).json({
                success: false,
                error: 'Valor mínimo é R$ 0,01'
            });
        }
        
        if (numericAmount > 99999999999.99) {
            console.error('❌ VALOR MUITO ALTO:', numericAmount);
            return res.status(400).json({
                success: false,
                error: 'Valor máximo é R$ 99.999.999.999,99'
            });
        }
        
        // Descrição padrão
        const paymentDescription = description || `Pagamento PIX de R$ ${numericAmount.toFixed(2).replace('.', ',')}`;
        
        console.log('✅ Validações passadas. Criando pagamento...');
        
        // Criar pagamento
        const paymentData = await mercadoPagoService.createPixPayment({
            amount: numericAmount,
            description: paymentDescription,
            email: customerEmail || 'pagador@pix.com',
            name: customerName || 'Pagador'
        });
        
        console.log('🎉 Pagamento criado com sucesso:', {
            id: paymentData.id,
            amount: paymentData.transaction_amount,
            status: paymentData.status,
            mock: paymentData.mock
        });
        
        // Resposta de sucesso
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
                mock: paymentData.mock,
                message: paymentData.mock 
                    ? 'Modo demonstração - QR Code para testes' 
                    : 'Pagamento real criado no Mercado Pago'
            }
        });
        
        console.log('✅ Resposta enviada ao cliente');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('='.repeat(60));
        console.error('❌ ERRO CRÍTICO NA CRIAÇÃO DE PAGAMENTO');
        console.error('='.repeat(60));
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Timestamp:', new Date().toISOString());
        
        // Resposta de erro amigável
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pagamento',
            message: 'Não foi possível criar o pagamento no momento. Tente novamente.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            support: 'Entre em contato com o suporte se o problema persistir.'
        });
    }
});

// Rota para verificar status
router.get('/payments/:id/status', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        console.log(`🔍 Verificando status: ${paymentId}`);
        
        const status = await mercadoPagoService.checkPaymentStatus(paymentId);
        
        // Resposta consistente
        res.json({
            success: true,
            data: {
                paymentId,
                status: status,
                approved: status === 'approved',
                pending: status === 'pending',
                cancelled: status === 'cancelled',
                last_check: new Date().toISOString(),
                timestamp: Date.now()
            }
        });
        
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        
        // Em caso de erro, retornar pending para continuar tentando
        res.json({
            success: true,
            data: {
                paymentId: req.params.id,
                status: 'pending',
                approved: false,
                pending: true,
                error: true,
                last_check: new Date().toISOString()
            }
        });
    }
});

// Rota para teste do sistema
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        mercadoPago: {
            configured: !!process.env.MP_ACCESS_TOKEN,
            mode: process.env.MP_ACCESS_TOKEN?.startsWith('TEST-') ? 'sandbox' : 'production',
            working: true
        },
        system: {
            version: '1.0.0',
            uptime: process.uptime()
        }
    });
});

// Rota para debug
router.get('/debug', (req, res) => {
    const debugInfo = {
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        envVars: {
            hasMPToken: !!process.env.MP_ACCESS_TOKEN,
            tokenLength: process.env.MP_ACCESS_TOKEN?.length || 0,
            tokenPrefix: process.env.MP_ACCESS_TOKEN?.substring(0, 10) || 'none',
            baseUrl: process.env.BASE_URL,
            frontendUrl: process.env.FRONTEND_URL
        },
        timestamp: new Date().toISOString()
    };
    
    console.log('🔍 Debug info:', debugInfo);
    
    res.json({
        success: true,
        debug: debugInfo
    });
});

module.exports = router;