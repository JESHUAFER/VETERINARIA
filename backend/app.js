const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const plainTextPassword = 'admin123';
const multer = require('multer');
const fs = require('fs');

//const { PrismaClient } = require('@prisma/client');
//const prisma = new PrismaClient();

// Configurar la ruta estática para los archivos subidos


const app = express();
app.use(cors());
app.use(express.json());
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//const histories = [];
//const treatments = [];
//const medications = [];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Crear la carpeta uploads si no existe
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
            cb(null, true);
        } else {
            cb(null, false);
            req.fileError = 'Formato de archivo no válido';
        }
    }
}).single('petImage');

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

bcrypt.hash(plainTextPassword, saltRounds, function (err, hash) {
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
//*app.post('/add_pet', async (req, res) => {
// const { name, species, breed, birth_date, owner_id } = req.body;
// try {
// const result = await db.execute('INSERT INTO pet (name, species, breed, birth_date, owner_id) VALUES (?, ?, ?, ?, ?)', [name, species, breed, birth_date, owner_id]);
//   res.json({ message: 'Mascota añadida exitosamente' });
// } catch (error) {
//    console.error('Error al añadir mascota:', error);
//      res.status(500).json({ message: 'Error en el servidor' });
//  }
//});

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
/*
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
*/
/*
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
    try {
        const { petId, visitDate, diagnosis, treatment, medication } = req.body;

        // Asume que tienes modelos Prisma configurados para historial, tratamientos y medicamentos
        const newHistory = await prisma.historial.create({
            data: {
                petId,
                visit_date: new Date(visitDate),
                diagnosis
            }
        });

        const newTreatment = await prisma.treatment.create({
            data: {
                historyId: newHistory.id,
                treatment_description: treatment
            }
        });

        const newMedication = await prisma.medication.create({
            data: {
                historyId: newHistory.id,
                medication_name: medication
            }
        });

        res.json({ newHistory, newTreatment, newMedication });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar el historial médico' });
    }
});
*/


// Endpoint para añadir historial médico
// Ruta para añadir nueva entrada al historial médico con tratamiento y medicación
// Ruta para añadir nueva entrada al historial médico con tratamiento y medicación



/*app.post('/add_medical_history', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const { pet_id, visit_date, diagnosis } = req.body;

        // Validar datos requeridos
        if (!pet_id || !visit_date || !diagnosis) {
            throw new Error('Faltan campos requeridos');
        }

        // Insertar historial médico
        const [result] = await connection.execute(
            'INSERT INTO medical_history (pet_id, visit_date, diagnosis) VALUES (?, ?, ?)',
            [pet_id, visit_date, diagnosis]
        );

        const history_id = result.insertId;

        await connection.commit();
        
        res.json({ 
            message: 'Historial médico añadido exitosamente',
            history_id: history_id
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error en add_medical_history:', error);
        res.status(500).json({ 
            message: 'Error al añadir el historial médico',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// Ruta para añadir tratamiento
app.post('/add_treatment', async (req, res) => {
    const { history_id, treatment_description } = req.body;

    try {
        // Validar datos
        if (!history_id || !treatment_description) {
            throw new Error('Faltan campos requeridos');
        }

        await db.execute(
            'INSERT INTO treatment (history_id, treatment_description) VALUES (?, ?)',
            [history_id, treatment_description]
        );

        res.json({ message: 'Tratamiento añadido exitosamente' });

    } catch (error) {
        console.error('Error en add_treatment:', error);
        res.status(500).json({ 
            message: 'Error al añadir el tratamiento',
            error: error.message
        });
    }
});

// Ruta para añadir medicación
app.post('/add_medication', async (req, res) => {
    const { history_id, medication_name } = req.body;

    try {
        // Validar datos
        if (!history_id || !medication_name) {
            throw new Error('Faltan campos requeridos');
        }

        await db.execute(
            'INSERT INTO medication (history_id, medication_name) VALUES (?, ?)',
            [history_id, medication_name]
        );

        res.json({ message: 'Medicación añadida exitosamente' });

    } catch (error) {
        console.error('Error en add_medication:', error);
        res.status(500).json({ 
            message: 'Error al añadir la medicación',
            error: error.message
        });
    }
});
*/


/*
// Endpoint para añadir historial médico
app.post('/add_medical_history', async (req, res) => {
    try {
        const { pet_id, visit_date, diagnosis } = req.body;

        if (!pet_id || !visit_date || !diagnosis) {
            throw new Error('Faltan datos requeridos');
        }

        console.log('Datos recibidos:', req.body);

        const newHistory = {
            id: histories.length + 1,
            petId: parseInt(pet_id),
            visit_date: new Date(visit_date),
            diagnosis
        };

        histories.push(newHistory);

        res.json({ history_id: newHistory.id });
    } catch (error) {
        console.error('Error en /add_medical_history:', error.message);
        res.status(500).json({ error: `Error al agregar el historial médico: ${error.message}` });
    }
});

// Endpoint para añadir tratamiento
app.post('/add_treatment', async (req, res) => {
    try {
        const { history_id, treatment_description } = req.body;

        if (!history_id || !treatment_description) {
            throw new Error('Faltan datos requeridos');
        }

        const newTreatment = {
            id: treatments.length + 1,
            historyId: parseInt(history_id),
            treatment_description
        };

        treatments.push(newTreatment);

        res.json({ treatment_id: newTreatment.id });
    } catch (error) {
        console.error('Error en /add_treatment:', error.message);
        res.status(500).json({ error: `Error al agregar el tratamiento: ${error.message}` });
    }
});

// Endpoint para añadir medicación
app.post('/add_medication', async (req, res) => {
    try {
        const { history_id, medication_name } = req.body;

        if (!history_id || !medication_name) {
            throw new Error('Faltan datos requeridos');
        }

        const newMedication = {
            id: medications.length + 1,
            historyId: parseInt(history_id),
            medication_name
        };

        medications.push(newMedication);

        res.json({ medication_id: newMedication.id });
    } catch (error) {
        console.error('Error en /add_medication:', error.message);
        res.status(500).json({ error: `Error al agregar la medicación: ${error.message}` });
    }
});


*/
// Ruta para obtener todas las citas
/*
// Endpoint para añadir historial médico
app.post('/add_medical_history', async (req, res) => {
    try {
        const { pet_id, visit_date, diagnosis } = req.body;

        if (!pet_id || !visit_date || !diagnosis) {
            throw new Error('Faltan datos requeridos');
        }

        console.log('Datos recibidos:', req.body);

        const newHistory = await prisma.historial.create({
            data: {
                petId: parseInt(pet_id),
                visit_date: new Date(visit_date),
                diagnosis
            }
        });

        res.json({ history_id: newHistory.id });
    } catch (error) {
        console.error('Error en /add_medical_history:', error.message);
        res.status(500).json({ error: `Error al agregar el historial médico: ${error.message}` });
    }
});

// Endpoint para añadir tratamiento
app.post('/add_treatment', async (req, res) => {
    try {
        const { history_id, treatment_description } = req.body;

        if (!history_id || !treatment_description) {
            throw new Error('Faltan datos requeridos');
        }

        const newTreatment = await prisma.treatment.create({
            data: {
                historyId: parseInt(history_id),
                treatment_description
            }
        });

        res.json({ treatment_id: newTreatment.id });
    } catch (error) {
        console.error('Error en /add_treatment:', error.message);
        res.status(500).json({ error: `Error al agregar el tratamiento: ${error.message}` });
    }
});

// Endpoint para añadir medicación
app.post('/add_medication', async (req, res) => {
    try {
        const { history_id, medication_name } = req.body;

        if (!history_id || !medication_name) {
            throw new Error('Faltan datos requeridos');
        }

        const newMedication = await prisma.medication.create({
            data: {
                historyId: parseInt(history_id),
                medication_name
            }
        });

        res.json({ medication_id: newMedication.id });
    } catch (error) {
        console.error('Error en /add_medication:', error.message);
        res.status(500).json({ error: `Error al agregar la medicación: ${error.message}` });
    }
});
*/

// Endpoint para añadir historial médico
app.post('/add_medical_history', (req, res) => {
  const { pet_id, visit_date, diagnosis } = req.body;

  if (!pet_id || !visit_date || !diagnosis) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const query = 'INSERT INTO medical_history (pet_id, visit_date, diagnosis) VALUES (?, ?, ?)';
  db.query(query, [pet_id, visit_date, diagnosis], (err, result) => {
    if (err) {
      console.error('Error ejecutando consulta:', err);
      return res.status(500).json({ error: 'Error al agregar el historial médico' });
    }

    const historyId = result.insertId;
    res.json({ history_id: historyId });
  });
});

// Endpoint para añadir tratamiento
app.post('/add_treatment', (req, res) => {
  const { history_id, treatment_description } = req.body;

  if (!history_id || !treatment_description) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const query = 'INSERT INTO treatment (history_id, treatment_description) VALUES (?, ?)';
  db.query(query, [history_id, treatment_description], (err, result) => {
    if (err) {
      console.error('Error ejecutando consulta:', err);
      return res.status(500).json({ error: 'Error al agregar el tratamiento' });
    }

    const treatmentId = result.insertId;
    res.json({ treatment_id: treatmentId });
  });
});

// Endpoint para añadir medicación
app.post('/add_medication', (req, res) => {
  const { history_id, medication_name } = req.body;

  if (!history_id || !medication_name) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const query = 'INSERT INTO medication (history_id, medication_name) VALUES (?, ?)';
  db.query(query, [history_id, medication_name], (err, result) => {
    if (err) {
      console.error('Error ejecutando consulta:', err);
      return res.status(500).json({ error: 'Error al agregar la medicación' });
    }

    const medicationId = result.insertId;
    res.json({ medication_id: medicationId });
  });
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
/*app.put('/appointments/:id', async (req, res) => {
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
*/
app.get('/appointments/:id', (req, res) => {
  const { id } = req.params;

  const query = 'SELECT * FROM appointment WHERE appointment_id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error al obtener los detalles de la cita:', err);
      return res.status(500).json({ error: 'Error al obtener los detalles de la cita' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json(result[0]);
  });
});





// Ruta para servir el archivo 'index.html'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});



// Ruta para añadir una nueva mascota con imagen
app.post('/add_pet', (req, res) => {
    upload(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Error de Multer:', err);
            return res.status(500).json({ message: 'Error al subir el archivo' });
        } else if (err) {
            console.error('Error desconocido:', err);
            return res.status(500).json({ message: 'Error al procesar la solicitud' });
        }

        // Verificar si se recibió un archivo
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha proporcionado ninguna imagen' });
        }

        const { name, species, breed, birth_date, owner_id } = req.body;
        const petImage = `/uploads/${req.file.filename}`;

        try {
            const [result] = await db.execute(
                'INSERT INTO pet (name, species, breed, birth_date, owner_id, pet_image) VALUES (?, ?, ?, ?, ?, ?)',
                [name, species, breed, birth_date, owner_id, petImage]
            );

            res.status(200).json({
                message: 'Mascota añadida exitosamente',
                pet: {
                    id: result.insertId,
                    name,
                    petImage
                }
            });
        } catch (error) {
            console.error('Error al añadir mascota a la base de datos:', error);
            // Eliminar la imagen si falla la inserción en la base de datos
            fs.unlink(path.join(__dirname, petImage), (err) => {
                if (err) console.error('Error al eliminar imagen:', err);
            });
            res.status(500).json({ message: 'Error al guardar en la base de datos' });
        }
    });
});


app.get('/treatments/:petId', async (req, res) => {
    const { petId } = req.params;
    try {
        const treatments = await prisma.treatment.findMany({
            where: {
                petId: parseInt(petId)
            }
        });
        res.json(treatments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los tratamientos' });
    }
});

// Iniciar el servidor
app.listen(3001, () => {
    console.log('Servidor escuchando en el puerto 3001');
});
