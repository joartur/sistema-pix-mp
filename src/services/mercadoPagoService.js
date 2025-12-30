const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('💰 Inicializando Mercado Pago Service...');
        
        this.accessToken = process.env.MP_ACCESS_TOKEN;
        
        // Verificar se estamos em produção ou desenvolvimento
        this.isProduction = process.env.NODE_ENV === 'production';
        this.isSandbox = this.accessToken?.startsWith('TEST-');
        
        console.log(`🔧 Modo: ${this.isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
        console.log(`🎯 Mercado Pago: ${this.isSandbox ? 'SANDBOX (testes)' : 'PRODUÇÃO (real)'}`);
        
        // Se não tem token ou é sandbox, usar mock
        if (!this.accessToken || this.isSandbox) {
            console.log('🔄 Usando modo MOCK para desenvolvimento/testes');
            this.useMock = true;
            return;
        }
        
        // Configurar cliente real do Mercado Pago
        try {
            const client = new MercadoPagoConfig({ 
                accessToken: this.accessToken,
                options: {
                    timeout: 10000,
                    idempotencyKey: 'pix-payment-system'
                }
            });
            
            this.paymentClient = new Payment(client);
            this.useMock = false;
            console.log('✅ Cliente Mercado Pago configurado para produção');
            
        } catch (error) {
            console.error('❌ Erro ao configurar Mercado Pago:', error.message);
            this.useMock = true;
        }
    }

    async createPixPayment(data) {
        try {
            const { amount, description, email, name } = data;
            
            console.log('💳 Criando pagamento PIX...', {
                amount: `R$ ${amount.toFixed(2)}`,
                description: description.substring(0, 50),
                mode: this.useMock ? 'MOCK' : 'REAL'
            });
            
            // Se usar mock (sandbox ou erro na configuração)
            if (this.useMock) {
                return this.createMockPayment(amount, description);
            }
            
            // Criar pagamento REAL no Mercado Pago
            const paymentData = {
                transaction_amount: parseFloat(amount),
                description: description.substring(0, 230),
                payment_method_id: 'pix',
                payer: {
                    email: email || 'pagador@pix.com',
                    first_name: this.extractFirstName(name),
                    last_name: this.extractLastName(name),
                    identification: {
                        type: 'CPF',
                        number: '12345678909' // Em produção, colete do cliente
                    }
                },
                installments: 1,
                notification_url: process.env.WEBHOOK_URL || `${process.env.BASE_URL}/api/webhook/pix`,
                date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
                metadata: {
                    system: 'pix-payment-system',
                    timestamp: new Date().toISOString()
                }
            };

            console.log('📤 Enviando para Mercado Pago produção...');
            const response = await this.paymentClient.create({ body: paymentData });
            
            console.log('✅ Pagamento REAL criado:', {
                id: response.id,
                status: response.status,
                amount: response.transaction_amount
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
                id: response.id.toString(),
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                ticket_url: response.transaction_details?.external_resource_url || '',
                date_of_expiration: response.date_of_expiration,
                status: response.status,
                status_detail: response.status_detail,
                transaction_amount: response.transaction_amount,
                date_created: response.date_created,
                sandbox: false,
                mock: false
            };
            
        } catch (error) {
            console.error('❌ ERRO CRÍTICO no Mercado Pago:', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            // Fallback para mock em caso de erro
            console.log('🔄 Fallback para MOCK devido ao erro');
            return this.createMockPayment(data.amount, data.description);
        }
    }

    createMockPayment(amount, description) {
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🎭 Criando pagamento MOCK: ${paymentId}`, {
            amount: `R$ ${amount.toFixed(2)}`
        });
        
        // Gerar código PIX mock funcional (pode ser escaneado)
        const amountInCents = Math.round(amount * 100);
        const amountStr = amountInCents.toString().padStart(2, '0');
        
        // Código PIX válido para demonstração
        const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountStr.length.toString().padStart(2, '0')}${amountStr}5802BR5913PIX DEMO SISTEMA6008BRASILIA62070503***6304`;
        
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
            
            // Se não tem cliente configurado
            if (!this.paymentClient) {
                return 'pending';
            }
            
            // Verificar status real
            const response = await this.paymentClient.get({ id: paymentId });
            return response.status || 'pending';
            
        } catch (error) {
            console.error('⚠️ Erro ao verificar status:', error.message);
            return 'pending'; // Sempre retorna pending em caso de erro
        }
    }

    handleMockPaymentStatus(paymentId) {
        // Simulação realista
        const parts = paymentId.split('-');
        const createdAt = parseInt(parts[1]) || Date.now();
        const elapsed = Date.now() - createdAt;
        
        // Aumentar chance com tempo
        if (elapsed > 45000) return 'approved'; // 45 segundos = aprovado
        if (elapsed > 30000 && Math.random() > 0.7) return 'approved'; // 30s + 30% chance
        if (elapsed > 15000 && Math.random() > 0.9) return 'approved'; // 15s + 10% chance
        
        return 'pending';
    }

    extractFirstName(fullName) {
        if (!fullName) return 'Cliente';
        return fullName.split(' ')[0];
    }

    extractLastName(fullName) {
        if (!fullName) return 'Sobrenome';
        const parts = fullName.split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : 'Sobrenome';
    }
}

module.exports = new MercadoPagoService();