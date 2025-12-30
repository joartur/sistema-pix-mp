// Sistema Principal de Pagamento PIX
class PaymentSystem {
    constructor() {
        this.API_BASE_URL = '/api';
        this.currentProduct = null;
        this.currentPayment = null;
        
        this.init();
    }

    async init() {
        console.log('💰 Sistema de Pagamento PIX iniciado');
        
        // Carregar produtos na página inicial
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            await this.loadProducts();
        }
    }

    async loadProducts() {
        try {
            const loadingElement = document.getElementById('loading');
            const errorElement = document.getElementById('error-message');
            const container = document.getElementById('products-container');
            
            if (loadingElement) loadingElement.style.display = 'flex';
            if (errorElement) errorElement.style.display = 'none';
            
            const response = await fetch(`${this.API_BASE_URL}/products`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Erro ao carregar produtos');
            }
            
            this.renderProducts(data.data);
            
        } catch (error) {
            console.error('❌ Erro ao carregar produtos:', error);
            this.showError('Erro ao carregar produtos. Verifique se o servidor está rodando.');
        } finally {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) loadingElement.style.display = 'none';
        }
    }

    renderProducts(products) {
        const container = document.getElementById('products-container');
        if (!container) return;

        container.innerHTML = products.map(product => `
            <div class="product-card">
                <div class="product-image">
                    ${product.image || '📦'}
                </div>
                <div class="product-details">
                    <div class="product-category">
                        <i class="fas fa-tag"></i> ${product.category}
                    </div>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <div class="product-price">R$ ${parseFloat(product.price).toFixed(2)}</div>
                    <button class="btn btn-primary" onclick="paymentSystem.selectProduct(${product.id})">
                        <i class="fas fa-qrcode"></i> Pagar com PIX
                    </button>
                </div>
            </div>
        `).join('');
    }

    selectProduct(productId) {
        try {
            // Salvar produto selecionado
            localStorage.setItem('selectedProductId', productId);
            
            // Redirecionar para checkout
            window.location.href = `/checkout?product=${productId}`;
            
        } catch (error) {
            console.error('Erro ao selecionar produto:', error);
            alert('Erro ao selecionar produto. Por favor, tente novamente.');
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'block';
            errorElement.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-secondary">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            `;
        } else {
            alert(message);
        }
    }

    showNotification(message, type = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                              type === 'error' ? 'exclamation-circle' : 
                              'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Estilos da notificação
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : 
                        type === 'error' ? '#F44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Adicionar ao body
        document.body.appendChild(notification);
        
        // Remover após 5 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Adicionar estilos de animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Inicializar sistema global
window.paymentSystem = new PaymentSystem();

// Funções auxiliares globais
window.copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        if (window.paymentSystem) {
            window.paymentSystem.showNotification('Copiado para a área de transferência!', 'success');
        } else {
            alert('Copiado para a área de transferência!');
        }
        return true;
    } catch (error) {
        console.error('Erro ao copiar:', error);
        if (window.paymentSystem) {
            window.paymentSystem.showNotification('Erro ao copiar', 'error');
        } else {
            alert('Erro ao copiar');
        }
        return false;
    }
};

// Tratamento de erros global
window.addEventListener('error', (event) => {
    console.error('Erro global:', event.error);
});

// Prevenir comportamentos indesejados
window.addEventListener('beforeunload', (event) => {
    // Limpar dados temporários
    localStorage.removeItem('tempPaymentData');
});

// Suporte para navegadores antigos
if (!window.fetch) {
    console.warn('Seu navegador não suporta fetch. Use um navegador moderno.');
    alert('Por favor, atualize seu navegador para usar este sistema.');
}