const express = require('express');

const cors = require('cors')

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://192.168.1.7:5173",
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());


app.get('/', (req, res) => {
    res.send('Hello World')
})



// Permission routes
const permissionRoutes = require('./routes/permission.routes');
app.use('/api/permissions', permissionRoutes);

// Auth routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Uer routes
const userRoutes = require('./routes/user.routes');
app.use('/api/users', userRoutes);


// Uer routes
const roleRoutes = require('./routes/role.routes');
app.use('/api/roles', roleRoutes);

//  SUPER ADMIN
const superadminRoutes = require('./routes/super-admin/superAdminRoutes');
app.use('/super-admin', superadminRoutes);


//  SUPER ADMIN
const schooladminRoutes = require('./routes/SCHOOL-ADMIN/schoolAdminRoutes');
app.use('/school-admin', schooladminRoutes);

module.exports = app;