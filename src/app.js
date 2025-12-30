const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

// Verificar se estamos no Vercel
const isVercel = process.env.VERCEL === '1';

// Importar rotas
const routes = require('./routes');

class App {
    constructor() {
        this.app = express();
        this.setupMiddlewares();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddlewares() {
        // CORS configurado
        this.app.use(cors({
            origin: '*', // Permite tudo por enquanto
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type']
        }));

        // Segurança básica
        this.app.use(helmet({
            contentSecurityPolicy: false // Desativa por enquanto para debug
        }));

        // Body parser
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // LOG para debug
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });

        // Servir arquivos estáticos - CAMINHO CORRETO PARA VERCEL
        const publicPath = isVercel 
            ? path.join(__dirname, '../public')
            : path.join(__dirname, '../public');
        
        console.log('📁 Servindo arquivos de:', publicPath);
        this.app.use(express.static(publicPath));
    }

    setupRoutes() {
        // Health check IMPORTANTE para Vercel
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                vercel: isVercel,
                directory: __dirname
            });
        });

        // Teste simples
        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'API está funcionando!',
                timestamp: new Date().toISOString()
            });
        });

        // API Routes
        this.app.use('/api', routes);

        // Rotas principais
        this.app.get('/', (req, res) => {
            const indexPath = isVercel
                ? path.join(__dirname, '../public/index.html')
                : path.join(__dirname, '../public/index.html');
            
            console.log('📄 Servindo index.html de:', indexPath);
            res.sendFile(indexPath);
        });

        this.app.get('/checkout', (req, res) => {
            const checkoutPath = isVercel
                ? path.join(__dirname, '../public/checkout.html')
                : path.join(__dirname, '../public/checkout.html');
            
            console.log('📄 Servindo checkout.html de:', checkoutPath);
            res.sendFile(checkoutPath);
        });
    }

    setupErrorHandling() {
        // 404
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Endpoint não encontrado',
                path: req.url,
                method: req.method
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('❌ ERRO NO SERVIDOR:', {
                message: err.message,
                stack: err.stack,
                url: req.url,
                timestamp: new Date().toISOString()
            });

            res.status(500).json({
                error: 'Erro interno do servidor',
                message: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });
    }
}

module.exports = new App().app;