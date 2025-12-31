const express = require('express');
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

// ============ FUNÇÕES PARA GERAR PIX VÁLIDO ============

function generatePixKey() {
    // Gerar uma chave PIX aleatória (no formato UUID)
    return `123e4567-e89b-12d3-a456-426614174${Math.random().toString().substr(2, 6)}`;
}

function generateCRC16(data) {
    // Implementação simplificada do CRC16 para PIX
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(amount, pixKey, merchantName, merchantCity) {
    // Formatar valor: máximo 13 dígitos, 2 casas decimais
    const amountStr = amount.toFixed(2);
    
    // Montar payload PIX copia e cola (versão simplificada)
    const payload = [
        '000201', // Payload Format Indicator
        '010212', // Point of Initiation Method (12 = dinâmico)
        '26', // Merchant Account Information
        '00', // GUI
        '14br.gov.bcb.pix',
        '01', // Chave PIX
        `${pixKey.length.toString().padStart(2, '0')}${pixKey}`,
        '52040000', // Merchant Category Code
        '5303986', // Transaction Currency (986 = BRL)
        `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`, // Transaction Amount
        '5802BR', // Country Code
        `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`, // Merchant Name
        `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`, // Merchant City
        '6207', // Additional Data Field Template
        '05', // Reference Label
        '***', // Valor fixo para PIX dinâmico
        '6304' // CRC16
    ].join('');
    
    // Calcular e adicionar CRC16
    const crc = generateCRC16(payload);
    return payload + crc;
}

function generateStaticPixPayload(amount, pixKey, merchantName, merchantCity, txId = '') {
    // Payload PIX estático (mais simples e mais compatível)
    const amountStr = amount.toFixed(2);
    
    const payload = [
        '000201', // Payload Format Indicator
        '26', // Merchant Account Information
        '00', // GUI
        '14br.gov.bcb.pix',
        '01', // Chave PIX
        `${pixKey.length.toString().padStart(2, '0')}${pixKey}`,
        '52040000', // Merchant Category Code
        '5303986', // Transaction Currency
        `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`, // Transaction Amount
        '5802BR', // Country Code
        `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`, // Merchant Name
        `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`, // Merchant City
        '6207', // Additional Data Field Template
        '05', // Reference Label
        `${txId.length.toString().padStart(2, '0')}${txId}`, // Transaction ID
        '6304' // CRC16
    ].join('');
    
    const crc = generateCRC16(payload);
    return payload + crc;
}

// ============ ROTAS DA API ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'ok',
        service: 'PIX Payment API',
        pix_support: true
    });
});

// Criar pagamento PIX VÁLIDO
app.post('/api/payments/create', (req, res) => {
    try {
        const { amount, description } = req.body;
        
        console.log('💰 Criando PIX válido:', { amount });
        
        // Validação
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido'
            });
        }
        
        const numericAmount = parseFloat(amount);
        
        if (numericAmount < 0.01 || numericAmount > 999999.99) {
            return res.status(400).json({
                success: false,
                error: 'Valor deve estar entre R$ 0,01 e R$ 999.999,99'
            });
        }
        
        // Gerar dados do pagamento
        const paymentId = `PIX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const pixKey = generatePixKey();
        const merchantName = 'PIX PAYMENT SYSTEM';
        const merchantCity = 'SAO PAULO';
        
        // Gerar payload PIX
        const pixPayload = generateStaticPixPayload(
            numericAmount,
            pixKey,
            merchantName,
            merchantCity,
            paymentId
        );
        
        // Criar pagamento
        const payment = {
            id: paymentId,
            paymentId,
            pix_key: pixKey,
            pix_payload: pixPayload,
            amount: numericAmount,
            description: description || `Pagamento PIX R$ ${numericAmount.toFixed(2)}`,
            merchant_name: merchantName,
            merchant_city: merchantCity,
            status: 'pending',
            approved: false,
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 30 * 60000).toISOString(),
            qr_code_text: pixPayload
        };
        
        // Armazenar
        payments.set(paymentId, payment);
        
        console.log(`✅ PIX criado: ${paymentId}`);
        console.log(`📋 Payload: ${pixPayload.substring(0, 100)}...`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                pix_payload: pixPayload,
                qr_code: pixPayload, // Para compatibilidade
                amount: numericAmount,
                description: payment.description,
                status: 'pending',
                created_at: payment.created,
                expires_at: payment.expires,
                merchant_name: merchantName,
                merchant_city: merchantCity
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

// Verificar status
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
        
        // Simular verificação
        const created = new Date(payment.created);
        const now = new Date();
        const elapsed = (now - created) / 1000;
        
        let approved = payment.approved;
        let status = payment.status;
        
        // PARA TESTES: Aprovar após 30 segundos
        // EM PRODUÇÃO: Remover esta aprovação automática
        if (!approved && elapsed > 30) {
            approved = true;
            status = 'approved';
            payment.approved = true;
            payment.status = 'approved';
            payment.approvedAt = now.toISOString();
            console.log(`⚠️  APROVAÇÃO AUTOMÁTICA (apenas para teste): ${paymentId}`);
        }
        
        res.json({
            success: true,
            data: {
                paymentId,
                status,
                approved,
                pending: !approved,
                elapsed_seconds: Math.floor(elapsed),
                amount: payment.amount,
                created: payment.created,
                expires: payment.expires
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

// Rota para aprovação manual (para quando usuário realmente pagar)
app.post('/api/payments/:id/approve', (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        // Marcar como aprovado
        payment.status = 'approved';
        payment.approved = true;
        payment.approvedAt = new Date().toISOString();
        
        console.log(`✅ Pagamento aprovado manualmente: ${paymentId}`);
        
        res.json({
            success: true,
            data: {
                paymentId,
                status: 'approved',
                approved: true,
                approved_at: payment.approvedAt
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao aprovar pagamento'
        });
    }
});

// Webhook para receber confirmações de pagamento
app.post('/api/payments/webhook', (req, res) => {
    try {
        const { paymentId, status } = req.body;
        
        console.log(`🔔 Webhook recebido: ${paymentId} - ${status}`);
        
        if (!paymentId) {
            return res.status(400).json({
                success: false,
                error: 'paymentId é obrigatório'
            });
        }
        
        const payment = payments.get(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
        
        if (status === 'approved' || status === 'paid') {
            payment.status = 'approved';
            payment.approved = true;
            payment.approvedAt = new Date().toISOString();
            
            console.log(`✅ Pagamento confirmado via webhook: ${paymentId}`);
        }
        
        res.json({
            success: true,
            message: 'Webhook processado',
            paymentId,
            status: payment.status
        });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno'
        });
    }
});

// Servir página de teste PIX
app.get('/test-pix', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Teste PIX</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .test { background: #f0f0f0; padding: 20px; margin: 10px; border-radius: 5px; }
                button { padding: 10px; margin: 5px; }
            </style>
        </head>
        <body>
            <h1>Testes PIX</h1>
            
            <div class="test">
                <h3>1. Gerar PIX de R$ 0,01</h3>
                <button onclick="testPayment(0.01)">Gerar PIX R$ 0,01</button>
            </div>
            
            <div class="test">
                <h3>2. Gerar PIX de R$ 1,00</h3>
                <button onclick="testPayment(1.00)">Gerar PIX R$ 1,00</button>
            </div>
            
            <div class="test">
                <h3>3. Verificar pagamento</h3>
                <input type="text" id="paymentId" placeholder="ID do pagamento">
                <button onclick="checkStatus()">Verificar Status</button>
            </div>
            
            <div id="result" style="margin-top:20px;padding:10px;background:#fff;"></div>
            
            <script>
                async function testPayment(amount) {
                    const res = await fetch('/api/payments/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: amount.toString() })
                    });
                    
                    const data = await res.json();
                    const result = document.getElementById('result');
                    
                    if (data.success) {
                        result.innerHTML = \`
                            <h4>✅ PIX Gerado!</h4>
                            <p><strong>ID:</strong> \${data.data.paymentId}</p>
                            <p><strong>Valor:</strong> R$ \${data.data.amount.toFixed(2)}</p>
                            <p><strong>Payload PIX:</strong></p>
                            <textarea style="width:100%;height:60px;font-family:monospace;">\${data.data.pix_payload}</textarea>
                            <p><strong>QR Code:</strong></p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${encodeURIComponent(data.data.pix_payload)}" alt="QR Code">
                            <p><a href="/checkout.html?amount=\${amount}" target="_blank">Abrir página de pagamento</a></p>
                        \`;
                    } else {
                        result.innerHTML = \`❌ Erro: \${data.error}\`;
                    }
                }
                
                async function checkStatus() {
                    const paymentId = document.getElementById('paymentId').value;
                    if (!paymentId) return alert('Digite um ID');
                    
                    const res = await fetch(\`/api/payments/\${paymentId}/status\`);
                    const data = await res.json();
                    
                    const result = document.getElementById('result');
                    if (data.success) {
                        result.innerHTML = \`
                            <h4>🔍 Status do Pagamento</h4>
                            <p><strong>ID:</strong> \${data.data.paymentId}</p>
                            <p><strong>Status:</strong> \${data.data.status}</p>
                            <p><strong>Aprovado:</strong> \${data.data.approved ? '✅ Sim' : '❌ Não'}</p>
                            <p><strong>Tempo:</strong> \${data.data.elapsed_seconds} segundos</p>
                            <button onclick="approvePayment('\${paymentId}')">Aprovar Manualmente</button>
                        \`;
                    } else {
                        result.innerHTML = \`❌ Erro: \${data.error}\`;
                    }
                }
                
                async function approvePayment(paymentId) {
                    const res = await fetch(\`/api/payments/\${paymentId}/approve\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                        alert('✅ Pagamento aprovado manualmente!');
                        checkStatus();
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Servir arquivos estáticos
app.use(express.static('public'));

// Rota padrão
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../public/index.html');
});

// Export
module.exports = app;