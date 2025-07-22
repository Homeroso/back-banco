// index.js
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

app.use(express.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: 'AdminBank',
  host: 'db-bank.ce9cagiwmm9q.us-east-1.rds.amazonaws.com',
  database: 'banco',
  password: 'Acceso123*',
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

// Endpoint para realizar una transacción entre dos usuarios
app.post('/transaction', async (req, res) => {
  const { id_origen, id_destino, monto } = req.body;
  if (!id_origen || !id_destino || typeof monto !== 'number' || monto <= 0) {
    return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Buscar usuario origen
    const resultOrigen = await client.query('SELECT * FROM usuarios WHERE titular_documento = $1 FOR UPDATE', [id_origen]);
    if (resultOrigen.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Usuario origen no encontrado' });
    }
    // Buscar usuario destino
    const resultDestino = await client.query('SELECT * FROM usuarios WHERE titular_documento = $1 FOR UPDATE', [id_destino]);
    if (resultDestino.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Usuario destino no encontrado' });
    }
    const saldoOrigen = resultOrigen.rows[0].saldo;
    if (saldoOrigen < monto) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'rejected', message: 'Fondos insuficientes en origen' });
    }
    // Realizar la transferencia
    await client.query('UPDATE usuarios SET saldo = saldo - $1 WHERE titular_documento = $2', [monto, id_origen]);
    await client.query('UPDATE usuarios SET saldo = saldo + $1 WHERE titular_documento = $2', [monto, id_destino]);
    await client.query('COMMIT');
    return res.json({ status: 'approved', message: 'Transferencia realizada con éxito' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  } finally {
    client.release();
  }
});

// Endpoint para agregar saldo a un usuario
app.post('/add-balance', async (req, res) => {
  const { documento, monto } = req.body;
  if (!documento || typeof monto !== 'number' || monto <= 0) {
    return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
  }
  try {
    const result = await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE titular_documento = $2 RETURNING *', [monto, documento]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    return res.json({ status: 'success', usuario: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

// Probar conexión a la base de datos antes de iniciar el servidor
pool.connect()
  .then(client => {
    return client.query('SELECT 1')
      .then(() => {
        client.release();
        app.listen(port, () => {
          console.log(`Servidor escuchando en http://localhost:${port}`);
        });
      })
      .catch(err => {
        client.release();
        console.error('Error al conectar a la base de datos:', err.message);
        process.exit(1);
      });
  })
  .catch(err => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });