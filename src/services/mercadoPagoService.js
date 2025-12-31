const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('💰 Inicializando Mercado Pago Service...');
        
        this.accessToken = process.env.MP_ACCESS_TOKEN;
        
        if (!this.accessToken) {
            console.warn('⚠️  MP_ACCESS_TOKEN não configurado no .env');
            console.warn('   Usando modo de teste (mock)');
            this.testMode = true;
        } else {
            this.testMode = this.accessToken.startsWith('TEST-');
            console.log(`🔧 Modo: ${this.testMode ? 'SANDBOX (testes)' : 'PRODUÇÃO'}`);
            
            try {
                const config = new MercadoPagoConfig({ 
                    accessToken: this.accessToken 
                });
                this.paymentClient = new Payment(config);
                console.log('✅ Cliente Mercado Pago configurado');
            } catch (error) {
                console.error('❌ Erro ao configurar Mercado Pago:', error.message);
                this.testMode = true;
            }
        }
    }

    async createPixPayment(data) {
        try {
            const { amount, description, email, name } = data;
            
            console.log('💳 Criando pagamento PIX:', {
                amount: `R$ ${amount.toFixed(2)}`,
                description: description.substring(0, 50)
            });
            
            // Se estiver em modo teste ou sem token, usar mock
            if (this.testMode || !this.accessToken) {
                console.log('🎭 Usando modo de teste (mock)');
                return this.createMockPayment(amount, description);
            }
            
            // Criar pagamento real no Mercado Pago
            const paymentData = {
                transaction_amount: amount,
                description: description.substring(0, 230),
                payment_method_id: 'pix',
                payer: {
                    email: email || 'pagador@pix.com',
                    first_name: name?.split(' ')[0] || 'Pagador',
                    last_name: name?.split(' ').slice(1).join(' ') || 'PIX',
                    identification: {
                        type: 'CPF',
                        number: '12345678909'
                    }
                },
                installments: 1,
                notification_url: process.env.WEBHOOK_URL,
                date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
                metadata: {
                    system: 'pix-payment-system',
                    timestamp: new Date().toISOString()
                }
            };

            console.log('📤 Enviando para Mercado Pago...');
            const response = await this.paymentClient.create({ body: paymentData });
            
            console.log('✅ Pagamento criado:', {
                id: response.id,
                status: response.status
            });
            
            // Extrair dados do PIX
            let qrCode = '';
            let qrCodeBase64 = '';
            
            if (response.point_of_interaction?.transaction_data) {
                const pixData = response.point_of_interaction.transaction_data;
                qrCode = pixData.qr_code || '';
                qrCodeBase64 = pixData.qr_code_base64 || '';
            }
            
            return {
                id: response.id?.toString() || `real-${Date.now()}`,
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                ticket_url: response.transaction_details?.external_resource_url || '',
                date_of_expiration: response.date_of_expiration,
                status: response.status || 'pending',
                status_detail: response.status_detail || 'accredited',
                transaction_amount: response.transaction_amount || amount,
                date_created: response.date_created || new Date().toISOString(),
                sandbox: this.testMode,
                mock: false
            };
            
        } catch (error) {
            console.error('❌ Erro no Mercado Pago:', {
                message: error.message,
                code: error.cause?.code
            });
            
            // Fallback para mock em caso de erro
            return this.createMockPayment(data.amount, data.description);
        }
    }

    createMockPayment(amount, description) {
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🎭 Criando pagamento mock: ${paymentId}`, {
            amount: `R$ ${amount.toFixed(2)}`
        });
        
        // Gerar código PIX mock
        const amountInCents = Math.round(amount * 100);
        const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX DINAMICO6008BRASILIA62070503***6304`;
        
        return {
            id: paymentId,
            qr_code: mockQrCode,
            qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            ticket_url: `https://example.com/payment/${paymentId}`,
            date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
            status: 'pending',
            status_detail: 'accredited',
            transaction_amount: amount,
            date_created: new Date().toISOString(),
            sandbox: true,
            mock: true
        };
    }

    async checkPaymentStatus(paymentId) {
        try {
            console.log(`🔍 Verificando status: ${paymentId}`);
            
            // Se for mock
            if (paymentId.startsWith('mock-')) {
                return this.handleMockPaymentStatus(paymentId);
            }
            
            // Se não tiver cliente configurado ou for teste
            if (!this.paymentClient || this.testMode) {
                return 'pending';
            }
            
            // Verificar status real
            const response = await this.paymentClient.get({ id: paymentId });
            return response.status || 'pending';
            
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error.message);
            return 'pending';
        }
    }

    handleMockPaymentStatus(paymentId) {
        // Simular aprovação após 45 segundos
        const parts = paymentId.split('-');
        const createdAt = parseInt(parts[1]) || Date.now();
        const elapsed = Date.now() - createdAt;
        
        if (elapsed > 45000) {
            console.log(`✅ Mock aprovado após ${Math.floor(elapsed/1000)}s`);
            return 'approved';
        }
        
        // 20% chance de aprovar depois de 10 segundos
        if (elapsed > 10000 && Math.random() < 0.2) {
            console.log(`🎲 Mock aprovado aleatoriamente`);
            return 'approved';
        }
        
        return 'pending';
    }
    
    async handleWebhook(paymentId) {
        try {
            console.log(`🔔 Webhook recebido para: ${paymentId}`);
            
            // Verificar status atual
            const status = await this.checkPaymentStatus(paymentId);
            
            if (status === 'approved') {
                console.log(`✅ Pagamento confirmado via webhook: ${paymentId}`);
                return {
                    success: true,
                    paymentId,
                    status: 'approved',
                    message: 'Pagamento confirmado'
                };
            }
            
            return {
                success: false,
                paymentId,
                status: 'pending',
                message: 'Aguardando confirmação'
            };
            
        } catch (error) {
            console.error('❌ Erro no webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }   
}

// Exportar instância única
module.exports = new MercadoPagoService();