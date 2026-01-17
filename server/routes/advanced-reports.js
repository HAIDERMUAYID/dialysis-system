const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// Get visits statistics by date range
router.get('/visits-stats', authenticateToken, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (db.prisma) {
      const where = {};
      if (start_date && end_date) {
        where.createdAt = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }
      
      const visits = await db.prisma.visit.findMany({
        where,
        select: {
          createdAt: true,
          status: true
        }
      });
      
      // Group by date
      const statsMap = {};
      visits.forEach(visit => {
        const date = visit.createdAt.toISOString().split('T')[0];
        if (!statsMap[date]) {
          statsMap[date] = {
            date,
            total: 0,
            completed: 0,
            pending_lab: 0,
            pending_pharmacy: 0,
            pending_doctor: 0
          };
        }
        statsMap[date].total++;
        if (visit.status === 'completed') statsMap[date].completed++;
        else if (visit.status === 'pending_lab') statsMap[date].pending_lab++;
        else if (visit.status === 'pending_pharmacy') statsMap[date].pending_pharmacy++;
        else if (visit.status === 'pending_doctor') statsMap[date].pending_doctor++;
      });
      
      const stats = Object.values(statsMap).sort((a, b) => b.date.localeCompare(a.date));
      res.json(stats);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending_lab' THEN 1 ELSE 0 END) as pending_lab,
          SUM(CASE WHEN status = 'pending_pharmacy' THEN 1 ELSE 0 END) as pending_pharmacy,
          SUM(CASE WHEN status = 'pending_doctor' THEN 1 ELSE 0 END) as pending_doctor
        FROM visits
      `;

      const params = [];
      if (start_date && end_date) {
        query += ' WHERE DATE(created_at) BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }

      query += ' GROUP BY DATE(created_at) ORDER BY date DESC';
      const stats = await allQuery(query, params);
      res.json(stats);
    }
  } catch (error) {
    console.error('Error fetching visits stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب إحصائيات الزيارات' });
  }
});

// Get patient statistics
router.get('/patient-stats', authenticateToken, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    let stats;
    
    if (db.prisma) {
      const patients = await db.prisma.patient.findMany({
        where: {
          gender: { not: null },
          age: { not: null }
        },
        select: {
          gender: true,
          age: true
        }
      });
      
      // Group by gender
      const byGender = {};
      patients.forEach(p => {
        if (p.gender) {
          byGender[p.gender] = (byGender[p.gender] || 0) + 1;
        }
      });
      const by_gender = Object.entries(byGender).map(([gender, count]) => ({ gender, count }));
      
      // Group by age
      const ageGroups = {
        'أقل من 18': 0,
        '18-30': 0,
        '31-50': 0,
        '51-70': 0,
        'أكثر من 70': 0
      };
      
      patients.forEach(p => {
        if (p.age) {
          if (p.age < 18) ageGroups['أقل من 18']++;
          else if (p.age <= 30) ageGroups['18-30']++;
          else if (p.age <= 50) ageGroups['31-50']++;
          else if (p.age <= 70) ageGroups['51-70']++;
          else ageGroups['أكثر من 70']++;
        }
      });
      
      const by_age_group = Object.entries(ageGroups).map(([age_group, count]) => ({ age_group, count }));
      
      const total_with_visits = await db.prisma.visit.groupBy({
        by: ['patientId'],
        _count: true
      });
      
      stats = {
        by_gender,
        by_age_group,
        total_with_visits: [{ count: total_with_visits.length }]
      };
    } else {
      const { allQuery } = require('../database/db');
      stats = {
        by_gender: await allQuery(`
          SELECT gender, COUNT(*) as count 
          FROM patients 
          WHERE gender IS NOT NULL AND gender != ''
          GROUP BY gender
        `),
        by_age_group: await allQuery(`
          SELECT 
            CASE 
              WHEN age < 18 THEN 'أقل من 18'
              WHEN age BETWEEN 18 AND 30 THEN '18-30'
              WHEN age BETWEEN 31 AND 50 THEN '31-50'
              WHEN age BETWEEN 51 AND 70 THEN '51-70'
              ELSE 'أكثر من 70'
            END as age_group,
            COUNT(*) as count
          FROM patients
          WHERE age IS NOT NULL
          GROUP BY age_group
        `),
        total_with_visits: await allQuery(`
          SELECT COUNT(DISTINCT patient_id) as count 
          FROM visits
        `)
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching patient stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب إحصائيات المرضى' });
  }
});

// Get department performance
router.get('/department-performance', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let performance;
    
    if (db.prisma) {
      const where = {};
      if (start_date && end_date) {
        where.createdAt = {
          gte: new Date(start_date),
          lte: new Date(end_date)
        };
      }
      
      // Lab performance
      const labVisits = await db.prisma.visit.findMany({
        where: {
          ...where,
          status: { in: ['pending_pharmacy', 'pending_doctor', 'completed'] }
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      const labHours = labVisits
        .map(v => {
          const hours = (v.updatedAt.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60);
          return hours > 0 ? hours : null;
        })
        .filter(h => h !== null);
      
      const labAvg = labHours.length > 0 
        ? labHours.reduce((sum, h) => sum + h, 0) / labHours.length 
        : 0;
      
      // Pharmacy performance
      const pharmVisits = await db.prisma.visit.findMany({
        where: {
          ...where,
          status: { in: ['pending_doctor', 'completed'] }
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      const pharmHours = pharmVisits
        .map(v => {
          const hours = (v.updatedAt.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60);
          return hours > 0 ? hours : null;
        })
        .filter(h => h !== null);
      
      const pharmAvg = pharmHours.length > 0 
        ? pharmHours.reduce((sum, h) => sum + h, 0) / pharmHours.length 
        : 0;
      
      // Doctor performance
      const doctorVisits = await db.prisma.visit.findMany({
        where: {
          ...where,
          status: 'completed'
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      const doctorHours = doctorVisits
        .map(v => {
          const hours = (v.updatedAt.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60);
          return hours > 0 ? hours : null;
        })
        .filter(h => h !== null);
      
      const doctorAvg = doctorHours.length > 0 
        ? doctorHours.reduce((sum, h) => sum + h, 0) / doctorHours.length 
        : 0;
      
      performance = {
        lab: [{
          total_visits: labVisits.length,
          avg_hours: labAvg
        }],
        pharmacy: [{
          total_visits: pharmVisits.length,
          avg_hours: pharmAvg
        }],
        doctor: [{
          total_visits: doctorVisits.length,
          avg_hours: doctorAvg
        }]
      };
    } else {
      const { allQuery } = require('../database/db');
      let dateFilter = '';
      const params = [];
      if (start_date && end_date) {
        dateFilter = 'WHERE DATE(v.created_at) BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }

      performance = {
        lab: await allQuery(`
          SELECT 
            COUNT(DISTINCT v.id) as total_visits,
            AVG(CASE 
              WHEN v.status IN ('pending_pharmacy', 'pending_doctor', 'completed') 
              THEN (julianday(v.updated_at) - julianday(v.created_at)) * 24 
              ELSE NULL 
            END) as avg_hours
          FROM visits v
          ${dateFilter}
          AND v.status IN ('pending_pharmacy', 'pending_doctor', 'completed')
        `, params),
        pharmacy: await allQuery(`
          SELECT 
            COUNT(DISTINCT v.id) as total_visits,
            AVG(CASE 
              WHEN v.status IN ('pending_doctor', 'completed') 
              THEN (julianday(v.updated_at) - julianday(v.created_at)) * 24 
              ELSE NULL 
            END) as avg_hours
          FROM visits v
          ${dateFilter.replace('v.created_at', 'v.updated_at') || ''}
          AND v.status IN ('pending_doctor', 'completed')
        `, params),
        doctor: await allQuery(`
          SELECT 
            COUNT(DISTINCT v.id) as total_visits,
            AVG(CASE 
              WHEN v.status = 'completed' 
              THEN (julianday(v.updated_at) - julianday(v.created_at)) * 24 
              ELSE NULL 
            END) as avg_hours
          FROM visits v
          ${dateFilter.replace('v.created_at', 'v.updated_at') || ''}
          AND v.status = 'completed'
        `, params)
      };
    }

    res.json(performance);
  } catch (error) {
    console.error('Error fetching department performance:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب أداء الأقسام' });
  }
});

module.exports = router;
