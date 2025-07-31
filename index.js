require('dotenv').config();
const express = require('express');
// const helmet = require('helmet');
// const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware

// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         scriptSrc: ["'self'"],
//         styleSrc: ["'self'", "'unsafe-inline'"], // If needed
//       },
//     },
//   })
// );
// app.use(cors({}));
app.use(express.json());
app.use(express.static('public'));

// Database connection
mongoose.connect(process.env.MONGO_CONNECTION, {
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error(err));

// Routes
app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});