# 💰 Sistema de Pagamentos PIX

Sistema completo para geração e gerenciamento de pagamentos PIX com integração ao Mercado Pago. Interface moderna, responsiva e de fácil uso.

## 🚀 Quick Start

### Pré-requisitos
- Node.js 16+
- Conta no Mercado Pago
- Token de acesso do Mercado Pago

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/sistema-pix-mp.git
cd sistema-pix-mp
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o .env com suas credenciais
# Adicione seu token do Mercado Pago:
# MP_ACCESS_TOKEN=SEU_TOKEN_AQUI
```

4. **Configure o Mercado Pago**
   - Acesse [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
   - Crie uma aplicação
   - Obtenha o **Access Token**
   - Cole no arquivo `.env`:
   ```env
   MP_ACCESS_TOKEN=SEU_TOKEN_AQUI
   MP_SANDBOX=true  # true para testes, false para produção
   ```

5. **Inicie o servidor**
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

6. **Acesse a aplicação**
   - Local: http://localhost:3000
   - Produção: https://seu-dominio.com

## 📁 Estrutura do Projeto

```
fazmeupix/
├── api/
│   └── index.js                    # API principal
├── src/
│   └── services/
│       └── mercadopagoservices.js  # Serviço Mercado Pago
├── public/
│   ├── index.html                  # Página inicial
│   └── checkout.html               # Página do QR Code
├── package.json                    # Dependências
├── .env                            # Variáveis de ambiente
└── README.md                       # Documentação
```

## 🔧 Principais Funcionalidades

### Frontend
- ✅ Interface moderna com Tailwind CSS
- ✅ Totalmente responsivo (mobile-first)
- ✅ Duas telas simples: valor → QR Code
- ✅ Modal de confirmação automática
- ✅ Timer de 30 minutos

### Backend
- ✅ Integração com Mercado Pago API
- ✅ Geração de QR Code PIX
- ✅ Verificação automática de status
- ✅ Webhooks para notificações
- ✅ Cache em memória

## 📦 Scripts Disponíveis

```bash
npm start          # Inicia em produção
npm run dev       # Inicia em desenvolvimento
npm test          # Executa testes
```

## 🌐 Deployment

### Vercel (Recomendado)
```bash
# Instale a CLI
npm i -g vercel

# Faça deploy
vercel

# Para produção
vercel --prod
```

## 🧪 Testando

### Modo Sandbox
- Configure `MP_SANDBOX=true`
- Use cartão de teste: `5031 4332 1540 6351` (CVV: 123)

### Pagamento Real
- Configure `MP_SANDBOX=false`
- Escaneie o QR Code com seu banco
- Pague qualquer valor (ex: R$ 0,01)

## 🔒 Variáveis de Ambiente

Crie um arquivo `.env` com:

```env
# Mercado Pago
MP_ACCESS_TOKEN=SEU_TOKEN_AQUI
MP_SANDBOX=true
MP_WEBHOOK_URL=http://localhost:3000/api/payments/webhook

# Servidor
PORT=3000
NODE_ENV=development

# Segurança
ALLOWED_ORIGINS=http://localhost:3000
```

## 🐛 Problemas Comuns

1. **Token não configurado**
   - Verifique se o arquivo `.env` existe
   - Confirme se `MP_ACCESS_TOKEN` está correto

2. **QR Code não aparece**
   - Verifique a conexão com Mercado Pago
   - Confira os logs do servidor

3. **Status não atualiza**
   - O sistema verifica automaticamente a cada 10 segundos
   - Aguarde alguns segundos após o pagamento

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/sistema-pix-mp/issues)
- **Email**: seu-email@exemplo.com

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

**⭐️ Dê uma estrela se este projeto ajudou você!**

Feito com ❤️ no Brasil 🇧🇷
