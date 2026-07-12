const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
app.set('trust proxy', 1); // Trust Cloudflare proxy to handle HTTPS correctly
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io); // make io available in routes

const passport = require('passport');
require('./config/passport'); // Passport config

const authRoutes = require('./routes/auth');
const flatRoutes = require('./routes/flats');
const messageRoutes = require('./routes/messages');
const expenseRoutes = require('./routes/expenses');
const settlementRoutes = require('./routes/settlements');
const directMessageRoutes = require('./routes/directMessages');
const personalExpenseRoutes = require('./routes/personalExpenses');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Serve uploaded files statically
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flats', flatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/direct-messages', directMessageRoutes);
app.use('/api/personal-expenses', personalExpenseRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('FlatSplit API is running...');
});

// Socket.IO event handling
require('./sockets/chatHandler')(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
