# 💰 Sistema de Pagamento PIX

![PIX Payment](https://img.shields.io/badge/PIX-Brazil-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

Sistema completo para gerar pagamentos PIX com valor personalizado. Permite criar QR Codes PIX para qualquer valor entre R$ 0,01 e R$ 99.999.999.999,99.

## 🚀 Demonstração

**Acesse o sistema online:** [https://pix-payment-system.vercel.app](https://pix-payment-system.vercel.app)

## ✨ Funcionalidades

- ✅ **Valor personalizado:** Digite qualquer valor (R$ 0,01 a R$ 99.999.999.999,99)
- ✅ **QR Code dinâmico:** Geração automática de QR Code PIX
- ✅ **Interface moderna:** Design responsivo e intuitivo
- ✅ **Verificação em tempo real:** Status do pagamento atualizado automaticamente
- ✅ **Modal de confirmação:** Popup bonito quando pagamento é aprovado
- ✅ **Integração Mercado Pago:** Suporte para sandbox e produção

## 🛠 Tecnologias

- **Backend:** Node.js, Express, Mercado Pago API
- **Frontend:** HTML5, CSS3, JavaScript Vanilla
- **QR Code:** QRCode.js, Google Charts API
- **Deploy:** Vercel (frontend + backend)
- **Segurança:** Helmet, CORS, Rate Limiting

## 📦 Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/pix-payment-system.git

# 2. Entre na pasta
cd pix-payment-system

# 3. Instale as dependências
npm install

# 4. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Mercado Pago

# 5. Inicie o servidor
npm run dev

# 6. Acesse no navegador
http://localhost:3000