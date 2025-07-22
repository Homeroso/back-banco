// index.js
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

app.use(express.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: 'postgres', // Cambia esto por tu usuario de postgres
  host: 'localhost',
  database: 'banco', // Cambia esto por el nombre de tu base de datos
  password: 'postgres', // Cambia esto por tu contraseña
  port: 5432,
});

app.get('/', (req, res) => {
  res.send('API funcionando');
});

// Endpoint para obtener la información de un usuario por cédula (titular_documento)
app.get('/usuario/:cedula', async (req, res) => {
  const { cedula } = req.params;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE titular_documento = $1', [cedula]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

// Endpoint para realizar una transacción
app.post('/transaction', async (req, res) => {
  const { titular_documento, saldo } = req.body;
  if (!titular_documento || typeof saldo !== 'number') {
    return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
  }
  try {
    // Buscar usuario por documento
    const result = await pool.query('SELECT * FROM usuarios WHERE titular_documento = $1', [titular_documento]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    const usuario = result.rows[0];
    const nuevoSaldo = usuario.saldo + saldo;
    if (nuevoSaldo < 0) {
      return res.status(400).json({ status: 'rejected', message: 'Fondos insuficientes' });
    }
    // Actualizar saldo
    await pool.query('UPDATE usuarios SET saldo = $1 WHERE titular_documento = $2', [nuevoSaldo, titular_documento]);
    return res.json({ status: 'approved', nuevoSaldo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});