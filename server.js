require('dotenv').config();

// Configuração específica para Vercel
const isVercel = process.env.VERCEL === '1';

// Ajustar caminhos para Vercel
const path = require('path');
const app = require('./src/app');

// Porta dinâmica para Vercel
const PORT = process.env.PORT || 3000;

// Base URL para Vercel
let baseUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : `http://localhost:${PORT}`;

// Se tiver URL customizada do Vercel
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SISTEMA PIX INICIADO');
  console.log('='.repeat(60));
  console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: ${baseUrl}`);
  console.log(`🔧 Porta: ${PORT}`);
  console.log(`⚡ Plataforma: ${isVercel ? 'Vercel' : 'Local'}`);
  console.log(`💰 Mercado Pago: ${process.env.MP_ACCESS_TOKEN ? 'Configurado' : 'Não configurado'}`);
  console.log('='.repeat(60));
  
  if (!process.env.MP_ACCESS_TOKEN) {
    console.warn('⚠️  ATENÇÃO: MP_ACCESS_TOKEN não configurado!');
    console.warn('   Configure em: Vercel Dashboard → Settings → Environment Variables');
  }
});