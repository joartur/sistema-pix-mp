const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('💰 Inicializando Mercado Pago Service...');
        
        this.accessToken = process.env.MP_ACCESS_TOKEN;
        
        if (!this.accessToken) {
            console.error('❌ MP_ACCESS_TOKEN não configurado');
            console.log('🔧 Usando modo de teste (mock)');
            this.testMode = true;
            this.paymentClient = null;
            return;
        }
        
        // Identificar se é sandbox ou produção
        this.isSandbox = this.accessToken.startsWith('TEST-');
        console.log(`🔧 Modo: ${this.isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}`);
        
        try {
            const config = new MercadoPagoConfig({ 
                accessToken: this.accessToken,
                options: {
                    timeout: 10000,
                    idempotencyKey: 'pix-payment-system'
                }
            });
            
            this.paymentClient = new Payment(config);
            console.log('✅ Cliente Mercado Pago configurado');
            this.testMode = false;
            
        } catch (error) {
            console.error('❌ Erro ao configurar Mercado Pago:', error.message);
            this.testMode = true;
            this.paymentClient = null;
        }
    }

    async createPixPayment(data) {
        try {
            const { amount, description, email, name } = data;
            
            console.log('💳 Criando pagamento PIX:', {
                amount: `R$ ${amount.toFixed(2)}`,
                description: description.substring(0, 50)
            });
            
            // Se estiver em modo de teste ou erro na configuração
            if (this.testMode || !this.paymentClient) {
                console.log('🎭 Usando dados de teste (mock)');
                return this.createMockPayment(amount, description);
            }
            
            // Preparar dados para API do Mercado Pago
            const paymentData = {
                transaction_amount: amount,
                description: description.substring(0, 200),
                payment_method_id: 'pix',
                payer: {
                    email: email || 'pagador@exemplo.com',
                    first_name: this.extractFirstName(name),
                    last_name: this.extractLastName(name),
                    identification: {
                        type: 'CPF',
                        number: '12345678909' // Em produção, colete do cliente
                    }
                },
                installments: 1,
                notification_url: process.env.WEBHOOK_URL || `${process.env.BASE_URL}/webhook/pix`,
                date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
                metadata: {
                    system: 'pix-payment-system',
                    timestamp: new Date().toISOString()
                }
            };

            console.log('📤 Enviando para Mercado Pago...');
            const response = await this.paymentClient.create({ body: paymentData });
            
            console.log('✅ Pagamento criado com sucesso:', {
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
                
                console.log('🎯 QR Code extraído:', {
                    hasQRCode: !!qrCode,
                    qrCodeLength: qrCode.length
                });
            } else {
                console.warn('⚠️ QR Code não retornado pela API');
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
                sandbox: this.isSandbox,
                mock: false
            };
            
        } catch (error) {
            console.error('❌ ERRO no Mercado Pago:', {
                message: error.message,
                code: error.cause?.code,
                status: error.response?.status,
                data: error.response?.data
            });
            
            // Fallback para mock em caso de erro
            console.log('🔄 Retornando fallback mock devido ao erro');
            return this.createMockPayment(data.amount, data.description);
        }
    }

    createMockPayment(amount, description) {
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        console.log('🎭 Criando pagamento mock:', {
            id: paymentId,
            amount: `R$ ${amount.toFixed(2)}`
        });
        
        // Gerar QR Code mock com valor correto
        const amountInCents = Math.round(amount * 100);
        const mockQrCode = `00020101021226890014br.gov.bcb.pix0136${paymentId}52040000530398654${amountInCents.toString().length.toString().padStart(2, '0')}${amountInCents}5802BR5913PIX SISTEMA6008BRASILIA62070503***6304`;
        
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

    extractFirstName(fullName) {
        if (!fullName) return 'Pagador';
        return fullName.split(' ')[0];
    }

    extractLastName(fullName) {
        if (!fullName) return 'PIX';
        const parts = fullName.split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : 'PIX';
    }

    async checkPaymentStatus(paymentId) {
        try {
            console.log(`🔍 Verificando status: ${paymentId}`);
            
            // Se for mock
            if (paymentId.startsWith('mock-') || this.testMode) {
                return this.handleMockPaymentStatus(paymentId);
            }
            
            // Se não tiver cliente configurado
            if (!this.paymentClient) {
                return 'pending';
            }
            
            // Buscar status real
            const response = await this.paymentClient.get({ id: paymentId });
            return response.status;
            
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error.message);
            return 'pending';
        }
    }

    handleMockPaymentStatus(paymentId) {
        // Simular aprovação progressiva
        const parts = paymentId.split('-');
        const createdAt = parseInt(parts[1]) || Date.now();
        const elapsed = Date.now() - createdAt;
        
        // Aprovar depois de 45 segundos (para testes)
        if (elapsed > 45000) {
            return 'approved';
        }
        
        // 30% chance após 15 segundos
        if (elapsed > 15000 && Math.random() < 0.3) {
            return 'approved';
        }
        
        return 'pending';
    }
}

module.exports = new MercadoPagoService();