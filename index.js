// index.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const app = express();
const port = 3000;

app.use(express.json());


// Inicializar Prisma Client
const prisma = new PrismaClient();

app.get('/', (req, res) => {
  res.send('API funcionando');
});

// Endpoint para obtener la información de un usuario por cédula (titular_documento)
app.get('/usuario/:cedula', async (req, res) => {
  const { cedula } = req.params;
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { titular_documento: cedula }
    });
    if (!usuario) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    return res.json(usuario);
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
  try {
    const usuarioOrigen = await prisma.usuarios.findUnique({ where: { titular_documento: id_origen } });
    const usuarioDestino = await prisma.usuarios.findUnique({ where: { titular_documento: id_destino } });
    if (!usuarioOrigen) {
      return res.status(404).json({ status: 'error', message: 'Usuario origen no encontrado' });
    }
    if (!usuarioDestino) {
      return res.status(404).json({ status: 'error', message: 'Usuario destino no encontrado' });
    }
    if (usuarioOrigen.saldo < monto) {
      return res.status(400).json({ status: 'rejected', message: 'Fondos insuficientes en origen' });
    }
    // Realizar la transferencia en una transacción
    await prisma.$transaction([
      prisma.usuarios.update({
        where: { titular_documento: id_origen },
        data: { saldo: { decrement: monto } }
      }),
      prisma.usuarios.update({
        where: { titular_documento: id_destino },
        data: { saldo: { increment: monto } }
      })
    ]);
    return res.json({ status: 'approved', message: 'Transferencia realizada con éxito' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

// Endpoint para agregar saldo a un usuario
app.post('/add-balance', async (req, res) => {
  const { documento, monto } = req.body;
  if (!documento || typeof monto !== 'number' || monto <= 0) {
    return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
  }
  try {
    const usuario = await prisma.usuarios.update({
      where: { titular_documento: documento },
      data: { saldo: { increment: monto } }
    });
    return res.json({ status: 'success', usuario });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});



// Probar conexión a la base de datos antes de iniciar el servidor con Prisma
prisma.$connect()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor escuchando en http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });