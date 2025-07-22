// index.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET' && req.url.startsWith('/usuario/')) {
    const cedula = req.url.split('/usuario/')[1];
    try {
      const usuario = await prisma.usuarios.findUnique({ where: { titular_documento: cedula } });
      if (!usuario) {
        return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
      }
      return res.json(usuario);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
    }
  }

  if (req.method === 'POST' && req.url === '/transaction') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { id_origen, id_destino, monto } = JSON.parse(body);
        if (!id_origen || !id_destino || typeof monto !== 'number' || monto <= 0) {
          return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
        }
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
        await prisma.$transaction([
          prisma.usuarios.update({ where: { titular_documento: id_origen }, data: { saldo: { decrement: monto } } }),
          prisma.usuarios.update({ where: { titular_documento: id_destino }, data: { saldo: { increment: monto } } })
        ]);
        return res.json({ status: 'approved', message: 'Transferencia realizada con éxito' });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/add-balance') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { documento, monto } = JSON.parse(body);
        if (!documento || typeof monto !== 'number' || monto <= 0) {
          return res.status(400).json({ status: 'error', message: 'Datos inválidos' });
        }
        const usuario = await prisma.usuarios.update({ where: { titular_documento: documento }, data: { saldo: { increment: monto } } });
        return res.json({ status: 'success', usuario });
      } catch (err) {
        if (err.code === 'P2025') {
          return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
        }
        console.error(err);
        return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
      }
    });
    return;
  }

  // Default route
  if (req.method === 'GET' && req.url === '/') {
    return res.status(200).send('API funcionando');
  }

  res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
};