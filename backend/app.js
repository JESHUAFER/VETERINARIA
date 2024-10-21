const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const plainTextPassword = 'admin123';

const app = express();
app.use(cors());
app.use(express.json());

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

bcrypt.hash(plainTextPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    console.log(hash);
});

// Ruta de login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM user_auth WHERE email = ?', [email]);
        if (rows.length > 0) {
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                res.cookie('session_id', 'valor_de_la_sesion', {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 24 * 60 * 60 * 1000
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

// Ruta para obtener información de la mascota
app.get('/mascota/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM pet WHERE pet_id = ?', [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Mascota no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para obtener el historial médico de la mascota
app.get('/historial/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM medical_history WHERE pet_id = ?', [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para añadir un nuevo dueño
app.post('/add_owner', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const result = await db.execute('INSERT INTO owner (name, email, phone) VALUES (?, ?, ?)', [name, email, phone]);
        res.json({ message: 'Dueño añadido exitosamente' });
    } catch (error) {
        console.error('Error al añadir dueño:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para añadir una nueva mascota
// Añadir una nueva mascota
app.post('/add_pet', async (req, res) => {
    const { name, species, breed, birth_date, owner_id } = req.body;
    try {
        const result = await db.execute('INSERT INTO pet (name, species, breed, birth_date, owner_id) VALUES (?, ?, ?, ?, ?)', [name, species, breed, birth_date, owner_id]);
        res.json({ message: 'Mascota añadida exitosamente' });
    } catch (error) {
        console.error('Error al añadir mascota:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para obtener información de los dueños y sus mascotas
app.get('/inventario_mascotas', async (req, res) => {
    try {
        const query = `
            SELECT o.owner_id, o.name as owner_name, o.email, o.phone, p.name as pet_name, p.species, p.breed, p.birth_date
            FROM owner o
            LEFT JOIN pet p ON o.owner_id = p.owner_id
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error en la petición:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener información de todos los dueños
app.get('/owners', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT owner_id, name FROM owner');
        res.json(rows);
    } catch (error) {
        console.error('Error en la petición:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener información de las mascotas de un dueño
app.get('/owner_pets/:ownerId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT pet_id, name FROM pet WHERE owner_id = ?', [req.params.ownerId]);
        res.json(rows);
    } catch (error) {
        console.error('Error en la petición:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener información de una mascota específica
app.get('/mascota/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM pet WHERE pet_id = ?', [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Mascota no encontrada' });
        }
    } catch (error) {
        console.error('Error en la petición:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Obtener historial médico de una mascota
app.get('/historial/:petId', async (req, res) => {
    const petId = req.params.petId;
    try {
        const [rows] = await db.query('SELECT visit_date, diagnosis FROM medical_history WHERE pet_id = ?', [petId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener historial médico');
    }
});

// Ruta para añadir nueva entrada al historial médico
app.post('/add_medical_history', async (req, res) => {
    const { pet_id, visit_date, diagnosis } = req.body;
    console.log('Datos recibidos:', req.body); // Asegúrate de que los datos lleguen correctamente
    try {
        const [result] = await db.execute('INSERT INTO medical_history (pet_id, visit_date, diagnosis) VALUES (?, ?, ?)', [pet_id, visit_date, diagnosis]);
        const history_id = result.insertId; // Obtener el ID del historial médico recién insertado
        res.json({ message: 'Entrada de historial médico añadida exitosamente', history_id: history_id });
    } catch (error) {
        console.error('Error al añadir entrada de historial médico:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para añadir nuevo tratamiento
app.post('/add_treatment', async (req, res) => {
    const { history_id, treatment_description } = req.body;
    try {
        await db.execute('INSERT INTO treatment (history_id, treatment_description) VALUES (?, ?)', [history_id, treatment_description]);
        res.json({ message: 'Tratamiento añadido exitosamente' });
    } catch (error) {
        console.error('Error al añadir tratamiento:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para añadir nueva medicación
app.post('/add_medication', async (req, res) => {
    const { history_id, medication_name, dosage } = req.body;
    try {
        await db.execute('INSERT INTO medication (history_id, medication_name, dosage) VALUES (?, ?, ?)', [history_id, medication_name, dosage]);
        res.json({ message: 'Medicación añadida exitosamente' });
    } catch (error) {
        console.error('Error al añadir medicación:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
// Ruta para obtener todas las citas
app.get('/appointments', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                a.appointment_id, a.appointment_date, a.vet_name, a.notes, 
                o.name AS owner_name, 
                p.name AS pet_name 
            FROM appointment a
            JOIN pet p ON a.pet_id = p.pet_id
            JOIN owner o ON p.owner_id = o.owner_id
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para agregar una nueva cita
app.post('/appointments', async (req, res) => {
    const { pet_id, appointment_date, vet_name, notes } = req.body;
    try {
        const result = await db.execute('INSERT INTO appointment (pet_id, appointment_date, vet_name, notes) VALUES (?, ?, ?, ?)', [pet_id, appointment_date, vet_name, notes]);
        res.json({ message: 'Cita añadida exitosamente' });
    } catch (error) {
        console.error('Error al añadir cita:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para editar una cita existente
app.put('/appointments/:id', async (req, res) => {
    const { id } = req.params;
    const { pet_id, appointment_date, vet_name, notes } = req.body;
    try {
        const result = await db.execute('UPDATE appointment SET pet_id = ?, appointment_date = ?, vet_name = ?, notes = ? WHERE appointment_id = ?', [pet_id, appointment_date, vet_name, notes, id]);
        res.json({ message: 'Cita actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para eliminar una cita
app.delete('/appointments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute('DELETE FROM appointment WHERE appointment_id = ?', [id]);
        res.json({ message: 'Cita eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para obtener todas las citas
app.get('/appointments', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                a.appointment_id, a.appointment_date, a.vet_name, a.notes, 
                o.name AS owner_name, 
                p.name AS pet_name 
            FROM appointment a
            JOIN pet p ON a.pet_id = p.pet_id
            JOIN owner o ON p.owner_id = o.owner_id
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para agregar una nueva cita
app.post('/appointments', async (req, res) => {
    const { pet_id, appointment_date, vet_name, notes } = req.body;
    try {
        const result = await db.execute('INSERT INTO appointment (pet_id, appointment_date, vet_name, notes) VALUES (?, ?, ?, ?)', [pet_id, appointment_date, vet_name, notes]);
        res.json({ message: 'Cita añadida exitosamente' });
    } catch (error) {
        console.error('Error al añadir cita:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Ruta para editar una cita existente
app.put('/appointments/:id', async (req, res) => {
    const { id } = req.params;
    const { pet_id, appointment_date, vet_name, notes } = req.body;
    try {
        const result = await db.execute('UPDATE appointment SET pet_id = ?, appointment_date = ?, vet_name = ?, notes = ? WHERE appointment_id = ?', [pet_id, appointment_date, vet_name, notes, id]);
        res.json({ message: 'Cita actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Iniciar el servidor
app.listen(3001, () => {
    console.log('Servidor escuchando en el puerto 3001');
});
