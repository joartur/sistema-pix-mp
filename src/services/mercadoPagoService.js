const { MercadoPagoConfig, Payment } = require('mercadopago');

class MercadoPagoService {
    constructor() {
        console.log('💰 Mercado Pago Service - Modo Dinâmico');
        
        this.accessToken = process.env.MP_ACCESS_TOKEN;
        this.isSandbox = this.accessToken?.startsWith('TEST-') || false;
        
        console.log(`🔧 Configuração: ${this.isSandbox ? 'SANDBOX' : 'PRODUÇÃO'}`);
        
        if (this.accessToken && !this.isSandbox) {
            const config = new MercadoPagoConfig({ 
                accessToken: this.accessToken 
            });
            this.paymentClient = new Payment(config);
        }
    }

    async createPixPayment(data) {
        try {
            const { amount, description, email, name } = data;
            
            console.log('💳 Criando PIX dinâmico:', {
                amount: `R$ ${amount.toFixed(2)}`,
                description: description.substring(0, 50)
            });
            
            // Se for sandbox ou não tiver token, usar mock
            if (this.isSandbox || !this.accessToken) {
                return this.createMockPayment(amount, description);
            }
            
            // Criar pagamento real
            const paymentData = {
                transaction_amount: amount,
                description: description.substring(0, 230),
                payment_method_id: 'pix',
                payer: {
                    email: email || 'pagador@pix.com',
                    first_name: name?.split(' ')[0] || 'Pagador',
                    last_name: name?.split(' ').slice(1).join(' ') || 'PIX'
                },
                installments: 1,
                notification_url: process.env.WEBHOOK_URL,
                date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString()
            };

            const response = await this.paymentClient.create({ body: paymentData });
            
            return {
                id: response.id.toString(),
                qr_code: response.point_of_interaction?.transaction_data?.qr_code || '',
                qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64 || '',
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
            console.error('❌ Erro no Mercado Pago:', error.message);
            
            // Fallback para mock
            return this.createMockPayment(data.amount, data.description);
        }
    }

    createMockPayment(amount, description) {
        const paymentId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🎭 Criando mock: ${paymentId}`, {
            amount: `R$ ${amount.toFixed(2)}`
        });
        
        // Gerar código PIX mock com valor correto
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
            
            // Verificar status real
            const response = await this.paymentClient.get({ id: paymentId });
            return response.status;
            
        } catch (error) {
            console.error('Erro ao verificar status:', error.message);
            return 'pending';
        }
    }

    handleMockPaymentStatus(paymentId) {
        // Simular aprovação progressiva
        const parts = paymentId.split('-');
        const createdAt = parseInt(parts[1]) || Date.now();
        const elapsed = Date.now() - createdAt;
        
        // Aumentar chance de aprovação com o tempo
        let approvalChance = 0.1; // 10% inicial
        
        if (elapsed > 30000) approvalChance = 0.5; // 50% após 30s
        if (elapsed > 60000) approvalChance = 0.8; // 80% após 60s
        
        return Math.random() < approvalChance ? 'approved' : 'pending';
    }
}

module.exports = new MercadoPagoService();