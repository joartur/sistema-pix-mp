class PaymentStore {
    constructor() {
        this.payments = new Map();
        this.startCleanupInterval();
    }

    createPayment(paymentData) {
        const paymentId = paymentData.paymentId || paymentData.id;
        
        const payment = {
            ...paymentData,
            paymentId,
            status: 'pending',
            createdAt: new Date(),
            lastChecked: new Date(),
            approved: false,
            attempts: 0
        };
        
        this.payments.set(paymentId, payment);
        console.log(`📝 Pagamento armazenado: ${paymentId}`);
        
        return payment;
    }

    getPayment(paymentId) {
        return this.payments.get(paymentId);
    }

    updatePayment(paymentId, updates) {
        const payment = this.payments.get(paymentId);
        if (payment) {
            Object.assign(payment, updates, { lastChecked: new Date() });
            return payment;
        }
        return null;
    }

    approvePayment(paymentId) {
        const payment = this.payments.get(paymentId);
        if (payment) {
            payment.status = 'approved';
            payment.approved = true;
            payment.approvedAt = new Date();
            payment.lastChecked = new Date();
            console.log(`✅ Pagamento aprovado no store: ${paymentId}`);
            return payment;
        }
        return null;
    }

    getAllPending() {
        const pending = [];
        for (const [id, payment] of this.payments.entries()) {
            if (payment.status === 'pending') {
                pending.push(payment);
            }
        }
        return pending;
    }

    startCleanupInterval() {
        // Limpar pagamentos antigos a cada hora
        setInterval(() => {
            const now = new Date();
            let removed = 0;
            
            for (const [id, payment] of this.payments.entries()) {
                const age = now - payment.createdAt;
                const hours = age / (1000 * 60 * 60);
                
                if (hours > 24) { // Remover após 24 horas
                    this.payments.delete(id);
                    removed++;
                }
            }
            
            if (removed > 0) {
                console.log(`🧹 Limpados ${removed} pagamentos antigos`);
            }
        }, 60 * 60 * 1000); // 1 hora
    }
}

module.exports = new PaymentStore();