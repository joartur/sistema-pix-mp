require('dotenv').config();

// Configuração específica para Vercel
const isVercel = process.env.VERCEL === '1';

// Importar app DEPOIS de configurar dotenv
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SISTEMA PIX INICIADO NO VERCEL');
  console.log('='.repeat(60));
  console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Porta: ${PORT}`);
  console.log(`⚡ Vercel: ${isVercel ? 'SIM' : 'NÃO'}`);
  console.log(`💰 MP Token: ${process.env.MP_ACCESS_TOKEN ? 'SIM' : 'NÃO'}`);
  console.log(`📁 Diretório: ${__dirname}`);
  console.log('='.repeat(60));
});