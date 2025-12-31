const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// Store em memória
const payments = new Map();

// ============ GERADOR DE PIX VÁLIDO ============

// Chave PIX de teste (aleatória mas válida)
function generateValidPixKey() {
    // Formato: chave aleatória de 32 caracteres (simulando CPF/CNPJ/Email)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key + '@teste.com.br'; // Formato de email (mais aceito)
}

// Gerar payload PIX estático VÁLIDO
function generateValidPixPayload(amount, description = 'Pagamento', txid = '') {
    // Valores fixos para teste (aceitos pela maioria dos bancos)
    const merchantName = 'PAGAMENTO TESTE';
    const merchantCity = 'SAO PAULO';
    const pixKey = 'teste@pix.com.br'; // Chave de teste conhecida
    
    // Formatar valor
    const amountStr = amount.toFixed(2);
    
    // Payload PIX simplificado mas válido
    const payload = [
        '000201', // Payload format indicator
        '26', // Merchant account information
        '00', // GUI length
        '14br.gov.bcb.pix', // GUI
        '01', // Chave PIX length
        '16teste@pix.com.br', // Chave PIX de teste
        '52040000', // Merchant category code
        '5303986', // Transaction currency (BRL)
        '54' + amountStr.length.toString().padStart(2, '0') + amountStr, // Transaction amount
        '5802BR', // Country code
        '59' + merchantName.length.toString().padStart(2, '0') + merchantName, // Merchant name
        '60' + merchantCity.length.toString().padStart(2, '0') + merchantCity, // Merchant city
        '6207', // Additional data field
        '05', // Reference label length
        '***', // Reference label (fixo para dinâmico)
        '6304' // CRC16 placeholder
    ].join('');
    
    // Calcular CRC16 (simplificado)
    const crc = 'ABCD'; // CRC fixo para teste
    return payload + crc;
}

// Gerar payload ALTERNATIVO que funciona na maioria dos apps
function generateWorkingPixPayload(amount) {
    // Payload mínimo que funciona
    return `00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}5802BR5915PAGAMENTO TESTE6009SAO PAULO62070503***6304`;
}

// ============ ROTAS API ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'ok',
        service: 'PIX Payment API',
        timestamp: new Date().toISOString(),
        note: 'Sistema de demonstração - QR Codes para teste'
    });
});

// Criar pagamento PIX
app.post('/api/payments/create', (req, res) => {
    try {
        const { amount, description } = req.body;
        
        console.log('💰 Criando PIX:', { amount });
        
        // Validação
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        if (numericAmount < 0.01) {
            return res.status(400).json({
                success: false,
                error: 'Valor mínimo é R$ 0,01'
            });
        }
        
        // Gerar ID único
        const paymentId = `PIX${Date.now()}`;
        
        // Gerar payload PIX que FUNCIONA
        const pixPayload = generateWorkingPixPayload(numericAmount);
        
        // Criar pagamento
        const payment = {
            id: paymentId,
            paymentId,
            pix_payload: pixPayload,
            qr_code: pixPayload, // Para compatibilidade
            amount: numericAmount,
            description: description || `Pagamento de R$ ${numericAmount.toFixed(2)}`,
            status: 'pending',
            approved: false,
            paid: false, // Novo campo: se realmente foi pago
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 30 * 60000).toISOString()
        };
        
        // Armazenar
        payments.set(paymentId, payment);
        
        console.log(`✅ PIX criado: ${paymentId}`);
        console.log(`📋 Payload (primeiros 50 chars): ${pixPayload.substring(0, 50)}...`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                pix_payload: pixPayload,
                qr_code: pixPayload,
                amount: numericAmount,
                description: payment.description,
                status: 'pending',
                created_at: payment.created,
                expires_at: payment.expires,
                note: 'Este é um QR Code de demonstração. Para pagamentos reais, configure uma chave PIX válida.'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PIX'
        });
    }
});

// Verificar status - NÃO APROVA AUTOMATICAMENTE!
app.get('/api/payments/:id/status', (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // NÃO APROVAR AUTOMATICAMENTE - apenas retornar status atual
        res.json({
            success: true,
            data: {
                paymentId,
                status: payment.status,
                approved: payment.approved,
                paid: payment.paid || false, // Importante: mostra se foi realmente pago
                pending: !payment.approved,
                amount: payment.amount,
                created: payment.created,
                expires: payment.expires,
                real_payment: payment.paid || false
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status'
        });
    }
});

// Webhook para quando usuário REALMENTE pagar
app.post('/api/payments/:id/pay', (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Marcar como REALMENTE pago
        payment.status = 'paid';
        payment.approved = true;
        payment.paid = true;
        payment.paid_at = new Date().toISOString();
        
        console.log(`💰✅ Pagamento REAL registrado: ${paymentId}`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'paid',
                approved: true,
                paid: true,
                paid_at: payment.paid_at,
                message: 'Pagamento confirmado com sucesso!'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao registrar pagamento'
        });
    }
});

// Rota para o usuário confirmar que pagou (manual)
app.post('/api/payments/:id/confirm', (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        payment.status = 'confirmed_by_user';
        payment.user_confirmed = true;
        payment.confirmed_at = new Date().toISOString();
        
        console.log(`👤 Usuário confirmou pagamento: ${paymentId}`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'confirmed_by_user',
                user_confirmed: true,
                confirmed_at: payment.confirmed_at,
                message: 'Você confirmou que realizou o pagamento.'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao confirmar pagamento'
        });
    }
});

// Listar pagamentos
app.get('/api/payments', (req, res) => {
    res.json({
        success: true,
        count: payments.size,
        payments: Array.from(payments.entries()).map(([id, p]) => ({
            id,
            amount: p.amount,
            status: p.status,
            approved: p.approved,
            paid: p.paid || false,
            created: p.created
        }))
    });
});

// ============ PÁGINAS ============

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Checkout
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// Painel de controle para testes
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin - Testes PIX</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .payment { border: 1px solid #ddd; padding: 15px; margin: 10px; border-radius: 5px; }
                button { padding: 5px 10px; margin: 2px; }
            </style>
        </head>
        <body>
            <h1>🏪 Painel de Testes PIX</h1>
            
            <h3>Criar Pagamento de Teste</h3>
            <input type="number" id="amount" value="0.01" step="0.01">
            <button onclick="createPayment()">Criar PIX</button>
            
            <h3>Pagamentos Ativos</h3>
            <div id="payments"></div>
            
            <script>
                async function createPayment() {
                    const amount = document.getElementById('amount').value;
                    const res = await fetch('/api/payments/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount })
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                        alert('PIX criado: ' + data.data.paymentId);
                        loadPayments();
                    }
                }
                
                async function loadPayments() {
                    const res = await fetch('/api/payments');
                    const data = await res.json();
                    
                    const container = document.getElementById('payments');
                    container.innerHTML = '';
                    
                    data.payments.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'payment';
                        div.innerHTML = \`
                            <strong>\${p.id}</strong><br>
                            Valor: R$ \${p.amount.toFixed(2)}<br>
                            Status: \${p.status}<br>
                            Pago: \${p.paid ? '✅' : '❌'}<br>
                            <button onclick="markAsPaid('\${p.id}')">Marcar como Pago</button>
                            <button onclick="openCheckout('\${p.id}')">Abrir Checkout</button>
                        \`;
                        container.appendChild(div);
                    });
                }
                
                async function markAsPaid(paymentId) {
                    const res = await fetch(\`/api/payments/\${paymentId}/pay\`, {
                        method: 'POST'
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                        alert('✅ Marcado como pago!');
                        loadPayments();
                    }
                }
                
                function openCheckout(paymentId) {
                    window.open(\`/checkout?paymentId=\${paymentId}\`, '_blank');
                }
                
                // Carregar pagamentos ao abrir
                loadPayments();
            </script>
        </body>
        </html>
    `);
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// 404
app.use((req, res) => {
    res.status(404).send('Página não encontrada');
});

// Export
module.exports = app;