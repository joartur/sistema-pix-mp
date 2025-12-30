// src/services/mercadoPagoService.js
const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('💰 Inicializando Mercado Pago Service...');
        
        this.accessToken = process.env.MP_ACCESS_TOKEN;
        
        if (!this.accessToken) {
            console.error('❌ MP_ACCESS_TOKEN não configurado!');
            console.error('   Configure em: Vercel Dashboard → Settings → Environment Variables');
            this.isSandbox = true;
        } else {
            this.isSandbox = this.accessToken.startsWith('TEST-');
            console.log(`🔧 Modo: ${this.isSandbox ? 'SANDBOX (testes)' : 'PRODUÇÃO (real)'}`);
            console.log(`🔑 Token: ${this.accessToken.substring(0, 10)}...`);
        }
        
        try {
            if (this.accessToken && !this.isSandbox) {
                const config = new MercadoPagoConfig({ 
                    accessToken: this.accessToken 
                });
                this.paymentClient = new Payment(config);
                console.log('✅ Cliente Mercado Pago configurado para produção');
            } else {
                console.log('🔄 Usando modo mock/sandbox');
                this.paymentClient = null;
            }
        } catch (error) {
            console.error('❌ Erro ao configurar Mercado Pago:', error.message);
            this.paymentClient = null;
            this.isSandbox = true;
        }
    }

    async createPixPayment(data) {
        try {
            const { amount, description, email, name } = data;
            
            console.log('💳 Criando pagamento PIX:', {
                amount: `R$ ${amount.toFixed(2)}`,
                description: description.substring(0, 50),
                mode: this.isSandbox ? 'sandbox' : 'production'
            });
            
            // Se for sandbox ou não tiver cliente configurado, usar mock
            if (this.isSandbox || !this.paymentClient) {
                console.log('🔄 Usando pagamento mock para desenvolvimento');
                return this.createMockPayment(amount, description);
            }
            
            // TENTAR criar pagamento real
            try {
                const paymentData = {
                    transaction_amount: amount,
                    description: description.substring(0, 230),
                    payment_method_id: 'pix',
                    payer: {
                        email: email || 'pagador@pix.com',
                        first_name: this.extractFirstName(name),
                        last_name: this.extractLastName(name),
                        identification: {
                            type: 'CPF',
                            number: '12345678909'
                        }
                    },
                    installments: 1,
                    notification_url: process.env.WEBHOOK_URL,
                    date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString()
                };

                console.log('📤 Enviando para Mercado Pago produção...');
                const response = await this.paymentClient.create({ body: paymentData });
                
                console.log('✅ Pagamento criado na produção:', {
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
                
            } catch (apiError) {
                console.error('❌ ERRO na API do Mercado Pago:', {
                    message: apiError.message,
                    status: apiError.response?.status,
                    data: apiError.response?.data
                });
                
                // Fallback para mock em caso de erro
                console.log('🔄 Fallback para mock devido ao erro');
                return this.createMockPayment(amount, description);
            }
            
        } catch (error) {
            console.error('❌ ERRO geral ao criar pagamento:', error.message);
            
            // Sempre retornar mock em caso de erro
            return this.createMockPayment(data.amount, data.description);
        }
    }

    createMockPayment(amount, description) {
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🎭 Criando pagamento mock: ${paymentId}`, {
            amount: `R$ ${amount.toFixed(2)}`
        });
        
        // Gerar código PIX mock REALISTA
        const amountInCents = Math.round(amount * 100);
        const mockQrCode = this.generateMockPixCode(paymentId, amount);
        
        return {
            id: paymentId,
            qr_code: mockQrCode,
            qr_code_base64: this.generateMockQRCodeBase64(),
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

    generateMockPixCode(paymentId, amount) {
        // Formatar valor em centavos
        const amountInCents = Math.round(amount * 100).toString().padStart(2, '0');
        const amountLength = amountInCents.length.toString().padStart(2, '0');
        
        // Código PIX EMV realista (sem ser muito longo)
        return `00020101021226890014br.gov.bcb.pix0136${paymentId.substring(0, 36)}52040000530398654${amountLength}${amountInCents}5802BR5913PIX PAYMENT6008BRASILIA62070503***6304`;
    }

    generateMockQRCodeBase64() {
        // QR Code base64 simples (quadrado cinza)
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEX///+nxBvIAAAAH0lEQVRoge3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABmmDh1QAAAABJRU5ErkJggg==";
    }

    async checkPaymentStatus(paymentId) {
        try {
            console.log(`🔍 Verificando status: ${paymentId}`);
            
            // Se for mock
            if (paymentId.startsWith('mock-') || this.isSandbox) {
                return this.handleMockPaymentStatus(paymentId);
            }
            
            // Verificar status real
            if (this.paymentClient) {
                const response = await this.paymentClient.get({ id: paymentId });
                return response.status;
            }
            
            return 'pending';
            
        } catch (error) {
            console.error('Erro ao verificar status:', error.message);
            return 'pending';
        }
    }

    handleMockPaymentStatus(paymentId) {
        const parts = paymentId.split('-');
        const createdAt = parseInt(parts[1]) || Date.now();
        const elapsed = Date.now() - createdAt;
        
        // Simular aprovação após 30 segundos
        if (elapsed > 30000 && Math.random() > 0.3) {
            return 'approved';
        }
        
        return 'pending';
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
}

module.exports = new MercadoPagoService();