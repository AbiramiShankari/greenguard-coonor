// GreenGuard — IoT Bins Controller
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');

const prisma = new PrismaClient();

// GET /api/iot/bins
const getSmartBins = async (req, res) => {
  try {
    const bins = await prisma.smartBin.findMany({
      orderBy: { fillLevel: 'desc' },
    });
    return sendSuccess(res, 200, 'Smart bins retrieved', { bins });
  } catch (err) {
    console.error('[IOT] getSmartBins error:', err);
    return sendError(res, 500, 'Failed to fetch smart bins');
  }
};

// PUT /api/iot/bins/:id (Simulated webhook from hardware)
const updateBinFillLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { fillLevel } = req.body;
    
    const bin = await prisma.smartBin.update({
      where: { id },
      data: { fillLevel: parseFloat(fillLevel), lastUpdated: new Date() }
    });

    return sendSuccess(res, 200, 'Bin updated', { bin });
  } catch (err) {
    console.error('[IOT] updateBin error:', err);
    return sendError(res, 500, 'Failed to update bin');
  }
};

module.exports = { getSmartBins, updateBinFillLevel };
