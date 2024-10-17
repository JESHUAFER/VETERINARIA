const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

// Conexión a la base de datos
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'veterinaria'
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

app.listen(3001, () => {
    console.log('Servidor escuchando en el puerto 3001');
});
