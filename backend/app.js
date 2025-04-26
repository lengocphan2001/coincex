const userRoutes = require('./routes/userRoutes');
const strategyRoutes = require('./routes/strategyRoutes');

// Routes
app.use('/api/users', userRoutes);
app.use('/api/strategies', strategyRoutes);