const express = require('express');

const mysql = require('mysql2/promise');
const path = require('path');  
const cors = require('cors');  
const app = express();

const bcrypt = require('bcrypt');
const saltRounds = 10;
const plainTextPassword = 'admin123';

bcrypt.hash(plainTextPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    // Usa este hash en tu consulta SQL
    console.log(hash);
});


// Middleware to serve static files and correct MIME types
app.use('/frontend', express.static(path.join(__dirname, '../frontend'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
app.use(express.json());
app.use(cors());  

// Conexión a la base de datos con manejo de errores
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'veterinaria'
});

db.getConnection()
    .then(() => console.log('Conexión a la base de datos exitosa'))
    .catch(err => console.error('Error al conectar a la base de datos:', err));

// Servir archivos estáticos desde el directorio 'frontend'
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta de login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [rows] = await db.execute('SELECT * FROM user_auth WHERE email = ?', [email]);

        if (rows.length > 0) {
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password_hash);

            if (match) {
                // Si la autenticación es exitosa, crea una cookie
                res.cookie('session_id', 'valor_de_la_sesion', {
                    httpOnly: true,      // Protege la cookie de acceso desde JavaScript
                    secure: true,        // Solo se enviará en conexiones HTTPS
                    sameSite: 'None',    // Permitir en contextos de terceros
                    maxAge: 24 * 60 * 60 * 1000  // Expiración de 24 horas
                });

                res.json({ message: 'Login exitoso' });
            } else {
                res.status(401).json({ message: 'Contraseña incorrecta' });
            }
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


// Ruta para servir el archivo 'sesion.html'
app.get('/sesion', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/sesion.html'));
});

// Iniciar el servidor
app.listen(3001, () => {
    console.log('Servidor escuchando en el puerto 3001');
});



