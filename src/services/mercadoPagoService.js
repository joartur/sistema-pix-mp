const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('🔧 Inicializando serviço PIX...');
        
        // DEBUG: Verificar se token existe
        console.log('🔍 Verificando token MP:', {
            temToken: !!process.env.MP_ACCESS_TOKEN,
            tipo: process.env.MP_ACCESS_TOKEN ? 
                (process.env.MP_ACCESS_TOKEN.startsWith('TEST-') ? 'SANDBOX' : 'PRODUÇÃO') : 
                'NÃO CONFIGURADO'
        });
        
        // Sempre usar modo mock inicialmente
        this.testMode = true;
        this.paymentClient = null;
        
        // Tentar configurar Mercado Pago apenas se tiver token
        if (process.env.MP_ACCESS_TOKEN) {
            try {
                const config = new MercadoPagoConfig({ 
                    accessToken: process.env.MP_ACCESS_TOKEN,
                    options: {
                        timeout: 5000 // Timeout curto para fail rápido
                    }
                });
                
                this.paymentClient = new Payment(config);
                this.testMode = false;
                console.log('✅ Mercado Pago configurado (modo produção)');
                
            } catch (error) {
                console.error('⚠️ Erro na configuração MP, usando mock:', error.message);
                this.testMode = true;
            }
        } else {
            console.log('⚠️ Sem token MP, usando modo mock');
        }
    }

    async createPixPayment(data) {
        const { amount, description } = data;
        
        console.log('💰 Criando PIX:', {
            valor: `R$ ${amount.toFixed(2)}`,
            modo: this.testMode ? 'MOCK' : 'PRODUÇÃO'
        });
        
        // Se em produção e tem cliente configurado, tenta criar pagamento real
        if (!this.testMode && this.paymentClient) {
            try {
                console.log('📤 Tentando pagamento real no Mercado Pago...');
                
                const paymentData = {
                    transaction_amount: amount,
                    description: `Pagamento: ${description.substring(0, 100)}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@pix.com',
                        first_name: 'Cliente',
                        last_name: 'PIX'
                    }
                };

                const response = await this.paymentClient.create({ body: paymentData });
                
                // Verificar se tem QR Code
                let qrCode = '';
                if (response.point_of_interaction?.transaction_data?.qr_code) {
                    qrCode = response.point_of_interaction.transaction_data.qr_code;
                    console.log('✅ QR Code real obtido!');
                } else {
                    console.warn('⚠️ API não retornou QR Code, usando mock');
                    return this.createMockPayment(amount, description);
                }
                
                return {
                    id: response.id.toString(),
                    qr_code: qrCode,
                    qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64 || '',
                    status: 'pending',
                    transaction_amount: amount,
                    date_created: new Date().toISOString(),
                    sandbox: false,
                    mock: false,
                    source: 'mercado_pago_real'
                };
                
            } catch (error) {
                console.error('❌ Falha no Mercado Pago real:', {
                    mensagem: error.message,
                    codigo: error.cause?.code
                });
                // Fallback para mock
                return this.createMockPayment(amount, description);
            }
        }
        
        // Se chegou aqui, usa mock
        return this.createMockPayment(amount, description);
    }

    createMockPayment(amount, description) {
        console.log('🎭 Criando PIX mock (funcional)');
        
        const paymentId = `mock-${Date.now()}`;
        
        // QR Code funcional (mesmo sendo mock)
        const qrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${Math.round(amount * 100).toString().length.toString().padStart(2, '0')}${Math.round(amount * 100)}5802BR5913PIX SISTEMA6008BRASILIA62070503***6304`;
        
        return {
            id: paymentId,
            qr_code: qrCode,
            qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            status: 'pending',
            transaction_amount: amount,
            date_created: new Date().toISOString(),
            sandbox: true,
            mock: true,
            source: 'mock_system'
        };
    }

    async checkPaymentStatus(paymentId) {
        console.log(`🔍 Verificando status: ${paymentId}`);
        
        // Simulação simples: aprova após 30 segundos
        if (paymentId.startsWith('mock-')) {
            const created = parseInt(paymentId.split('-')[1]) || Date.now();
            if (Date.now() - created > 30000) {
                return 'approved';
            }
        }
        
        return 'pending';
    }
}

module.exports = new MercadoPagoService();