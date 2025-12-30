const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importar rotas
const routes = require('./routes');

class App {
    constructor() {
        this.app = express();
        this.setupSecurity();
        this.setupMiddlewares();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupSecurity() {
        // Helmet para segurança
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:", "http:"],
                    connectSrc: ["'self'", "https://api.mercadopago.com", "https://chart.googleapis.com", "https://api.qrserver.com"]
                }
            },
            crossOriginEmbedderPolicy: false
        }));

        // CORS configurado para Vercel
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5500',
            process.env.FRONTEND_URL,
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
            process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null
        ].filter(Boolean);

        this.app.use(cors({
            origin: function(origin, callback) {
                // Permitir requests sem origin (como mobile apps ou curl)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) === -1) {
                    const msg = `A política CORS não permite acesso de ${origin}`;
                    console.warn('CORS bloqueado:', origin);
                    return callback(new Error(msg), false);
                }
                return callback(null, true);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        // Rate limiting para API
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100, // limite por IP
            message: 'Muitas requisições deste IP, tente novamente mais tarde.',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.app.use('/api/', apiLimiter);
    }

    setupMiddlewares() {
        // Compression para Vercel (otimiza tamanho das respostas)
        this.app.use(compression());
        
        // Logging
        if (process.env.NODE_ENV === 'production') {
            this.app.use(morgan('combined'));
        } else {
            this.app.use(morgan('dev'));
        }

        // Body parser
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Servir arquivos estáticos do frontend
        this.app.use(express.static(path.join(__dirname, '../public'), {
            maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'public, max-age=0');
                }
            }
        }));
    }

    setupRoutes() {
        // Health check endpoint (importante para Vercel)
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'PIX Payment System',
                environment: process.env.NODE_ENV || 'development',
                version: '1.0.0'
            });
        });

        // API Routes
        this.app.use('/api', routes);

        // Rotas para páginas do frontend
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.get('/checkout', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/checkout.html'));
        });

        this.app.get('/success', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/success.html'));
        });

        // Rota para verificar se o sistema está online
        this.app.get('/status', (req, res) => {
            res.json({
                online: true,
                message: 'Sistema PIX está funcionando!',
                endpoints: {
                    home: '/',
                    checkout: '/checkout',
                    api: '/api',
                    health: '/health'
                }
            });
        });
    }

    setupErrorHandling() {
        // 404 - Página não encontrada
        this.app.use((req, res) => {
            if (req.accepts('html')) {
                res.status(404).sendFile(path.join(__dirname, '../public/error.html'));
            } else if (req.accepts('json')) {
                res.status(404).json({
                    error: 'Endpoint não encontrado',
                    path: req.url,
                    method: req.method
                });
            } else {
                res.status(404).type('txt').send('404 - Página não encontrada');
            }
        });

        // Error handler global
        this.app.use((err, req, res, next) => {
            console.error('❌ Erro no servidor:', {
                message: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                url: req.url,
                method: req.method,
                timestamp: new Date().toISOString()
            });

            const status = err.status || 500;
            const message = process.env.NODE_ENV === 'production' 
                ? 'Erro interno do servidor' 
                : err.message;

            res.status(status).json({
                error: message,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            });
        });
    }
}

module.exports = new App().app;