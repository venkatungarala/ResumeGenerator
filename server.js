const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer'); // ✅ Only puppeteer, not puppeteer-core

const app = express();

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('form');
});

app.post('/generate', upload.single('profile'), async (req, res) => {
  try {
    const formData = { ...req.body };

    // Handle array fields
    const normalize = (field) => Array.isArray(field) ? field.join(', ') : (field || '');

    formData.skills = normalize(req.body.skills);
    formData.certifications = normalize(req.body.certifications);
    formData.languages = normalize(req.body.languages);
    formData.hobbies = normalize(req.body.hobbies);

    formData.education3_duration = formData.education3_duration || '';
    formData.education3_grade = formData.education3_grade || '';

    // Handle profile image
    if (req.file) {
      const imagePath = path.join(__dirname, 'uploads', req.file.filename);
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = req.file.mimetype;
      formData.profileImage = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } else {
      formData.profileImage = null;
    }

    // Render EJS to HTML
    const html = await ejs.renderFile(
      path.join(__dirname, 'views', 'resume.ejs'),
      formData
    );

    // Puppeteer PDF Generation
    const browser = await puppeteer.launch({
      headless: 'new', // ✅ works well on render.com
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=resume.pdf'
    });

    res.send(pdfBuffer);

    // Delete uploaded file
    if (req.file) {
      fs.unlink(path.join(__dirname, 'uploads', req.file.filename), () => {});
    }

  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    res.status(500).send('An error occurred while generating your resume.');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
