require('dotenv').config();

// Configuração específica para produção
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Ajustar caminhos
const path = require('path');
const app = require('./src/app');

// Porta dinâmica
const PORT = process.env.PORT || 3000;

// Base URL
let baseUrl = process.env.BASE_URL || 
              (isVercel ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`);

// Log de inicialização
console.log('='.repeat(60));
console.log('🚀 SISTEMA PIX - INICIANDO EM PRODUÇÃO');
console.log('='.repeat(60));
console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 URL: ${baseUrl}`);
console.log(`🔧 Porta: ${PORT}`);
console.log(`⚡ Plataforma: ${isVercel ? 'Vercel' : 'Local'}`);

// Verificar configuração do Mercado Pago
if (process.env.MP_ACCESS_TOKEN) {
    const tokenPreview = process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...';
    const isSandbox = process.env.MP_ACCESS_TOKEN.startsWith('TEST-');
    console.log(`💰 Mercado Pago: ${isSandbox ? 'SANDBOX' : 'PRODUÇÃO'} (${tokenPreview})`);
} else {
    console.warn('⚠️  ATENÇÃO: MP_ACCESS_TOKEN não configurado!');
    console.warn('   O sistema usará modo MOCK para testes.');
}

console.log('='.repeat(60));

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor iniciado com sucesso!`);
    console.log(`🔗 Acesse: ${baseUrl}`);
    
    if (isProduction) {
        console.log(`📊 Health check: ${baseUrl}/health`);
        console.log(`🔍 Debug: ${baseUrl}/api/debug`);
    }
});